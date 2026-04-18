import { useState, useEffect } from 'react';
import { Search, Edit, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConversationItem } from './ConversationItem';
import { NavLink, useNavigate } from 'react-router-dom';
import { NewChatModal } from './NewChatModal';

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Conversation {
  id: number;
  customerNumber: string;
  isWindowOpen: boolean;
  lastCustomerMessageAt: string | null;
  createdAt: string;
}

export function InboxSidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [numbersCount, setNumbersCount] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleStartChat = (phone: string) => {
    // Normalize phone (simple check)
    const normalizedPhone = phone.replace(/[^0-9+]/g, '');
    
    // Find existing conversation
    const existing = conversations.find(c => 
      c.customerNumber.replace(/[^0-9+]/g, '') === normalizedPhone
    );

    if (existing) {
      navigate(`/c/${existing.id}`);
    } else {
      alert(`Conversation with ${phone} doesn't exist yet. Conversations are usually started by customers or via templates.`);
    }
  };

  useEffect(() => {
    async function fetchData() {
      if (!session) return;
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        
        // 1. Fetch Stats to check for linked numbers
        const statsRes = await fetch(`${apiUrl}/api/dashboard/stats`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.success) {
            setNumbersCount(statsData.stats.numbersCount);
          }
        }

        // 2. Fetch Conversations
        const res = await fetch(`${apiUrl}/api/conversations/`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setConversations(data.conversations);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  return (
    <div className="w-[280px] h-full bg-white border-r border-[#E5E7EB] flex flex-col shrink-0">
      {/* Header Area */}
      <div className="px-4 py-3 pb-2 border-b border-[#E5E7EB] shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-[14px] font-semibold text-gray-900 tracking-tight">Inbox</h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-gray-500 hover:text-gray-900 border border-gray-200 rounded shadow-sm p-1 transition-colors" 
            title="New Message"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full bg-gray-50 border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-[13px] text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col">
        {loading ? (
          <div className="px-4 py-8 text-center text-[13px] text-gray-400">Loading conversations...</div>
        ) : numbersCount === 0 ? (
          <div className="px-4 py-12 text-center bg-gray-50/50 mx-3 my-4 rounded-xl border border-dashed border-gray-200">
            <div className="w-10 h-10 bg-[#128C7E]/5 text-[#128C7E] rounded-full flex items-center justify-center mx-auto mb-3">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-bold text-gray-900 mb-1">No Number Linked</div>
            <p className="text-[12px] text-gray-500 mb-4 px-2">Link a WhatsApp number to start receiving messages.</p>
            <NavLink 
              to="/phones" 
              className="inline-flex items-center justify-center h-8 px-4 text-[12px] font-bold text-white bg-[#128C7E] hover:bg-[#075E54] rounded-lg transition-colors shadow-sm"
            >
              Link Now
            </NavLink>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-[13px] font-semibold text-gray-900 mb-1">No conversations yet</div>
            <p className="text-[12px] text-gray-500">Wait for or start a new conversation.</p>
          </div>
        ) : (
          conversations.map((chat: Conversation) => (
            <ConversationItem 
              key={chat.id} 
              id={String(chat.id)}
              name={chat.customerNumber} 
              lastMessage={chat.isWindowOpen ? 'Window Active' : 'Offline'}
              time={formatTime(chat.lastCustomerMessageAt || chat.createdAt)}
              avatarColor="bg-[#128C7E]"
            />
          ))
        )}
      </div>

      <NewChatModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onStart={handleStartChat} 
      />
    </div>
  );
}
