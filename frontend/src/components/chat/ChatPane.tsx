import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Info, ArrowLeft, Loader2 } from 'lucide-react';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { TemplatePicker } from './TemplatePicker';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

import type { Message as BubbleMessage } from './MessageBubble';

import { useWebSocket } from '../../contexts/WebSocketContext';

interface ChatMessage {
  id: string;
  body: string;
  senderName?: string;
  direction: 'incoming' | 'outgoing';
  time: string;
  type?: 'text' | 'business';
  replyTo?: string; // ID of message replied to
}

export function ChatPane() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [replyingTo, setReplyingTo] = useState<BubbleMessage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerNumber, setCustomerNumber] = useState<string>('');
  const { session } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isWsConnected, registerMessageListener } = useWebSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    async function fetchMessages() {
      if (!session || !conversationId) return;
      setLoading(true);
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
            const formatted = data.messages.map((m: { id: number; body: string | null; direction: string; createdAt: string }) => ({
              id: String(m.id),
              body: m.body || '',
              direction: m.direction === 'echo' ? 'outgoing' : m.direction,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: m.direction === 'incoming' ? 'Customer' : undefined
            })).reverse();
            setMessages(formatted);
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
  }, [conversationId, session]);

  const [whatsappId, setWhatsappId] = useState<string>('');
  const [teamId, setTeamId] = useState<string | number>('');
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
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
        if (!session || !conversationId) return;
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
             }
           }
        } catch (e) {
           console.error('Failed to fetch conversation metadata:', e);
        }
     }
     fetchConvMeta();
  }, [conversationId, session]);

  // Subscribe to real-time events from the global WebSocket provider
  useEffect(() => {
    if (!whatsappId || !conversationId) return;

    const unsubscribe = registerMessageListener((data) => {
      if (data.type === 'incoming' || data.type === 'outgoing') {
        if (String(data.conversationId) === String(conversationId)) {
          const newMessage: ChatMessage = {
            id: String(data.messageId),
            body: data.bodyText || data.body || (data.type === 'outgoing' && data.wamid ? 'Template Message' : ''),
            direction: data.type === 'incoming' ? 'incoming' : 'outgoing',
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: data.type === 'incoming' ? 'Customer' : undefined
          };

          setMessages(prev => {
            // Deduplicate by message ID
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          if (data.type === 'incoming') {
            setLastCustomerMessageAt(data.timestamp);
          }

          setTimeout(scrollToBottom, 100);
        }
      }
    });

    return unsubscribe;
  }, [whatsappId, conversationId, registerMessageListener]);

  // Calculate session expiration
  const isExpired = !lastCustomerMessageAt || 
    (currentTime - new Date(lastCustomerMessageAt).getTime()) >= 24 * 60 * 60 * 1000;

  const initials = customerNumber
    ? customerNumber.replace(/[^0-9]/g, '').slice(-2)
    : 'C';

  const handleReply = (msg: BubbleMessage) => {
    setReplyingTo({ id: msg.id, body: msg.body, senderName: msg.senderName });
  };

  const handleSendMessage = async (body: string) => {
    if (!session || !conversationId) return;
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
          type: 'text'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        // The WebSocket will broadcast this back to us as well, but we can optimistically update
        if (data.success && !messages.find(m => m.id === String(data.messageId))) {
            const newMessage: ChatMessage = {
              id: String(data.messageId),
              body,
              direction: 'outgoing',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, newMessage]);
            setReplyingTo(null);
            setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleSendTemplate = async (payload: Record<string, unknown>) => {
    if (!session || !conversationId) return;
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
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, newMessage]);
            setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error('Failed to send template:', err);
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
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-medium">
                {loading ? 'Searching history...' : `Conversation active`}
              </span>
              {!loading && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-gray-400 font-medium">
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
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                {...m}
                replyTo={null}
                onReply={handleReply}
                avatarInitial="C"
              />
            ))}
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
          onToggleTemplates={() => setIsTemplatePickerOpen(true)}
          isExpired={isExpired}
        />
      </div>

      <TemplatePicker
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={handleSendTemplate}
        channelId={whatsappId}
        teamId={teamId}
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
