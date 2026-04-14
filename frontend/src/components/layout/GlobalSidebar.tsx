import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { 
  Search, LayoutDashboard, Plus, Inbox, Blocks, 
  Phone, Globe, Key, FileText, Waypoints, 
  Code, Megaphone, Users, CreditCard, HelpCircle, 
  ChevronLeft, ChevronRight, GitPullRequest, LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type NavItemProp = {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  highlight?: boolean;
};

const NAV_GROUPS: { title?: string; items: NavItemProp[] }[] = [
  {
    items: [
      { icon: Search, label: 'Search', path: '#search' },
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Plus, label: 'Add number', path: '/add-number' },
    ]
  },
  {
    title: 'START',
    items: [
      { icon: Inbox, label: 'Inbox', path: '/', badge: 3 },
      { icon: Blocks, label: 'Integrate', path: '/integrate' },
    ]
  },
  {
    items: [
      { icon: Phone, label: 'Phone numbers', path: '/phones' },
      { icon: Globe, label: 'Webhooks', path: '/webhooks' },
      { icon: Key, label: 'API keys', path: '/api-keys' },
      { icon: GitPullRequest, label: 'WhatsApp Flows', path: '/flows' },
      { icon: FileText, label: 'Templates', path: '/templates' },
    ]
  },
  {
    title: 'AUTOMATE',
    items: [
      { icon: Waypoints, label: 'Workflows', path: '/workflows' },
      { icon: Code, label: 'Functions', path: '/functions' },
      { icon: Megaphone, label: 'Broadcasts', path: '/broadcasts' },
    ]
  }
];

const BOTTOM_ITEMS: NavItemProp[] = [
  { icon: Users, label: 'Team members', path: '/team' },
  { icon: CreditCard, label: 'Billing', path: '/billing' },
  { icon: HelpCircle, label: 'Help', path: '/help' },
];

export function GlobalSidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const onSearchClick = () => {
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('open-spotlight'));
    }
  };

  return (
    <div 
      className={cn(
        "h-full bg-white flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-[#EDEDED] relative z-30",
        isExpanded ? "w-64" : "w-[60px]"
      )}
    >
      {/* Spacer where the logo used to be - clean Intercom style */}
      <div className="h-4" />

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-2 pb-4 pt-2">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="mb-4 last:mb-0">
            {group.title && isExpanded && (
              <h3 className="px-3 text-[10px] font-bold text-gray-400 mb-2 tracking-widest uppercase">
                {group.title}
              </h3>
            )}
            
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                item.label === 'Search' ? (
                  <button
                    key={item.label}
                    onClick={onSearchClick}
                    className={cn(
                      "flex items-center h-8 rounded-md group relative transition-colors cursor-pointer w-full text-left",
                      isExpanded ? "px-3" : "justify-center",
                      "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    <Search className={cn("shrink-0", isExpanded ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]")} strokeWidth={2.5} />
                    {isExpanded && <span className="ml-3 text-[13px] font-medium truncate flex-1 leading-none">Search</span>}
                    {isExpanded && <span className="text-[10px] text-gray-400 font-mono">⌘K</span>}
                  </button>
                ) : (
                  <SidebarItem key={item.path} item={item} isExpanded={isExpanded} />
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="border-t border-[#EDEDED] px-2 py-3 flex flex-col gap-0.5 shrink-0">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarItem key={item.path} item={item} isExpanded={isExpanded} />
        ))}
        
        {/* User / Identity */}
        <div className="mt-2 pt-2 border-t border-[#EDEDED]">
          <div className={cn(
            "flex items-center h-10 rounded-md transition-colors px-3",
            !isExpanded && "justify-center px-0"
          )}>
            <div className="w-6 h-6 rounded-full bg-[#128C7E] border border-[#128C7E]/20 flex items-center justify-center text-[10px] font-bold text-white shrink-0 uppercase shadow-sm">
              {profile?.name?.[0].toUpperCase() || profile?.email?.[0].toUpperCase() || '?'}
            </div>
            {isExpanded && (
              <div className="ml-3 flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-semibold text-gray-900 truncate">{profile?.name || 'User'}</span>
                <button 
                  onClick={handleSignOut}
                  className="text-[10px] text-gray-400 hover:text-[#128C7E] transition-colors text-left font-medium"
                >
                  Sign out
                </button>
              </div>
            )}
            {isExpanded && (
              <LogOut className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            )}
          </div>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-10 bg-white border border-[#EDEDED] rounded-full p-1 text-gray-400 hover:text-gray-900 shadow-sm z-50 transition-colors"
      >
        {isExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  );
}

function SidebarItem({ item, isExpanded }: { item: NavItemProp; isExpanded: boolean }) {
  const Icon = item.icon;
  
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center h-8 rounded-md group relative transition-colors cursor-pointer",
          isExpanded ? "px-3" : "justify-center w-full",
          isActive 
            ? "bg-gray-100 text-gray-900 font-semibold" 
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
        )
      }
      title={!isExpanded ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("shrink-0", isExpanded ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]")} strokeWidth={isActive ? 2.5 : 2} />
          
          {isExpanded && (
            <span className="ml-3 text-[13px] truncate flex-1 leading-none">
              {item.label}
            </span>
          )}
          
          {isExpanded && item.badge && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2",
              isActive ? "bg-[#128C7E] text-white" : "bg-gray-100 text-gray-500"
            )}>
              {item.badge}
            </span>
          )}
          
          {!isExpanded && item.badge && (
            <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#128C7E] ring-2 ring-white" />
          )}
        </>
      )}
    </NavLink>
  );
}
