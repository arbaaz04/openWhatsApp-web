import { useState, useEffect } from 'react';
import { X, Search, FileText, Send, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
}

interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  components: TemplateComponent[];
}

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (payload: Record<string, unknown>) => void;
  channelId: string | number;
  teamId: string | number;
}

export function TemplatePicker({ isOpen, onClose, onSelect, channelId, teamId }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const { session } = useAuth();

  useEffect(() => {
    async function fetchTemplates() {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/api/teams/${teamId}/channels/${channelId}/templates`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch templates');
        const data = await res.json() as { success: boolean; templates: Template[] };
        if (data.success) {
          setTemplates(data.templates.filter((t) => t.status === 'APPROVED'));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (isOpen && channelId && teamId && session) {
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, channelId, teamId, session?.user?.id]);

  const filtered = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const getVariablesCount = (template: Template) => {
    const body = template.components.find(c => c.type === 'BODY');
    if (!body || !body.text) return 0;
    const matches = body.text.match(/{{(\d+)}}/g);
    return matches ? matches.length : 0;
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    
    // Construct the Meta template payload
    const bodyParams = Object.keys(variables)
      .sort((a,b) => Number(a) - Number(b))
      .map(key => ({
        type: 'text',
        text: variables[key]
      }));

    const payload = {
      type: 'template',
      template: {
        name: selectedTemplate.name,
        language: { code: selectedTemplate.language },
        components: bodyParams.length > 0 ? [
          {
            type: 'body',
            parameters: bodyParams
          }
        ] : []
      }
    };

    onSelect(payload);
    onClose();
    setSelectedTemplate(null);
    setVariables({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">WhatsApp Templates</h3>
            <p className="text-[12px] text-gray-500">Select an approved template to send.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors order-last">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar: Template List */}
          <div className="w-[280px] border-r border-gray-100 flex flex-col bg-gray-50/30">
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-[12px]">Loading...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                   <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                   <p className="text-[12px] text-red-500 font-medium">{error}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-[12px]">No templates found</div>
              ) : (
                filtered.map(t => (
                  <button
                    key={t.name}
                    onClick={() => {
                      setSelectedTemplate(t);
                      setVariables({});
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-3",
                      selectedTemplate?.name === t.name 
                        ? "bg-[#128C7E] text-white shadow-md shadow-[#128C7E]/20" 
                        : "hover:bg-white hover:shadow-sm"
                    )}
                  >
                    <FileText className={cn("w-4 h-4 mt-0.5 shrink-0", selectedTemplate?.name === t.name ? "text-white" : "text-gray-400")} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold truncate capitalize">{t.name.replaceAll('_', ' ')}</div>
                      <div className={cn("text-[11px] truncate", selectedTemplate?.name === t.name ? "text-white/80" : "text-gray-400")}>
                        {t.category}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Content: Template Preview & Variables */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedTemplate ? (
              <div className="flex-1 flex flex-col p-6 min-h-0">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[14px] font-bold text-gray-900 capitalize">
                    {selectedTemplate.name.replaceAll('_', ' ')}
                  </h4>
                  <span className="px-2 py-1 bg-green-50 text-green-600 text-[11px] font-bold rounded-lg border border-green-100">
                    Approved
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {/* Preview Section */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Message Preview</label>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                      <div className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {selectedTemplate.components.find(c => c.type === 'BODY')?.text?.split(/{{(\d+)}}/).map((part, i) => {
                          if (i % 2 === 1) {
                            return (
                              <span key={i} className="inline-block px-1.5 py-0.5 bg-[#128C7E]/10 text-[#128C7E] rounded font-bold border border-[#128C7E]/20 mx-0.5">
                                {variables[part] || `{{${part}}}`}
                              </span>
                            );
                          }
                          return part;
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Variables Input Section */}
                  {getVariablesCount(selectedTemplate) > 0 && (
                    <div className="space-y-4">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fill Parameters</label>
                      <div className="space-y-3">
                        {Array.from({ length: getVariablesCount(selectedTemplate) }).map((_, i) => (
                          <div key={i+1} className="space-y-1.5">
                            <span className="text-[12px] font-bold text-gray-600">Variable &#123;&#123;{i+1}&#125;&#125;</span>
                            <input
                              type="text"
                              placeholder={`Enter value for parameter ${i+1}...`}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20 transition-all"
                              value={variables[i+1] || ''}
                              onChange={(e) => setVariables(prev => ({ ...prev, [i+1]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-gray-100 mt-auto flex justify-end gap-3 shrink-0">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 text-[13px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSend}
                    className="px-6 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded-xl shadow-lg shadow-[#128C7E]/20 transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 border border-gray-100">
                   <FileText className="w-8 h-8 text-gray-200" />
                </div>
                <h4 className="text-[15px] font-bold text-gray-900 mb-1">Preview Message</h4>
                <p className="text-[12px] max-w-[240px]">Select a template from the list on the left to see a preview and fill parameters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
