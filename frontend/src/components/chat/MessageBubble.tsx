import { Reply } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Message {
  id: string;
  body: string;
  senderName?: string;
}

interface MessageBubbleProps {
  id: string;
  body: string;
  direction: 'incoming' | 'outgoing';
  time: string;
  avatarInitial?: string;
  isFirstInRun?: boolean;
  replyTo?: Message | null;
  onReply?: (msg: Message) => void;
  senderName?: string;
  type?: 'text' | 'business';
}

export function MessageBubble({ 
  id, 
  body, 
  direction, 
  time, 
  avatarInitial, 
  isFirstInRun = true,
  replyTo,
  onReply,
  senderName,
  type = 'text'
}: MessageBubbleProps) {
  const isOut = direction === 'outgoing';

  return (
    <div className={cn(
      'flex items-start gap-2 w-full mb-0.5 group relative', 
      isOut ? 'justify-end' : 'justify-start', 
      isFirstInRun ? 'mt-3' : ''
    )}>
      
      {!isOut && (
        <div className="w-6 h-6 shrink-0 flex items-center justify-center mt-1">
          {isFirstInRun && (
            <div className="w-6 h-6 rounded bg-[#128C7E] text-white text-[10px] font-medium flex items-center justify-center">
              {avatarInitial || 'A'}
            </div>
          )}
        </div>
      )}

      <div className={cn("max-w-[85%] flex flex-col relative", isOut ? "items-end" : "items-start")}>
        
        {/* Reply Action Trigger */}
        <button 
          onClick={() => onReply?.({ id, body, senderName })}
          className={cn(
            "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm text-gray-400 hover:text-[#128C7E] z-10",
            isOut ? "-left-10" : "-right-10"
          )}
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        <div
          className={cn(
            'px-3.5 py-2 text-[13px] leading-relaxed relative overflow-hidden',
            isOut
              ? 'bg-[#128C7E] text-white'
              : 'bg-white text-gray-900 border border-gray-200/60 shadow-sm',
              
            'rounded-lg',
            isOut && !isFirstInRun && 'rounded-tr-none',
            !isOut && !isFirstInRun && 'rounded-tl-none',
            isOut && isFirstInRun && 'border-b border-[#075E54]/20'
          )}
        >
          {/* Business Type Header */}
          {type === 'business' && (
             <div className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
               Business
             </div>
          )}

          {/* Quoted Message Block */}
          {replyTo && (
            <div className={cn(
              "p-2 mb-2 rounded border-l-4 text-[11px] leading-snug line-clamp-2",
              isOut ? "bg-black/10 border-white/40 text-white/80" : "bg-gray-100 border-gray-300 text-gray-500"
            )}>
              {replyTo.senderName && <span className="font-bold block mb-0.5">{replyTo.senderName}</span>}
              {replyTo.body}
            </div>
          )}

          <div className="whitespace-pre-wrap">{body}</div>
          
          {/* Inline Timestamp */}
          <div className={cn(
            "text-[10px] mt-1 flex justify-end",
            isOut ? "text-white/60" : "text-gray-400"
          )}>
            {time}
          </div>
        </div>
      </div>
    </div>
  );
}
