import { Outlet } from 'react-router-dom';
import { GlobalSidebar } from './GlobalSidebar';
import { CommandPalette } from './CommandPalette';

export function DashboardLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white selection:bg-[#128C7E]/20">
      <CommandPalette />
      <GlobalSidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Child routes (Inbox List + Chat Pane, or Dashboard/Other pages) */}
        <Outlet />
      </div>
    </div>
  );
}
