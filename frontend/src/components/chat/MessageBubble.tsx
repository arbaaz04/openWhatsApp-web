import { useState, useEffect } from 'react';
import { Reply, File, Download, Loader2, Check, CheckCheck, X, Play, Clock, Mic, ChevronRight, List, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { VoiceNotePlayer } from './VoiceNotePlayer';

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
  interactive?: any;
  status?: 'uploading' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  localFile?: File;
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
  media,
  interactive,
  status,
  localFile
}: MessageBubbleProps) {
  const isOut = direction === 'outgoing';
  const { session } = useAuth();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!media);
  const [error, setError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Load local file for optimistic media preview
  useEffect(() => {
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setMediaUrl(url);
      setLoading(false);
      setError(false);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [localFile]);

  // Lock body scroll when Lightbox is active
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen]);

  // Handle escape key to close
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen]);

  const handleQuotedMessageClick = (e: React.MouseEvent) => {
    if (!replyTo?.id) return;
    e.stopPropagation();
    const targetEl = document.getElementById(`msg-bubble-${replyTo.id}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash/Highlight effect
      targetEl.classList.add('ring-2', 'ring-sky-400', 'ring-offset-2');
      setTimeout(() => {
        targetEl.classList.remove('ring-2', 'ring-sky-400', 'ring-offset-2');
      }, 1500);
    }
  };

  useEffect(() => {
    if (localFile) return;
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
    if (status === 'uploading') {
      const mediaType = media?.type || (
        localFile?.type.startsWith('image/') ? 'image' :
        localFile?.type.startsWith('video/') ? 'video' :
        (localFile?.type.startsWith('audio/') || localFile?.name?.endsWith('.ogg')) ? 'voice' :
        'document'
      );
      
      return (
        <div className="rounded-lg overflow-hidden max-w-full my-1.5 relative group/upload">
          {mediaType === 'image' && mediaUrl ? (
            <div className="relative border border-gray-100/60 shadow-sm rounded-lg overflow-hidden">
              <img src={mediaUrl} className="max-h-[200px] w-auto object-cover max-w-full block opacity-60 blur-[1px]" alt="Uploading..." />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Loader2 className="w-8 h-8 animate-spin text-[#128C7E]" />
              </div>
            </div>
          ) : mediaType === 'video' && mediaUrl ? (
            <div className="relative border border-gray-100/60 shadow-sm rounded-lg overflow-hidden">
              <video src={mediaUrl} className="max-h-[200px] w-full max-w-xs block object-cover opacity-60 blur-[1px]" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Loader2 className="w-8 h-8 animate-spin text-[#128C7E]" />
              </div>
            </div>
          ) : (mediaType === 'audio' || mediaType === 'voice') ? (
            <div className="flex items-center gap-3 py-1 bg-transparent select-none min-w-[210px] sm:min-w-[250px] opacity-60">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                isOut ? "bg-white text-[#128C7E]" : "bg-[#128C7E] text-white"
              )}>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <Mic className={cn("w-4 h-4 shrink-0", isOut ? "text-white/70" : "text-gray-400")} />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className={cn("w-full h-1 rounded-lg", isOut ? "bg-white/20" : "bg-gray-200")} />
                <div className={cn("text-[10px] font-semibold leading-none", isOut ? "text-white/70" : "text-gray-500")}>
                  <span>Uploading voice note...</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-gray-200/80 bg-gray-50 flex items-center justify-between gap-4 max-w-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-gray-100 text-gray-500 rounded-lg shrink-0">
                  <File className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <span className="text-[12px] font-bold text-gray-900 truncate">
                    {localFile?.name || 'Uploading file...'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mt-0.5 animate-pulse">
                    Uploading...
                  </span>
                </div>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
            </div>
          )}
        </div>
      );
    }

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
              className="max-h-[220px] w-auto object-cover max-w-full block cursor-pointer"
              onClick={() => setIsLightboxOpen(true)}
            />
          </div>
        );
      case 'video':
        return (
          <div 
            onClick={() => setIsLightboxOpen(true)}
            className="rounded-lg overflow-hidden border border-gray-100/60 shadow-sm max-w-full my-1.5 relative cursor-pointer group/vid"
          >
            <video 
              src={mediaUrl} 
              className="max-h-[220px] w-full max-w-xs block object-cover bg-black"
              preload="metadata"
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/vid:bg-black/35 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-lg transition-transform group-hover/vid:scale-105">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        );
      case 'voice':
      case 'audio':
        return (
          <div className="my-1.5">
            <VoiceNotePlayer 
              src={mediaUrl} 
              isOut={isOut} 
              avatarInitial={isOut ? 'A' : avatarInitial} 
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
    <>
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
          {body !== 'This message was deleted' && (
            <button 
              onClick={() => {
                let displayBody = body;
                if (media) {
                  const iconMap = {
                    image: '📷 Photo',
                    video: '📹 Video',
                    voice: '🎤 Voice Note',
                    audio: '🎵 Audio',
                    document: '📄 Document',
                  };
                  const typeLabel = iconMap[media.type] || 'Media';
                  displayBody = body ? `${typeLabel}: ${body}` : typeLabel;
                }
                onReply?.({ id, body: displayBody, senderName });
              }}
              className={cn(
                "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm text-gray-400 hover:text-[#128C7E] z-10",
                isOut ? "-left-10" : "-right-10"
              )}
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          <div
            id={`msg-bubble-${id}`}
            className={cn(
              'px-3.5 py-2 text-[13px] leading-relaxed relative overflow-hidden transition-all duration-300',
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
              <div 
                onClick={handleQuotedMessageClick}
                className={cn(
                  "p-2 mb-2 rounded border-l-4 text-[11px] leading-snug line-clamp-2 cursor-pointer hover:bg-black/25 transition-colors duration-200 select-none",
                  isOut ? "bg-black/10 border-white/40 text-white/80" : "bg-gray-100 border-gray-300 text-gray-500"
                )}
              >
                {replyTo.senderName && <span className="font-bold block mb-0.5">{replyTo.senderName}</span>}
                {replyTo.body}
              </div>
            )}

            {body !== 'This message was deleted' && renderMedia()}
            
            {/* Native Interactive Message Rendering */}
            {interactive ? (
              (() => {
                const { type: intType, header, body: intBody, footer, action } = interactive;
                const renderHeader = () => {
                  if (!header) return null;
                  if (header.type === 'text' && header.text) {
                    return <div className="font-bold text-[13px] mb-1.5 text-gray-900 border-b border-gray-100 pb-1">{header.text}</div>;
                  }
                  if (header.type === 'image' && header.image?.link) {
                    return (
                      <div className="rounded-lg overflow-hidden border border-gray-100/60 shadow-sm max-w-full mb-2">
                        <img src={header.image.link} className="max-h-[140px] w-full object-cover block" alt="Header media" />
                      </div>
                    );
                  }
                  if (header.type === 'video' && header.video?.link) {
                    return (
                      <div className="rounded-lg overflow-hidden border border-gray-100/60 shadow-sm max-w-full mb-2 relative">
                        <video src={header.video.link} className="max-h-[140px] w-full object-cover block bg-black" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-8 h-8 text-white fill-current opacity-85" />
                        </div>
                      </div>
                    );
                  }
                  return null;
                };

                switch (intType) {
                  case 'cta_url': {
                    const display = action?.parameters?.display_text || 'Visit Link';
                    const url = action?.parameters?.url || '#';
                    return (
                      <div className="flex flex-col min-w-[210px] max-w-xs mt-1 bg-white/90 rounded-lg border border-gray-200/80 shadow-sm overflow-hidden text-left text-gray-900">
                        <div className="p-3">
                          {renderHeader()}
                          <div className="text-[12.5px] text-gray-800 font-medium whitespace-pre-wrap">{intBody?.text}</div>
                          {footer?.text && <div className="text-[10px] text-gray-400 mt-1 font-semibold">{footer.text}</div>}
                        </div>
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="border-t border-gray-100 py-2.5 px-3 flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50/20 hover:bg-sky-50/40 transition-colors cursor-pointer select-none"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {display}
                        </a>
                      </div>
                    );
                  }

                  case 'button': {
                    const buttons = action?.buttons || [];
                    return (
                      <div className="flex flex-col min-w-[210px] max-w-xs mt-1 bg-white/90 rounded-lg border border-gray-200/80 shadow-sm overflow-hidden text-left text-gray-900">
                        <div className="p-3">
                          {renderHeader()}
                          <div className="text-[12.5px] text-gray-800 font-medium whitespace-pre-wrap">{intBody?.text}</div>
                          {footer?.text && <div className="text-[10px] text-gray-400 mt-1 font-semibold">{footer.text}</div>}
                        </div>
                        <div className="border-t border-gray-100 flex flex-col divide-y divide-gray-100 bg-gray-50/10">
                          {buttons.map((btn: any, idx: number) => (
                            <button
                              key={btn.reply?.id || idx}
                              className="py-2.5 px-3 text-center text-[12px] font-bold text-[#128C7E] hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                              onClick={() => alert(`Simulated button click: "${btn.reply?.title}" (ID: ${btn.reply?.id})`)}
                            >
                              {btn.reply?.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  case 'list': {
                    const sections = action?.sections || [];
                    const menuButtonText = action?.button || 'Select Option';
                    return (
                      <div className="flex flex-col min-w-[210px] max-w-xs mt-1 bg-white/90 rounded-lg border border-gray-200/80 shadow-sm overflow-hidden text-left text-gray-900">
                        <div className="p-3">
                          {renderHeader()}
                          <div className="text-[12.5px] text-gray-800 font-medium whitespace-pre-wrap">{intBody?.text}</div>
                          {footer?.text && <div className="text-[10px] text-gray-400 mt-1 font-semibold">{footer.text}</div>}
                        </div>
                        <div className="border-t border-gray-100">
                          <div className="p-2 bg-gray-50/50">
                            <button
                              onClick={() => {
                                alert(`Options Menu:\n` + sections.map((s: any) => `* ${s.title || 'Section'}:\n` + s.rows.map((r: any) => `  - ${r.title} (${r.description || ''})`).join('\n')).join('\n'));
                              }}
                              className="w-full py-2 px-3 flex items-center justify-between rounded-lg border border-gray-200/60 bg-white shadow-sm hover:bg-gray-50 text-[11.5px] font-bold text-gray-800 hover:text-gray-900 transition-all cursor-pointer active:scale-[0.99]"
                            >
                              <span className="flex items-center gap-1.5">
                                <List className="w-3.5 h-3.5 text-[#128C7E]" />
                                {menuButtonText}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          </div>
                          <div className="bg-white px-3 py-2 border-t border-gray-50 flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                            {sections.map((sec: any, sIdx: number) => (
                              <div key={sIdx} className="flex flex-col">
                                {sec.title && <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1 mt-0.5">{sec.title}</div>}
                                <div className="flex flex-col gap-1">
                                  {sec.rows?.map((row: any, rIdx: number) => (
                                    <div 
                                      key={row.id || rIdx} 
                                      onClick={() => alert(`Simulated List click: row ID "${row.id}" ("${row.title}")`)}
                                      className="p-1.5 hover:bg-[#128C7E]/5 rounded border border-transparent hover:border-[#128C7E]/20 transition-all cursor-pointer flex flex-col"
                                    >
                                      <span className="text-[11px] font-bold text-[#128C7E]">{row.title}</span>
                                      {row.description && <span className="text-[9.5px] text-gray-500 font-medium leading-snug">{row.description}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  case 'carousel': {
                    const cards = action?.cards || [];
                    return (
                      <div className="flex flex-col max-w-full mt-1 text-left text-gray-900">
                        {intBody?.text && (
                          <div className="px-1 py-1 mb-2 text-[12.5px] text-gray-800 font-medium whitespace-pre-wrap">
                            {intBody.text}
                          </div>
                        )}
                        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 scrollbar-thin max-w-[280px] sm:max-w-[400px]">
                          {cards.map((card: any, idx: number) => {
                            const cardImg = card.header?.image?.link || card.header?.video?.link;
                            const cardButtons = card.action?.buttons || [];
                            const ctaBtn = card.action?.parameters;
                            
                            return (
                              <div 
                                key={card.card_index ?? idx} 
                                className="w-[180px] shrink-0 flex flex-col rounded-xl overflow-hidden border border-gray-200/80 bg-white shadow-sm"
                              >
                                {cardImg ? (
                                  <div className="h-[90px] w-full relative bg-gray-50 border-b border-gray-100">
                                    {card.header?.type === 'video' ? (
                                      <>
                                        <video src={cardImg} className="h-full w-full object-cover block bg-black" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                                          <Play className="w-5 h-5 text-white fill-current opacity-85" />
                                        </div>
                                      </>
                                    ) : (
                                      <img src={cardImg} className="h-full w-full object-cover block" alt="Card Header" />
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-[90px] w-full bg-gray-100 flex items-center justify-center text-gray-400">
                                    <File className="w-5 h-5" />
                                  </div>
                                )}
                                
                                <div className="p-2 flex-1 flex flex-col justify-between">
                                  <div className="text-[11px] text-gray-800 font-semibold line-clamp-3 leading-snug">
                                    {card.body?.text}
                                  </div>
                                </div>

                                <div className="border-t border-gray-100 flex flex-col divide-y divide-gray-100 bg-gray-50/20">
                                  {card.type === 'cta_url' && ctaBtn ? (
                                    <a
                                      href={ctaBtn.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="py-2 px-2 text-center text-[10px] font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {ctaBtn.display_text || 'View Link'}
                                    </a>
                                  ) : (
                                    cardButtons.map((btn: any, bIdx: number) => {
                                      const isQuick = btn.type === 'quick_reply';
                                      if (isQuick) {
                                        return (
                                          <button
                                            key={btn.quick_reply?.id || bIdx}
                                            className="py-2 px-2 text-center text-[10.5px] font-bold text-[#128C7E] hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                                            onClick={() => alert(`Simulated Card click: "${btn.quick_reply?.title}" (ID: ${btn.quick_reply?.id})`)}
                                          >
                                            {btn.quick_reply?.title}
                                          </button>
                                        );
                                      } else {
                                        const cta = btn.cta_url;
                                        return (
                                          <a
                                            key={bIdx}
                                            href={cta?.url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="py-2 px-2 text-center text-[10px] font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            {cta?.display_text || 'Link'}
                                          </a>
                                        );
                                      }
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  default:
                    return null;
                }
              })()
            ) : (
              body && (
                <div className={cn(
                  "whitespace-pre-wrap mt-1", 
                  body === 'This message was deleted' && "italic opacity-60 flex items-center gap-1.5 select-none"
                )}>
                  {body === 'This message was deleted' && (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 inline-block shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                  {body}
                </div>
              )
            )}
            
            {/* Inline Timestamp */}
            <div className={cn(
              "text-[10px] mt-1 flex justify-end items-center gap-1.5",
              isOut ? "text-white/60" : "text-gray-400"
            )}>
              <span>{time}</span>
              {isOut && (
                <span className="shrink-0 flex items-center">
                  {status === 'read' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                  ) : status === 'delivered' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-white/50" />
                  ) : status === 'sending' || status === 'uploading' ? (
                    <Clock className="w-3 h-3 text-white/60" />
                  ) : status === 'failed' ? (
                    <span className="text-red-300 font-bold leading-none select-none text-[12px]" title="Message failed to deliver">!</span>
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white/40" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && media && mediaUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between text-white animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header */}
          <div 
            className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-white leading-tight">
                {senderName || (isOut ? 'You' : 'Customer')}
              </span>
              <span className="text-[11px] text-gray-300 font-medium mt-0.5">
                {time}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href={mediaUrl} 
                download={media.caption || `media_${media.id}`}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
              <button 
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white flex items-center justify-center cursor-pointer active:scale-95"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4 relative z-10">
            {media.type === 'image' ? (
              <img 
                src={mediaUrl} 
                alt={media.caption || 'Image'} 
                className="max-w-full max-h-[80vh] object-contain select-none animate-in zoom-in-95 duration-200 cursor-zoom-out"
              />
            ) : (
              <video 
                src={mediaUrl} 
                controls 
                autoPlay
                className="max-w-full max-h-[80vh] object-contain animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Footer / Caption */}
          {media.caption && (
            <div 
              className="p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center text-center z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[13px] text-gray-200 max-w-2xl font-medium bg-black/50 px-4 py-2 rounded-xl backdrop-blur-sm shadow-md">
                {media.caption}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
