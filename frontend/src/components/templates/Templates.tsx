import { FileText, Smartphone, RefreshCw, AlertTriangle, ChevronDown, Plus } from 'lucide-react';

export function Templates() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar pb-20">
      <div className="max-w-6xl mx-auto px-8 py-12 space-y-10">
        
        {/* Header and Context */}
        <div className="flex justify-between items-start">
           <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">WhatsApp Templates</h1>
              <div className="flex items-center gap-8 border-b border-[#EDEDED]">
                <button className="pb-3 text-[14px] font-bold text-[#128C7E] border-b-2 border-[#128C7E]">Playbooks</button>
              </div>
           </div>
           
           <div className="flex flex-col items-end gap-3">
             <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Phone number</div>
             <div className="flex items-center gap-3 p-2 border border-gray-200 rounded-xl bg-gray-50/50 shadow-sm min-w-[240px]">
               <div className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                 <Smartphone className="w-4 h-4 text-[#128C7E]" />
               </div>
               <div className="flex-1 flex flex-col">
                 <span className="text-[13px] font-bold text-gray-900 leading-tight">Sandbox WhatsApp</span>
                 <span className="text-[11px] text-gray-500 font-medium">597907523413541</span>
               </div>
               <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
             </div>
           </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex items-center justify-between gap-4 py-2">
           <div className="flex items-center gap-3">
              <FilterTab label="All statuses" />
              <FilterTab label="All categories" />
           </div>

           <div className="flex items-center gap-3 flex-1 max-w-sm justify-end">
              <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-gray-500" title="Sync">
                <RefreshCw className="w-4 h-4" />
              </button>
           </div>
        </div>

        {/* Empty State / Sandbox Warning */}
        <div className="p-12 border border-[#EDEDED] rounded-2xl bg-gray-50/30 flex flex-col items-center justify-center space-y-8 min-h-[400px]">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
               <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[16px] font-bold text-gray-900">No templates found</h3>
              <p className="text-[13px] text-gray-500 font-medium max-w-xs mx-auto leading-relaxed">
                Template sending is disabled for sandbox numbers.
              </p>
            </div>
          </div>

          <div className="max-w-md w-full p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 shadow-sm">
             <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
             <div className="space-y-3">
                <p className="text-[13px] text-amber-800 font-medium leading-relaxed">
                  Please connect a production phone number to create and send WhatsApp templates.
                </p>
                <button className="px-4 py-2 bg-white border border-amber-200 text-amber-700 text-[12px] font-bold rounded-lg shadow-sm hover:bg-amber-100/50 transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add new number
                </button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FilterTab({ label }: { label: string }) {
  return (
    <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 flex items-center gap-2 bg-white hover:bg-gray-50 transition-all shadow-sm">
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  );
}
