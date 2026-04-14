import { Info, RefreshCw, Plus, Database } from 'lucide-react';

export function Flows() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto px-8 py-12 space-y-10">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">WhatsApp Flows</h1>
            <button className="text-[12px] font-bold text-[#128C7E] flex items-center gap-1.5 hover:underline">
              <Info className="w-3.5 h-3.5" />
              What's this?
            </button>
            <p className="text-[13px] text-gray-500 max-w-xl font-medium leading-relaxed">
              WhatsApp Flows allow you to create interactive forms and collect structured data from users. 
              <span className="text-gray-900 ml-1 cursor-pointer hover:underline font-bold">Learn more</span>
            </p>
          </div>
          
          <div className="flex gap-3">
             <button className="h-9 px-4 bg-white border border-gray-200 text-gray-700 text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-2 hover:bg-gray-50 transition-all">
               <RefreshCw className="w-4 h-4 text-gray-400" />
               Sync from Meta
             </button>
             <button className="h-9 px-4 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all">
               <Plus className="w-4 h-4" />
               Create Flow
             </button>
          </div>
        </div>

        <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-[#EDEDED]">
              <tr>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-widest">Flows</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-widest text-right">Responses</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2} className="py-24">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-50">
                    <Database className="w-8 h-8 text-gray-300" />
                    <span className="text-[14px] font-medium text-gray-400 font-mono">No data available</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
