import { Smartphone, Info, ChevronRight, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

export function PhoneNumbers() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Connect number to WhatsApp</h1>
          <p className="text-[14px] text-gray-500 max-w-xl font-medium leading-relaxed">
            Choose how you want to connect WhatsApp to WhatFlow Web. 
            <span className="text-[#128C7E] ml-1 cursor-pointer hover:underline">No SIM card or verification code needed</span>
          </p>
          <button className="text-[12px] font-bold text-[#128C7E] flex items-center gap-1.5 hover:underline">
            <Info className="w-3.5 h-3.5" />
            Learn more
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ConnectionCard 
            icon={Cpu}
            title="Connect my own SIM card"
            desc="Use your number and verify with a text code"
            badge="Recommended"
          />
          <ConnectionCard 
            icon={Smartphone}
            title="Connect WhatsApp Business App"
            desc="Use your existing WhatsApp Business app phone number."
            badge="Unstable"
            badgeSecondary
          />
        </div>
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
}

function ConnectionCard({ icon: Icon, title, desc, badge, badgeSecondary }: ConnectionCardProps) {
  return (
    <div className="p-6 border border-[#EDEDED] rounded-2xl hover:border-[#128C7E]/40 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full bg-white shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl group-hover:bg-white group-hover:border-[#128C7E]/20 transition-colors shadow-sm">
          <Icon className="w-6 h-6 text-gray-500 group-hover:text-[#128C7E] transition-colors" />
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors",
          badgeSecondary 
            ? "bg-amber-50 text-amber-600 border-amber-200" 
            : "bg-[#128C7E]/5 text-[#128C7E] border-[#128C7E]/20"
        )}>
          {badge}
        </span>
      </div>

      <div className="flex-1 space-y-2">
        <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-[#128C7E] transition-colors italic-none">{title}</h3>
        <p className="text-[13px] text-gray-500 font-medium leading-relaxed">{desc}</p>
      </div>

      <div className="mt-8 flex items-center justify-between group/btn">
        <span className="text-[12px] font-bold text-[#128C7E] group-hover:mr-2 transition-all">Learn more</span>
        <div className="p-2 bg-gray-50 rounded-full group-hover:bg-[#128C7E] group-hover:text-white transition-all shadow-sm">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}


