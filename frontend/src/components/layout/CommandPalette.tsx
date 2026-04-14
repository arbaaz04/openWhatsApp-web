import { useState, useEffect, useCallback } from 'react';
import { Search, Command, X, LayoutDashboard, Inbox, Phone, Key, GitPullRequest, FileText, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SUGGESTIONS = [
  { icon: LayoutDashboard, label: 'Go to Dashboard', path: '/dashboard', category: 'Navigation' },
  { icon: Inbox, label: 'View Inbox', path: '/', category: 'Navigation' },
  { icon: Phone, label: 'Manage Phone Numbers', path: '/phones', category: 'Configuration' },
  { icon: Key, label: 'API Keys', path: '/api-keys', category: 'Configuration' },
  { icon: GitPullRequest, label: 'WhatsApp Flows', path: '/flows', category: 'WhatsApp' },
  { icon: FileText, label: 'View Templates', path: '/templates', category: 'WhatsApp' },
  { icon: User, label: 'Team Settings', path: '/team', category: 'Account' },
  { icon: Settings, label: 'Billing & Account', path: '/billing', category: 'Account' },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-spotlight', handleCustomOpen);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-spotlight', handleCustomOpen);
    };
  }, [toggle]);

  const onSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) return null;

  const filtered = SUGGESTIONS.filter(item => 
    item.label.toLowerCase().includes(query.toLowerCase()) || 
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 cursor-default">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[640px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center px-5 h-16 border-b border-gray-100 shrink-0">
          <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search commands, pages, and actions..."
            className="flex-1 bg-transparent border-none outline-none text-[16px] text-gray-900 placeholder:text-gray-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1.5 ml-4">
            <kbd className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-500 shadow-sm">ESC</kbd>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 max-h-[480px] overflow-y-auto no-scrollbar p-2 py-3">
          {filtered.length > 0 ? (
            <div className="space-y-4">
              {['Navigation', 'WhatsApp', 'Configuration', 'Account'].map(cat => {
                const items = filtered.filter(f => f.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="space-y-1">
                    <h4 className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</h4>
                    {items.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => onSelect(item.path)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl group transition-all text-left"
                      >
                        <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all shadow-sm">
                          <item.icon className="w-4 h-4 text-gray-400 group-hover:text-[#128C7E]" />
                        </div>
                        <span className="text-[14px] font-semibold text-gray-700 group-hover:text-gray-900">{item.label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
             <div className="py-20 text-center space-y-2 opacity-50">
               <Command className="w-10 h-10 text-gray-300 mx-auto" />
               <p className="text-[14px] font-medium text-gray-400">No results found for "{query}"</p>
             </div>
          )}
        </div>

        <div className="h-10 px-5 bg-gray-50 border-t border-gray-100 flex items-center gap-4 shrink-0">
           <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
             <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200">⏎</kbd>
             <span>Select</span>
           </div>
           <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
             <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200">↑↓</kbd>
             <span>Navigate</span>
           </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
