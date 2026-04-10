import React, { useState, useEffect } from 'react';

type Message = {
  customerPhone: string;
  bodyText: string;
  timestamp: string;
};

/**
 * Real-Time Inbox Component
 * Connects to the Cloudflare Durable Object WebSocket for live messages.
 */
export const Inbox: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Determine WS protocol based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL?.replace(/^http(s)?:\/\//, '') || 'localhost:8787';
    
    const ws = new WebSocket(`${protocol}//${host}/api/ws/inbox`);

    ws.onopen = () => {
      console.log('Connected to Whatflow InboxSync');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Message;
        setMessages((prev) => [...prev, payload]);
      } catch (err) {
        console.error('Failed parsing WS message', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Whatflow InboxSync');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Live Inbox</h2>
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="space-y-4 max-h-96 overflow-y-auto w-full">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Waiting for incoming messages...</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{msg.customerPhone}</span>
                <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-gray-700">{msg.bodyText}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
