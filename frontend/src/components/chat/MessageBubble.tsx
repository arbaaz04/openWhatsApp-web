import { useState, useEffect } from 'react';
import { Reply, File, Download, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

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
  conversationId?: string;
  media?: {
    type: 'image' | 'video' | 'voice' | 'audio' | 'document';
    id: string;
    caption: string;
  };
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
  type = 'text',
  conversationId,
  media
}: MessageBubbleProps) {
  const isOut = direction === 'outgoing';
  const { session } = useAuth();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!media);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!media || !conversationId || !session?.access_token) return;

    let active = true;
    let createdUrl: string | null = null;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const url = `${apiUrl}/api/conversations/${conversationId}/media/${media.id}`;

    // Defer setting state to satisfy ESLint set-state-in-effect warning
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError(false);
      }
    });

    fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch media');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setMediaUrl(createdUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching media:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.id, conversationId, session?.access_token]);

  const renderMedia = () => {
    if (!media) return null;

    if (loading) {
      return (
        <div className="flex items-center gap-2 py-4 px-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#128C7E]" />
          <span className="text-[12px] font-medium">Loading media...</span>
        </div>
      );
    }

    if (error || !mediaUrl) {
      return (
        <div className="text-[12px] text-red-500 py-2 px-1 font-semibold flex items-center gap-1.5">
          <span>Failed to load media</span>
        </div>
      );
    }

    switch (media.type) {
      case 'image':
        return (
          <div className="rounded-lg overflow-hidden border border-gray-100/60 shadow-sm max-w-full my-1.5 transition-transform hover:scale-[1.01] duration-200">
            <img 
              src={mediaUrl} 
              alt={media.caption || 'Image attachment'} 
              className="max-h-[300px] w-auto object-cover max-w-full block cursor-pointer"
              onClick={() => window.open(mediaUrl, '_blank')}
            />
          </div>
        );
      case 'video':
        return (
          <div className="rounded-lg overflow-hidden border border-gray-100/60 shadow-sm max-w-full my-1.5">
            <video 
              src={mediaUrl} 
              controls 
              className="max-h-[300px] w-full max-w-sm block object-contain bg-black"
            />
          </div>
        );
      case 'voice':
      case 'audio':
        return (
          <div className="my-1.5 py-1 px-0.5 min-w-[240px] sm:min-w-[280px]">
            <audio 
              src={mediaUrl} 
              controls 
              className="w-full h-8 block"
            />
          </div>
        );
      case 'document':
        return (
          <div className="my-1.5 p-3 rounded-lg border border-gray-200/80 bg-gray-50 flex items-center justify-between gap-4 max-w-xs transition-colors hover:bg-gray-100/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                <File className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="text-[12px] font-bold text-gray-900 truncate leading-snug">
                  {media.caption || 'Document'}
                </span>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mt-0.5">
                  PDF / DOC
                </span>
              </div>
            </div>
            <a 
              href={mediaUrl} 
              download={media.caption || 'document'} 
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500 hover:text-gray-900"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        );
      default:
        return null;
    }
  };

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

          {renderMedia()}
          {body && <div className="whitespace-pre-wrap mt-1">{body}</div>}
          
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
