import { Plus, ShieldCheck, Lock } from 'lucide-react';

export function ApiKeys() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div className="flex justify-between items-end border-b border-[#EDEDED] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">API Keys</h1>
            <p className="text-[14px] text-gray-500 font-medium">Manage API keys for programmatic access to this project's resources.</p>
          </div>
          <button className="h-9 px-4 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all">
            <Plus className="w-4 h-4" />
            Create new API key
          </button>
        </div>

        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
             </div>
             <h2 className="text-[15px] font-bold text-gray-900">Project API Keys</h2>
          </div>

          {/* Empty State */}
          <div className="py-20 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center space-y-4 bg-gray-50/20">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200 shadow-inner">
               <Lock className="w-6 h-6 text-gray-300" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-[15px] font-bold text-gray-900">No API Keys</h3>
              <p className="text-[13px] text-gray-500 font-medium">You haven't created any API keys for this project yet.</p>
            </div>
            <button className="px-6 py-2 bg-white border border-[#EDEDED] text-[#128C7E] text-[13px] font-bold rounded-lg shadow-sm hover:shadow-md transition-all mt-2">
              Create API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
