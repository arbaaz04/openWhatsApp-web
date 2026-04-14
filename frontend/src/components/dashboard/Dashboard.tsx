import React from 'react';
import { 
  Plus, Key, Globe, Waypoints, ExternalLink, 
  Package, Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dashboard() {
  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar pb-20">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#EDEDED]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider border border-gray-200">
              Free
            </span>
            <button className="text-[12px] font-semibold text-[#128C7E] hover:underline">
              Upgrade
            </button>
          </div>
          
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            {['Today', 'This week', 'This month'].map((label) => (
              <button
                key={label}
                className={cn(
                  "px-3 py-1 text-[12px] font-medium rounded-md transition-all",
                  label === 'This week' ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[13px] text-gray-500 font-medium">
          Apr 7 - Apr 13, 2026
        </div>
      </div>

      <div className="px-8 py-8 space-y-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Numbers" 
            value="0" 
            footer={<button className="text-[#128C7E] font-medium">Add free number →</button>}
          />
          <StatCard 
            title="Messages" 
            value="8" 
            footer={<span className="text-gray-400">↓ 4 in · ↑ 4 out</span>}
          />
          <StatCard 
            title="Conversations" 
            value="3" 
            footer={<span className="text-green-600 font-medium">1 active</span>}
          />
          <StatCard 
            title="Workflows" 
            value="0 runs" 
            footer={<span className="text-gray-400">All successful</span>}
          />
        </div>

        {/* Daily Messages Chart Section */}
        <div className="space-y-4">
          <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-widest">Daily messages</h2>
          <div className="h-48 w-full bg-gray-50 rounded-xl border border-[#EDEDED] flex flex-col items-center justify-center relative overflow-hidden group">
             {/* Simple SVG Chart Background */}
             <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
               <path d="M0 100 L100 80 L200 90 L300 40 L400 60 L500 20 L600 70 L700 85 L800 95 L900 100" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
             </svg>
             <Activity className="w-8 h-8 text-gray-300 mb-2 group-hover:text-[#128C7E] transition-colors" />
             <p className="text-[13px] text-gray-400 font-medium tracking-wide">Ready to track your first message</p>
          </div>
        </div>

        {/* Quick Actions & Documentation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-widest">QUICK ACTIONS</h2>
            <div className="space-y-3">
              <QuickAction 
                icon={Plus} 
                title="Add phone number" 
                desc="We provide it for you" 
              />
              <QuickAction 
                icon={Key} 
                title="Create API key" 
                desc="Integrate via API" 
              />
              <QuickAction 
                icon={Globe} 
                title="Create webhook" 
                desc="Get notified of messages" 
              />
              <QuickAction 
                icon={Waypoints} 
                title="Create workflow" 
                desc="AI agents & automations" 
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-widest">Documentation</h2>
            <div className="p-5 border border-[#EDEDED] rounded-xl space-y-5 bg-gray-50/30">
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <h3 className="text-[14px] font-bold text-gray-900 flex items-center justify-between">
                    CLI & Skills <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </h3>
                  <div className="bg-[#18181B] rounded-lg p-3 font-mono text-[12px] text-gray-300 space-y-1">
                    <div className="text-[#128C7E]">npm install -g @kapso/cli</div>
                    <div className="text-gray-500">npx skills add gokapso/agent-skills</div>
                    <div className="text-gray-500">kapso setup</div>
                  </div>
                </div>
              </div>
              <div className="h-px bg-[#EDEDED]" />
              <div className="flex items-center justify-between group cursor-pointer text">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-[#EDEDED] shadow-sm">
                    <Package className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="text-[14px] font-bold text-gray-900">MCP & Docs</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Messages Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-widest">Recent messages</h2>
             <button className="text-[12px] font-bold text-[#128C7E]">View inbox</button>
          </div>
          
          <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#EDEDED]">
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Direction</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Content</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED]">
                <TableRow phone="923201268955" contact="arbaaz" direction="outbound" status="read" content="hi" time="12 Apr at 23:59" />
                <TableRow phone="923201268955" contact="arbaaz" direction="inbound" status="—" content="HEY" time="12 Apr at 23:59" />
                <TableRow phone="923201268955" contact="arbaaz" direction="inbound" status="—" content="Hi" time="11 Apr at 16:45" />
                <TableRow phone="923201268955" contact="arbaaz" direction="inbound" status="—" content="Aa" time="10 Apr at 13:01" />
                <TableRow phone="923201268955" contact="arbaaz" direction="outbound" status="read" content="aa" time="10 Apr at 13:01" />
                <TableRow phone="923201268955" contact="arbaaz" direction="outbound" status="read" content="hi" time="10 Apr at 12:43" />
                <TableRow phone="923201268955" contact="arbaaz" direction="inbound" status="—" content="Reply & verify" time="10 Apr at 12:40" />
                <TableRow phone="923201268955" contact="arbaaz" direction="outbound" status="read" content="Your WhatsApp API is live! 🎉 Reply to ..." time="10 Apr at 12:39" />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, footer }: { title: string; value: string; footer: React.ReactNode }) {
  return (
    <div className="p-5 border border-[#EDEDED] rounded-xl space-y-3 bg-white shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="text-[12px] font-medium">{footer}</div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ElementType;
  title: string;
  desc: string;
}

function QuickAction({ icon: Icon, title, desc }: QuickActionProps) {
  return (
    <div className="flex items-center gap-4 p-4 border border-[#EDEDED] rounded-xl hover:border-[#128C7E]/30 hover:bg-[#128C7E]/5 transition-all cursor-pointer group shadow-sm">
      <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg group-hover:bg-white group-hover:border-[#128C7E]/20 transition-colors shadow-sm">
        <Icon className="w-5 h-5 text-gray-500 group-hover:text-[#128C7E] transition-colors" />
      </div>
      <div className="flex-1">
        <h4 className="text-[14px] font-bold text-gray-900 group-hover:text-[#128C7E] transition-colors">{title}</h4>
        <p className="text-[12px] text-gray-500 font-medium">{desc}</p>
      </div>
      <Plus className="w-4 h-4 text-gray-300 group-hover:text-[#128C7E]" />
    </div>
  );
}

interface TableRowProps {
  phone: string;
  contact: string;
  direction: string;
  status: string;
  content: string;
  time: string;
}

function TableRow({ phone, contact, direction, status, content, time }: TableRowProps) {
  const isOut = direction === 'outbound';
  return (
    <tr className="hover:bg-gray-50/80 transition-colors">
      <td className="px-4 py-3 text-[13px] font-medium text-gray-900 font-mono tracking-tighter">{phone}</td>
      <td className="px-4 py-3 text-[13px] font-bold text-[#128C7E]">{contact}</td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
          isOut ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
        )}>
          {direction}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-[12px] font-medium text-gray-500 capitalize">{status}</td>
      <td className="px-4 py-3 text-[13px] text-gray-600 max-w-xs truncate font-medium">{content}</td>
      <td className="px-4 py-3 text-[11px] font-bold text-gray-400 text-right">{time}</td>
    </tr>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
