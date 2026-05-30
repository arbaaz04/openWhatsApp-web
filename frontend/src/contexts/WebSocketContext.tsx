import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Conversation {
  id: number;
  customerNumber: string;
  whatsappId: string;
  isWindowOpen: boolean;
  lastCustomerMessageAt: string | null;
  createdAt: string;
}

export interface Channel {
  id: number;
  whatsappId: string;
}

export interface WsMessage {
  type: 'incoming' | 'outgoing' | 'replay' | 'sync_complete';
  conversationId: number;
  messageId?: number | string;
  body?: string | null;
  bodyText?: string | null;
  wamid?: string | null;
  timestamp: string;
}

interface WebSocketContextType {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  loadingConversations: boolean;
  channels: Channel[];
  isWsConnected: boolean;
  registerMessageListener: (listener: (msg: WsMessage) => void) => () => void;
  refreshConversations: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, teams } = useAuth();
  const teamId = teams[0]?.teamId;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [connections, setConnections] = useState<{ [whatsappId: string]: boolean }>({});
  
  const listenersRef = useRef<Array<(msg: WsMessage) => void>>([]);

  const registerMessageListener = (listener: (msg: WsMessage) => void) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== listener);
    };
  };

  const refreshConversations = useCallback(async () => {
    if (!session) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/conversations/`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConversations(data.conversations);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, [session]);

  const fetchChannels = useCallback(async () => {
    if (!session || !teamId) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/teams/${teamId}/channels`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChannels(data.channels);
        }
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  }, [session, teamId]);

  // Initial data fetch on session or team change
  useEffect(() => {
    if (!session) {
      setConversations([]);
      setChannels([]);
      return;
    }
    
    setLoadingConversations(true);
    Promise.all([refreshConversations(), fetchChannels()]).finally(() => {
      setLoadingConversations(false);
    });
  }, [session, teamId, refreshConversations, fetchChannels]);

  const uniqueWhatsappIds = [...new Set([
    ...channels.map(c => c.whatsappId).filter(Boolean),
    ...conversations.map(c => c.whatsappId).filter(Boolean)
  ])];
  const whatsappIdsKey = uniqueWhatsappIds.join(',');

  // Manage WebSockets globally
  useEffect(() => {
    if (!session || !whatsappIdsKey) return;

    const channelsToConnect = whatsappIdsKey.split(',').filter(Boolean);
    const sockets: WebSocket[] = [];
    const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const cleanApiUrl = rawApiUrl.replace(/\/$/, '');
    const wsUrl = cleanApiUrl.replace(/^http/, 'ws');
    const token = session?.access_token || '';

    let isClosedByUser = false;
    const reconnectTimeouts: { [key: string]: ReturnType<typeof setTimeout> } = {};

    channelsToConnect.forEach(whatsappId => {
      const socketUrl = `${wsUrl}/api/ws/inbox?phoneNumberId=${whatsappId}&token=${encodeURIComponent(token)}`;
      let socket: WebSocket | null = null;
      let retryCount = 0;

      function connect() {
        if (isClosedByUser) return;
        socket = new WebSocket(socketUrl);
        
        socket.onopen = () => {
          retryCount = 0;
          setConnections(prev => ({ ...prev, [whatsappId]: true }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // 1. Notify any custom listeners (like ChatPane)
            listenersRef.current.forEach(listener => {
              try {
                listener(data);
              } catch (err) {
                console.error('Error in message listener:', err);
              }
            });

            // 2. Update conversation list locally
            if (data.type === 'incoming' || data.type === 'outgoing') {
              setConversations(prev => {
                const next = [...prev];
                const idx = next.findIndex(c => String(c.id) === String(data.conversationId));
                
                if (idx !== -1) {
                  // Update existing conversation
                  const isIncoming = data.type === 'incoming';
                  const nextLastCustomerMessageAt = isIncoming ? data.timestamp : next[idx].lastCustomerMessageAt;
                  const isWindowOpen = nextLastCustomerMessageAt
                    ? (Date.now() - new Date(nextLastCustomerMessageAt).getTime()) < 24 * 60 * 60 * 1000
                    : false;

                  next[idx] = {
                    ...next[idx],
                    lastCustomerMessageAt: nextLastCustomerMessageAt,
                    isWindowOpen
                  };
                  // Move to top
                  const [item] = next.splice(idx, 1);
                  next.unshift(item);
                } else {
                  // Fetch the new conversation detail and prepend it
                  const fetchUrl = `${cleanApiUrl}/api/conversations/${data.conversationId}`;
                  fetch(fetchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                    .then(res => res.json())
                    .then(resData => {
                      if (resData.success && resData.conversation) {
                        setConversations(current => {
                          if (current.find(c => String(c.id) === String(resData.conversation.id))) {
                            return current;
                          }
                          return [
                            {
                              id: resData.conversation.id,
                              customerNumber: resData.conversation.customerNumber,
                              whatsappId: resData.conversation.whatsappId || '',
                              isWindowOpen: resData.conversation.isWindowOpen,
                              lastCustomerMessageAt: resData.conversation.lastCustomerMessageAt,
                              createdAt: new Date().toISOString()
                            },
                            ...current
                          ];
                        });
                      }
                    })
                    .catch(err => console.error('[WebSocket] Failed to fetch new conversation detail:', err));
                }
                return next;
              });
            }
          } catch (e) {
            console.error('[WebSocket] Sidebar WS error parsing:', e);
          }
        };

        socket.onclose = () => {
          setConnections(prev => ({ ...prev, [whatsappId]: false }));
          if (!isClosedByUser) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 15000);
            retryCount++;
            reconnectTimeouts[whatsappId] = setTimeout(connect, delay);
          }
        };

        socket.onerror = (err) => {
          console.error(`[WebSocket] Global WS error for channel ${whatsappId}:`, err);
          setConnections(prev => ({ ...prev, [whatsappId]: false }));
        };

        if (socket) {
          sockets.push(socket);
        }
      }

      connect();
    });

    return () => {
      isClosedByUser = true;
      sockets.forEach(s => s.close());
      Object.values(reconnectTimeouts).forEach(t => clearTimeout(t));
      setConnections({});
    };
  }, [session, whatsappIdsKey]);

  // Overall WS status indicator
  const isWsConnected = Object.values(connections).some(Boolean);

  return (
    <WebSocketContext.Provider value={{
      conversations,
      setConversations,
      loadingConversations,
      channels,
      isWsConnected,
      registerMessageListener,
      refreshConversations
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
