import { Smartphone, Info, ChevronRight, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MetaSignupButton } from '../MetaSignupButton';

export function PhoneNumbers() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Connect number to WhatsApp</h1>
          <p className="text-[14px] text-gray-500 max-w-xl font-medium leading-relaxed">
            Choose how you want to connect WhatsApp to WhatFlow Web. 
            <span className="text-[#128C7E] ml-1 cursor-pointer hover:underline">Official WhatsApp Cloud API recommended</span>
          </p>
          <button className="text-[12px] font-bold text-[#128C7E] flex items-center gap-1.5 hover:underline">
            <Info className="w-3.5 h-3.5" />
            Learn more
          </button>
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


