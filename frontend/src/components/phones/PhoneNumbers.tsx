import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Info, Cpu, CheckCircle2, Loader2, ExternalLink, Activity } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { MetaSignupButton } from '../MetaSignupButton.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Channel {
  id: number;
  teamId: number;
  type: 'sim' | 'business_app';
  phoneNumber: string | null;
  businessName: string | null;
  whatsappId: string | null;
  wabaId: string | null;
  status: 'active' | 'paused' | 'disabled';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PhoneNumbers() {
  const { session, teams } = useAuth();
  const teamId = teams[0]?.teamId;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          ...(init?.headers || {}),
        },
      }),
    [apiUrl, session?.access_token]
  );

  const fetchChannels = useCallback(async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setError(null);
      // Path aligned with backend mounting point /api/teams/:teamId/channels
      const res = await authFetch(`/api/teams/${teamId}/channels`);
      if (!res.ok) throw new Error(`Failed to load channels (${res.status})`);
      const data = await res.json();
      setChannels(data.channels);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, teamId]);

  const handleDisconnect = async (channelId: number) => {
    if (!teamId || !window.confirm('Are you sure you want to disconnect this number? This will stop all active automations for this line.')) return;
    
    try {
      const res = await authFetch(`/api/teams/${teamId}/channels/${channelId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to disconnect channel');
      
      // Refresh list
      fetchChannels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-12 pb-24">
        {/* Header Section */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {channels.length > 0 ? 'Managed WhatsApp Lines' : 'Connect number to WhatsApp'}
          </h1>
          <p className="text-[14px] text-gray-500 max-w-xl font-medium leading-relaxed">
            {channels.length > 0 
              ? `You have ${channels.length} active connection${channels.length > 1 ? 's' : ''} linking your business to WhatFlow.`
              : 'Choose how you want to connect WhatsApp to WhatFlow Web. Official WhatsApp Cloud API recommended.'}
            <span className="text-[#128C7E] ml-1 cursor-pointer hover:underline">Official WhatsApp Cloud API recommended</span>
          </p>
          <button className="text-[12px] font-bold text-[#128C7E] flex items-center gap-1.5 hover:underline">
            <Info className="w-3.5 h-3.5" />
            Learn more
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <Loader2 className="w-8 h-8 text-[#128C7E] animate-spin mb-4" />
            <p className="text-gray-400 font-medium tracking-wide">Syncing your lines...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-medium text-sm flex items-center gap-3">
            <Activity className="w-4 h-4" />
            {error}
            <button onClick={fetchChannels} className="ml-auto underline">Retry</button>
          </div>
        )}

        {/* Connected Channels List */}
        {!loading && channels.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {channels.map((channel) => (
                <ChannelCard 
                  key={channel.id} 
                  channel={channel} 
                  onDisconnect={() => handleDisconnect(channel.id)} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Connection Options Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[#EDEDED]" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              {channels.length > 0 ? 'Add New Connection' : 'Get Started'}
            </span>
            <div className="h-px flex-1 bg-[#EDEDED]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ConnectionCard 
              icon={Smartphone}
              title="Connect WhatsApp Business App"
              desc="Link your official WhatsApp Business account via Meta. Automatic discovery of phone numbers and business profiles."
              badge="Official"
              action={<MetaSignupButton />}
            />
            
            <ConnectionCard 
              icon={Cpu}
              title="Connect my own SIM card"
              desc="Use your number and verify with a text code (Hardware gateway required)."
              badge="Coming Soon"
              badgeSecondary
              action={
                <button disabled className="text-[13px] font-bold text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 cursor-not-allowed">
                  Hardware Required
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChannelCard({ channel, onDisconnect }: { channel: Channel, onDisconnect: () => void }) {
  const isActive = channel.status === 'active';
  
  return (
    <div className="group bg-white border border-[#EDEDED] rounded-3xl transition-all hover:shadow-lg hover:border-[#128C7E]/20 overflow-hidden">
      <div className="p-8 space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl group-hover:bg-[#128C7E]/5 transition-colors">
                <Smartphone className={cn("w-5 h-5", isActive ? "text-[#128C7E]" : "text-gray-400")} />
              </div>
              {isActive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
              )}
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
              isActive ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
            )}>
              {isActive ? 'Connected' : channel.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
             <button 
              onClick={onDisconnect}
              className="text-[12px] font-bold text-red-500 hover:text-red-600 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-all"
             >
              Disconnect
             </button>
             <a 
              href="/chat" 
              className="flex items-center gap-1.5 text-[#128C7E] hover:text-[#075E54] text-[13px] font-bold px-3 py-1.5 hover:bg-[#128C7E]/5 rounded-lg transition-all"
            >
              View Inbox <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Info Grid - Styled after whatflow-official-api */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Business Name</p>
            <p className="text-[15px] font-bold text-gray-900 tracking-tight leading-none h-5">
              {channel.businessName || 'WhatsApp Business'}
            </p>
          </div>
          
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
            <p className="text-[15px] font-bold text-gray-900 tracking-tight leading-none h-5 flex items-center gap-1.5">
              {channel.phoneNumber || '—'}
              {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">WABA ID</p>
            <p className="text-[15px] font-bold text-gray-900 tracking-tight leading-none h-5">
              {channel.wabaId || '—'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer Meta */}
      <div className="bg-gray-50/50 px-8 py-3 border-t border-[#EDEDED] flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium tracking-wide">
          Meta Verified • Official Cloud API
        </span>
        <span className="text-[11px] text-gray-300 font-medium">
          Line ID: {channel.whatsappId}
        </span>
      </div>
    </div>
  );
}

interface ConnectionCardProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  badge: string;
  badgeSecondary?: boolean;
  action: React.ReactNode;
}

function ConnectionCard({ icon: Icon, title, desc, badge, badgeSecondary, action }: ConnectionCardProps) {
  return (
    <div className="p-8 border border-[#EDEDED] rounded-3xl transition-all flex flex-col h-full bg-white shadow-sm hover:shadow-md border-b-4 hover:border-b-[#128C7E]/40">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
          <Icon className="w-6 h-6 text-gray-600" />
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
          badgeSecondary 
            ? "bg-amber-50 text-amber-600 border-amber-200" 
            : "bg-[#128C7E]/5 text-[#128C7E] border-[#128C7E]/20"
        )}>
          {badge}
        </span>
      </div>

      <div className="flex-1 space-y-3">
        <h3 className="text-[17px] font-bold text-gray-900 italic-none">{title}</h3>
        <p className="text-[14px] text-gray-500 font-medium leading-relaxed">{desc}</p>
      </div>

      <div className="mt-10">
        {action}
      </div>
    </div>
  );
}


