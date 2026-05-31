import { useState } from 'react';
import { Paperclip, Smile, Send, X, FileText, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  body: string;
  senderName?: string;
}

interface ComposerProps {
  replyTo?: Message | null;
  onCancelReply?: () => void;
  onSend?: (body: string, replyToId?: string) => void;
  onToggleTemplates?: () => void;
  isExpired?: boolean;
  onTyping?: () => void;
}

export function Composer({
  replyTo,
  onCancelReply,
  onSend,
  onToggleTemplates,
  isExpired = false,
  onTyping
}: ComposerProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend?.(text.trim(), replyTo?.id);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-[#E5E7EB] p-3 flex flex-col shrink-0 relative z-20">
      {isExpired ? (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100/90 text-amber-700 rounded-lg shrink-0 mt-0.5 md:mt-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-amber-900 mb-0.5">24-Hour Messaging Window Closed</h4>
              <p className="text-[12px] text-amber-700 font-medium leading-relaxed max-w-xl">
                You can only send template messages to this customer because it has been more than 24 hours since their last message. Regular messages will become available once the customer responds.
              </p>
            </div>
          </div>
          <button
            onClick={onToggleTemplates}
            className="w-full md:w-auto px-4 py-2.5 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 group active:scale-[0.98] cursor-pointer"
          >
            <FileText className="w-4 h-4 group-hover:scale-105 transition-transform" />
            Send Template
          </button>
        </div>
      ) : (
        <>
          {/* Reply Context Bar */}
          {replyTo && (
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-[#E5E7EB] border-b-0 rounded-t-md animate-in slide-in-from-bottom-2 duration-200">
              <div className="w-1 bg-[#128C7E] h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[#128C7E]">Replying to {replyTo.senderName || 'Contact'}</div>
                <p className="text-[12px] text-gray-500 truncate">{replyTo.body}</p>
              </div>
              <button 
                onClick={onCancelReply}
                className="p-1 px-3 hover:bg-gray-200 rounded-md transition-colors text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className={cn(
            "border border-[#E5E7EB] rounded-md focus-within:border-[#128C7E] focus-within:ring-1 focus-within:ring-[#128C7E] transition-all bg-white relative",
            replyTo ? "rounded-t-none" : "rounded-md"
          )}>
            <textarea
              placeholder={replyTo ? "Type a reply..." : "Type a message..."}
              className="w-full bg-transparent border-none outline-none resize-none max-h-32 min-h-[60px] py-2.5 px-3 text-[13px] text-gray-900 placeholder:text-gray-500 font-medium"
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onTyping?.();
              }}
              onKeyDown={handleKeyDown}
            />
            
            {/* Formatting / Action Toolbar */}
            <div className="flex items-center justify-between border-t border-gray-50 bg-gray-50/50 px-2 py-1.5 rounded-b-md">
              <div className="flex items-center gap-0.5">
                <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Insert emoji">
                  <Smile className="w-4 h-4" />
                </button>
                <div className="w-px h-3.5 bg-gray-200 mx-0.5"></div>
                <button 
                  onClick={onToggleTemplates}
                  className="p-1.5 text-[#128C7E] hover:bg-[#128C7E]/5 rounded transition-colors flex items-center gap-1" 
                  title="WhatsApp Templates"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Templates</span>
                </button>
              </div>
              <button 
                onClick={handleSend}
                className="px-3 py-1.5 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
