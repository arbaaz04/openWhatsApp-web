import { Rocket } from 'lucide-react';

export function ComingSoon({ title }: { title?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white p-10 select-none">
      <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center border border-[#EDEDED] shadow-sm mb-6 rotate-3">
         <Rocket className="w-10 h-10 text-gray-300" />
      </div>
      <div className="text-center space-y-2">
         <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title || 'Coming Soon'}</h2>
         <p className="text-[14px] text-gray-500 font-medium max-w-sm leading-relaxed">
            We are hard at work building this module. Sign up for our newsletter to be notified when it launches.
         </p>
      </div>
      <div className="mt-10 flex gap-4">
         <div className="w-2 h-2 rounded-full bg-gray-200"></div>
         <div className="w-2 h-2 rounded-full bg-gray-200"></div>
         <div className="w-2 h-2 rounded-full bg-[#128C7E]"></div>
      </div>
    </div>
  );
}
