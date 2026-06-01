import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Info, ArrowLeft, Loader2 } from 'lucide-react';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { TemplatePicker } from './TemplatePicker';
import { InteractivePicker } from './InteractivePicker';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

import type { Message as BubbleMessage } from './MessageBubble';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { getMessages, putMessages, putSingleMessage } from '../../lib/db';
import { parseMessageBody } from '../../lib/messageParser';

interface ChatMessage {
  id: string;
  body: string;
  senderName?: string;
  direction: 'incoming' | 'outgoing';
  time: string;
  type?: 'text' | 'business';
  replyTo?: string; // ID of message replied to
  externalId?: string;
  status?: 'uploading' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  localFile?: File;
}

export function ChatPane() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [replyingTo, setReplyingTo] = useState<BubbleMessage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerNumber, setCustomerNumber] = useState<string>('');
  const [channelPhoneNumber, setChannelPhoneNumber] = useState<string>('');
  const [channelBusinessName, setChannelBusinessName] = useState<string>('');
  const { session } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isWsConnected, registerMessageListener, sendWsMessage } = useWebSocket();
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string; timestamp: number }>>({});

  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingMetaThrottleRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Clean up stale typing indicators from other agents
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [uid, info] of Object.entries(next) as [string, { userName: string; timestamp: number }][]) {
          if (now - info.timestamp > 6000) { // 6 seconds timeout
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const lastLoadedConvIdRef = useRef<string | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const lastLoadedMetaConvIdRef = useRef<string | null>(null);
  const lastLoadedMetaUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function fetchMessages() {
      const userId = session?.user?.id;
      if (!userId || !conversationId) return;

      if (lastLoadedConvIdRef.current === conversationId && lastLoadedUserIdRef.current === userId) {
        return;
      }
      
      // Load from cache first for instant render
      getMessages(userId, conversationId).then(cached => {
        if (cached && cached.length > 0) {
          setMessages(cached);
          setLoading(false);
          setTimeout(scrollToBottom, 50);
        }
      });

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        
        // Fetch conversation details to get the number (alternatively this could be in metadata)
        // For now, we'll try to find it from the first message or fetch it if possible.
        
        const res = await fetch(`${apiUrl}/api/conversations/${conversationId}/messages`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Find customer number if not set (usually the backend returns this in a dedicated conv fetch)
            // But here we rely on the messages.
            
            // Backend returns newest first, we want oldest first for display
            const formatted = data.messages.map((m: { id: number; body: string | null; direction: string; createdAt: string; externalId?: string | null; status?: 'sent' | 'delivered' | 'read' | 'failed' | null }) => ({
              id: String(m.id),
              body: m.body || '',
              direction: m.direction === 'echo' ? 'outgoing' : m.direction,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: m.direction === 'incoming' ? 'Customer' : undefined,
              externalId: m.externalId || undefined,
              status: m.status || undefined
            })).reverse();
            setMessages(formatted);
            putMessages(userId, conversationId, formatted);
            lastLoadedConvIdRef.current = conversationId;
            lastLoadedUserIdRef.current = userId;
            setTimeout(scrollToBottom, 100);
          }
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session?.user?.id]);

  const [whatsappId, setWhatsappId] = useState<string>('');
  const [teamId, setTeamId] = useState<string | number>('');
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isInteractivePickerOpen, setIsInteractivePickerOpen] = useState(false);
  const [lastCustomerMessageAt, setLastCustomerMessageAt] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Dynamic ticking timer to update the window expiry in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Try to find the customer number and whatsappId from the single conversation endpoint.
  useEffect(() => {
     async function fetchConvMeta() {
        const userId = session?.user?.id;
        if (!session || !conversationId || !userId) return;

        if (lastLoadedMetaConvIdRef.current === conversationId && lastLoadedMetaUserIdRef.current === userId) {
          return;
        }

        try {
           const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
           const res = await fetch(`${apiUrl}/api/conversations/${conversationId}`, {
             headers: { 'Authorization': `Bearer ${session.access_token}` }
           });
           if (res.ok) {
             const data = await res.json();
             if (data.success && data.conversation) {
               setCustomerNumber(data.conversation.customerNumber);
               setWhatsappId(data.conversation.whatsappId);
               setTeamId(data.conversation.teamId);
               setLastCustomerMessageAt(data.conversation.lastCustomerMessageAt);
               setChannelPhoneNumber(data.conversation.channelPhoneNumber || '');
               setChannelBusinessName(data.conversation.channelBusinessName || '');
               lastLoadedMetaConvIdRef.current = conversationId;
               lastLoadedMetaUserIdRef.current = userId;
             }
           }
        } catch (e) {
           console.error('Failed to fetch conversation metadata:', e);
        }
     }
     fetchConvMeta();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session?.user?.id]);

  // Subscribe to real-time events from the global WebSocket provider
  useEffect(() => {
    const userId = session?.user?.id;
    if (!whatsappId || !conversationId || !userId) return;

    const unsubscribe = registerMessageListener((data) => {
      if (data.type === 'status_update') {
        if (String(data.conversationId) === String(conversationId)) {
          setMessages(prev => {
            const statusPriority: Record<string, number> = {
              sent: 1,
              failed: 2,
              delivered: 3,
              read: 4,
            };
            const next = prev.map(m => {
              if (m.externalId === data.wamid || m.id === String(data.messageId)) {
                const currentPriority = m.status ? (statusPriority[m.status] ?? 0) : 0;
                const newPriority = data.status ? (statusPriority[data.status] ?? 0) : 0;
                if (newPriority > currentPriority) {
                  return { ...m, status: data.status };
                }
              }
              return m;
            });
            putMessages(userId, conversationId, next);
            return next;
          });
        }
      } else if (data.type === 'revoke') {
        if (String(data.conversationId) === String(conversationId)) {
          setMessages(prev => {
            const next = prev.map(m => m.externalId === data.wamid || m.id === String(data.messageId)
              ? { ...m, body: 'This message was deleted' }
              : m
            );
            putMessages(userId, conversationId, next);
            return next;
          });
        }
      } else if (data.type === 'typing') {
        if (String(data.conversationId) === String(conversationId)) {
          setTypingUsers(prev => {
            const next = { ...prev };
            if (data.isTyping && data.userId) {
              next[data.userId] = {
                userName: data.userName || 'Someone',
                timestamp: Date.now()
              };
            } else if (data.userId) {
              delete next[data.userId];
            }
            return next;
          });
        }
      } else if (data.type === 'incoming' || data.type === 'outgoing') {
        if (String(data.conversationId) === String(conversationId)) {
          const newMessage: ChatMessage = {
            id: String(data.messageId),
            body: data.bodyText || data.body || (data.type === 'outgoing' && data.wamid ? 'Template Message' : ''),
            direction: data.type === 'incoming' ? 'incoming' : 'outgoing',
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: data.type === 'incoming' ? 'Customer' : undefined,
            externalId: data.wamid || undefined,
            status: data.type === 'outgoing' ? 'sent' : undefined
          };

          setMessages(prev => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            const next = [...prev, newMessage];
            putSingleMessage(userId, conversationId, newMessage);
            return next;
          });

          if (data.type === 'incoming') {
            setLastCustomerMessageAt(data.timestamp);
          }

          setTimeout(scrollToBottom, 100);
        }
      }
    });

    return unsubscribe;
  }, [whatsappId, conversationId, registerMessageListener, session?.user?.id]);

  // Automatically mark conversation as read when conversation is loaded or when new incoming messages are received
  useEffect(() => {
    if (!session || !conversationId) return;

    const markAsRead = async () => {
      try {
        const sendMetaReceipt = localStorage.getItem('read_receipts_enabled') !== 'false';
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        await fetch(`${apiUrl}/api/conversations/${conversationId}/read?sendMetaReceipt=${sendMetaReceipt}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch (err) {
        console.error('Failed to mark conversation as read:', err);
      }
    };

    markAsRead();

    // Listen for toggle updates to re-trigger markAsRead
    const handleToggle = () => {
      markAsRead();
    };
    window.addEventListener('read_receipts_toggle', handleToggle);

    // Re-trigger if the last message in the thread is incoming and not read yet
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.direction === 'incoming' && lastMsg.status !== 'read') {
      markAsRead();
    }

    return () => {
      window.removeEventListener('read_receipts_toggle', handleToggle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session, messages.length]);

  // Calculate session expiration
  const isExpired = !lastCustomerMessageAt || 
    (currentTime - new Date(lastCustomerMessageAt).getTime()) >= 24 * 60 * 60 * 1000;

  const initials = customerNumber
    ? customerNumber.replace(/[^0-9]/g, '').slice(-2)
    : 'C';

  const handleReply = (msg: BubbleMessage) => {
    setReplyingTo({ id: msg.id, body: msg.body, senderName: msg.senderName });
  };

  const handleAgentTyping = () => {
    const userId = session?.user?.id;
    if (!userId || !conversationId || !whatsappId) return;

    const agentName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Agent';

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: true,
        userId,
        userName: agentName
      });
    }

    const now = Date.now();
    if (now - typingMetaThrottleRef.current > 15000) {
      typingMetaThrottleRef.current = now;
      const triggerMetaTyping = async () => {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
          await fetch(`${apiUrl}/api/conversations/${conversationId}/typing`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
        } catch (err) {
          console.error('Failed to trigger Meta typing indicator:', err);
        }
      };
      triggerMetaTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: false,
        userId,
        userName: agentName
      });
    }, 3000);
  };

  const handleSendMessage = async (body: string, replyToId?: string) => {
    const userId = session?.user?.id;
    if (!session || !userId || !conversationId) return;

    // Clear typing status immediately upon sending a message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      const agentName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Agent';
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: false,
        userId,
        userName: agentName
      });
    }

    const tempId = `opt-${Date.now()}`;
    const replyMsg = replyToId ? messages.find(m => m.id === replyToId) : null;
    const dbBody = replyMsg ? `[REPLY:${replyMsg.externalId || ''}]${body}` : body;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      body: dbBody,
      direction: 'outgoing',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending'
    };

    // Optimistically add to messages list
    setMessages(prev => [...prev, optimisticMessage]);
    setReplyingTo(null);
    setTimeout(scrollToBottom, 50);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          body,
          type: 'text',
          replyToMessageId: replyToId
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const finalMessage: ChatMessage = {
            id: String(data.messageId),
            body: dbBody,
            direction: 'outgoing',
            time: optimisticMessage.time,
            externalId: data.wamid || undefined,
            status: 'sent'
          };
          setMessages(prev => prev.map(m => m.id === tempId ? finalMessage : m));
          putSingleMessage(userId, conversationId, finalMessage);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || errorData.message || 'Failed to send message';
        alert(`Error: ${errorMsg}`);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Error: Network connection failure.');
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  const handleSendMedia = async (
    file: File,
    type: 'image' | 'video' | 'audio' | 'document' | 'voice',
    caption?: string,
    replyToId?: string
  ) => {
    const userId = session?.user?.id;
    if (!session || !userId || !conversationId) return;

    // Clear typing status immediately upon sending a message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      const agentName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Agent';
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: false,
        userId,
        userName: agentName
      });
    }

    const tempId = `opt-${Date.now()}`;
    const replyMsg = replyToId ? messages.find(m => m.id === replyToId) : null;
    const bodyText = `[MEDIA:${type}:temp-media-id]${caption || ''}`;
    const dbBody = replyMsg ? `[REPLY:${replyMsg.externalId || ''}]${bodyText}` : bodyText;

    // Create optimistic media message with localFile set
    const optimisticMessage: ChatMessage = {
      id: tempId,
      body: dbBody,
      direction: 'outgoing',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'uploading',
      localFile: file
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setReplyingTo(null);
    setTimeout(scrollToBottom, 50);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

      // 1. Upload to our proxy endpoint
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(`${apiUrl}/api/conversations/${conversationId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || errData.message || 'File upload failed';
        throw new Error(errMsg);
      }

      const uploadResult = await uploadRes.json();
      const mediaId = uploadResult.mediaId;

      // Update message status to sending once upload completes
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sending' } : m));

      // 2. Prepare outbound Meta payload
      const metaType = type === 'voice' ? 'voice' : type;
      const payload: Record<string, unknown> = {};
      
      if (metaType === 'document') {
        payload[metaType] = {
          id: mediaId,
          filename: file.name
        };
      } else {
        payload[metaType] = {
          id: mediaId
        };
        if (caption && (metaType === 'image' || metaType === 'video')) {
          const mediaObj = payload[metaType] as Record<string, unknown>;
          mediaObj.caption = caption;
        }
      }

      // Format DB message body text
      const finalBodyText = `[MEDIA:${type}:${mediaId}]${caption || ''}`;
      const finalDbBody = replyMsg ? `[REPLY:${replyMsg.externalId || ''}]${finalBodyText}` : finalBodyText;

      const res = await fetch(`${apiUrl}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          body: finalBodyText,
          type: metaType,
          payload,
          replyToMessageId: replyToId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const finalMessage: ChatMessage = {
            id: String(data.messageId),
            body: finalDbBody,
            direction: 'outgoing',
            time: optimisticMessage.time,
            externalId: data.wamid || undefined,
            status: 'sent'
          };
          setMessages(prev => prev.map(m => m.id === tempId ? finalMessage : m));
          putSingleMessage(userId, conversationId, finalMessage);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || errorData.message || 'Failed to dispatch media message';
        alert(`Error: ${errorMsg}`);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
    } catch (err: unknown) {
      console.error('Failed to send media:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Error sending media: ${errMsg}`);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };
 
  const handleSendTemplate = async (payload: Record<string, unknown>) => {
    const userId = session?.user?.id;
    if (!session || !userId || !conversationId) return;

    // Clear typing status immediately upon sending a template
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      const agentName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Agent';
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: false,
        userId,
        userName: agentName
      });
    }
    try {
      // Find the template body text to show it optimistically
      const template = payload.template as { name: string };
      const templateName = template.name;
      const bodyText = `Sent Template: ${templateName.replaceAll('_', ' ')}`;
 
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          body: bodyText,
          type: 'template',
          payload
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
            const newMessage: ChatMessage = {
              id: String(data.messageId),
              body: bodyText,
              direction: 'outgoing',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              externalId: data.wamid || undefined
            };
            setMessages(prev => [...prev, newMessage]);
            putSingleMessage(userId, conversationId, newMessage);
            setTimeout(scrollToBottom, 100);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || errorData.message || 'Failed to send template';
        alert(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Failed to send template:', err);
      alert('Error: Network connection failure.');
    }
  };

  const handleSendInteractive = async (interactiveData: { type: 'interactive'; body: string; payload: Record<string, any> }) => {
    const userId = session?.user?.id;
    if (!session || !userId || !conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      const agentName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Agent';
      sendWsMessage(whatsappId, {
        type: 'typing',
        conversationId: parseInt(conversationId, 10),
        isTyping: false,
        userId,
        userName: agentName
      });
    }

    const tempId = `temp-${Date.now()}`;
    const dbBody = interactiveData.body;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      body: dbBody,
      direction: 'outgoing',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 50);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          body: dbBody,
          type: 'interactive',
          payload: interactiveData.payload
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const finalMessage: ChatMessage = {
            id: String(data.messageId),
            body: dbBody,
            direction: 'outgoing',
            time: optimisticMessage.time,
            externalId: data.wamid || undefined,
            status: 'sent'
          };
          setMessages(prev => prev.map(m => m.id === tempId ? finalMessage : m));
          putSingleMessage(userId, conversationId, finalMessage);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || errorData.message || 'Failed to send interactive message';
        alert(`Error: ${errorMsg}`);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
    } catch (err) {
      console.error('Failed to send interactive message:', err);
      alert('Error: Network connection failure.');
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA]">
      
      {/* Refined SaaS Header */}
      <header className="h-[64px] shrink-0 bg-white border-b border-[#EDEDED] flex items-center justify-between px-5 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-900 rounded-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="w-9 h-9 rounded bg-[#128C7E] flex items-center justify-center text-white text-[13px] font-bold shadow-sm">
            {initials}
          </div>
          <div className="flex flex-col">
            <h2 className="text-[14px] font-bold text-gray-900 leading-none mb-1">
              {loading ? 'Loading...' : (customerNumber || 'Customer')}
            </h2>
            <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium leading-none">
              <span>{loading ? 'Searching history...' : 'Conversation active'}</span>
              {!loading && channelPhoneNumber && (
                <>
                  <span className="text-gray-300 font-bold select-none">·</span>
                  <span className="text-[#128C7E] font-semibold">
                    via {channelBusinessName ? `${channelBusinessName} (${channelPhoneNumber})` : channelPhoneNumber}
                  </span>
                </>
              )}
              {!loading && (
                <>
                  <span className="text-gray-300 font-bold select-none">·</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    {isWsConnected ? 'Live' : 'Offline'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Header Toolbar */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => navigate('/')}
            className="h-8 px-3 text-[12px] font-bold text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded transition-all"
          >
            Close
          </button>
          <button className="h-8 px-3 text-[12px] font-bold text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded transition-all flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Info
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          <button className="h-8 px-3 text-[12px] font-bold text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded transition-all flex items-center gap-1.5 whitespace-nowrap">
            Conversation actions
            <MoreHorizontal className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-[10%] py-4 z-0 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
             <Loader2 className="w-6 h-6 text-[#128C7E] animate-spin" />
             <span className="text-[12px] text-gray-400 font-medium">Loading history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
             <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 mb-2">
               <Info className="w-6 h-6 text-gray-300" />
             </div>
             <span className="text-[13px] text-gray-900 font-bold">No messages yet</span>
             <p className="text-[12px] text-gray-500 text-center max-w-[200px]">Send a message to start the conversation.</p>
          </div>
        ) : (
          <>
            <DateSeparator label="Conversation Started" isEvent />
            {messages.map((m) => {
              const parsed = parseMessageBody(m.body);
              
              let replyToMessage: BubbleMessage | null = null;
              if (parsed.replyToWamid) {
                const found = messages.find(
                  (msg) => msg.externalId === parsed.replyToWamid || msg.id === parsed.replyToWamid
                );
                if (found) {
                  const foundParsed = parseMessageBody(found.body);
                  let displayBody = foundParsed.cleanBody;
                  if (foundParsed.media) {
                    const iconMap = {
                      image: '📷 Photo',
                      video: '📹 Video',
                      voice: '🎤 Voice Note',
                      audio: '🎵 Audio',
                      document: '📄 Document',
                    };
                    const typeLabel = iconMap[foundParsed.media.type] || 'Media';
                    displayBody = foundParsed.cleanBody 
                      ? `${typeLabel}: ${foundParsed.cleanBody}` 
                      : typeLabel;
                  }
                  replyToMessage = {
                    id: found.id,
                    body: displayBody,
                    senderName: found.senderName,
                  };
                } else {
                  replyToMessage = {
                    id: parsed.replyToWamid,
                    body: 'Original Message',
                    senderName: m.direction === 'incoming' ? 'Agent' : 'Customer',
                  };
                }
              }

              return (
                <MessageBubble
                  key={m.id}
                  id={m.id}
                  body={parsed.cleanBody}
                  direction={m.direction}
                  time={m.time}
                  type={m.type}
                  senderName={m.senderName}
                  conversationId={conversationId}
                  media={parsed.media}
                  replyTo={replyToMessage}
                  onReply={handleReply}
                  avatarInitial="C"
                  status={m.status}
                  localFile={m.localFile}
                />
              );
            })}
            {(Object.values(typingUsers) as { userName: string; timestamp: number }[]).length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#075E54] italic font-semibold mt-2 pl-4 sm:pl-[10%] select-none animate-pulse">
                <span className="flex gap-0.5 items-center mr-1 shrink-0">
                  <span className="w-1 h-1 bg-[#075E54] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-1 bg-[#075E54] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-1 bg-[#075E54] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                <span>{(Object.values(typingUsers) as { userName: string; timestamp: number }[]).map(u => u.userName).join(', ')} is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer Container */}
      <div className="px-4 pb-4 shrink-0">
        <Composer 
          replyTo={replyingTo} 
          onCancelReply={() => setReplyingTo(null)} 
          onSend={handleSendMessage}
          onSendMedia={handleSendMedia}
          onToggleTemplates={() => setIsTemplatePickerOpen(true)}
          onToggleInteractive={() => setIsInteractivePickerOpen(true)}
          isExpired={isExpired}
          onTyping={handleAgentTyping}
        />
      </div>

      <TemplatePicker
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={handleSendTemplate}
        channelId={whatsappId}
        teamId={teamId}
      />

      <InteractivePicker
        isOpen={isInteractivePickerOpen}
        onClose={() => setIsInteractivePickerOpen(false)}
        onSelect={handleSendInteractive}
      />
    </div>
  );
}

function DateSeparator({ label, isEvent = false }: { label: string; isEvent?: boolean }) {
  return (
    <div className="flex items-center gap-4 my-6">
      {!isEvent && <div className="h-px bg-gray-100 flex-1"></div>}
      <span className={cn(
        "text-[11px] font-bold uppercase tracking-widest",
        isEvent ? "text-gray-400 mx-auto" : "text-gray-400"
      )}>
        {label}
      </span>
      {!isEvent && <div className="h-px bg-gray-100 flex-1"></div>}
    </div>
  );
}
