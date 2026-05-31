import { useState, useEffect, useRef } from 'react';
import { Paperclip, Smile, Send, X, FileText, Clock, Mic, Trash2, Loader2 } from 'lucide-react';
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
  onSendMedia?: (
    file: File, 
    type: 'image' | 'video' | 'audio' | 'document' | 'voice', 
    caption?: string, 
    replyToId?: string
  ) => Promise<void>;
  onToggleTemplates?: () => void;
  isExpired?: boolean;
  onTyping?: () => void;
}

export function Composer({
  replyTo,
  onCancelReply,
  onSend,
  onSendMedia,
  onToggleTemplates,
  isExpired = false,
  onTyping
}: ComposerProps) {
  const [text, setText] = useState('');
  
  // File Attachment State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Audio recording helpers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordingDurationRef.current = 0;
      
      let mimeType = 'audio/ogg; codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm; codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([audioBlob], `voice_note.${ext}`, { type: mimeType });

        if (audioChunksRef.current.length > 0 && recordingDurationRef.current > 0) {
          setIsUploading(true);
          try {
            await onSendMedia?.(file, 'voice', '', replyTo?.id);
          } catch (err) {
            console.error('Failed to send voice note:', err);
          } finally {
            setIsUploading(false);
          }
        }
        setRecordingDuration(0);
        recordingDurationRef.current = 0;
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const handleSend = async () => {
    if (selectedFile) {
      setIsUploading(true);
      try {
        let type: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (selectedFile.type.startsWith('image/')) type = 'image';
        else if (selectedFile.type.startsWith('video/')) type = 'video';
        else if (selectedFile.type.startsWith('audio/')) type = 'audio';

        await onSendMedia?.(selectedFile, type, text.trim(), replyTo?.id);
        handleClearFile();
        setText('');
      } catch (err) {
        console.error('Error sending media:', err);
      } finally {
        setIsUploading(false);
      }
    } else {
      if (!text.trim()) return;
      onSend?.(text.trim(), replyTo?.id);
      setText('');
    }
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
                className="p-1 px-3 hover:bg-gray-200 rounded-md transition-colors text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Selected File Preview Bar */}
          {selectedFile && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-[#E5E7EB] border-b-0 rounded-t-md animate-in slide-in-from-bottom-2 duration-200">
              {selectedFile.type.startsWith('image/') && filePreviewUrl ? (
                <img 
                  src={filePreviewUrl} 
                  alt="Preview" 
                  className="w-10 h-10 object-cover rounded-lg border border-gray-200 shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
                  {selectedFile.type.startsWith('video/') ? (
                    <PlayIcon className="w-5 h-5 text-red-500" />
                  ) : selectedFile.type.startsWith('audio/') ? (
                    <Mic className="w-5 h-5 text-green-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-gray-700 truncate">{selectedFile.name}</div>
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type.split('/')[1] || 'Unknown'}
                </p>
              </div>
              {isUploading ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#128C7E] shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <button 
                  onClick={handleClearFile}
                  className="p-1 px-3 hover:bg-gray-200 rounded-md transition-colors text-gray-400 cursor-pointer"
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Voice Recording Box OR Textarea input */}
          {isRecording ? (
            <div className="border border-[#E5E7EB] rounded-md p-3.5 bg-gray-50 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 relative">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0" />
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full absolute shrink-0" />
                <span className="text-[13px] font-bold text-gray-700 ml-3">
                  Recording voice note ({formatDuration(recordingDuration)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={cancelRecording}
                  className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-full transition-colors active:scale-95 cursor-pointer"
                  title="Discard recording"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={stopAndSendRecording}
                  className="p-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-full transition-colors active:scale-95 cursor-pointer shadow-sm flex items-center justify-center"
                  title="Send voice note"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "border border-[#E5E7EB] rounded-md focus-within:border-[#128C7E] focus-within:ring-1 focus-within:ring-[#128C7E] transition-all bg-white relative",
              (replyTo || selectedFile) ? "rounded-t-none" : "rounded-md"
            )}>
              <textarea
                placeholder={selectedFile ? "Add a caption..." : replyTo ? "Type a reply..." : "Type a message..."}
                className="w-full bg-transparent border-none outline-none resize-none max-h-32 min-h-[60px] py-2.5 px-3 text-[13px] text-gray-900 placeholder:text-gray-500 font-medium"
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  onTyping?.();
                }}
                onKeyDown={handleKeyDown}
                disabled={isUploading}
              />
              
              {/* Hidden file input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
              />
              
              {/* Formatting / Action Toolbar */}
              <div className="flex items-center justify-between border-t border-gray-50 bg-gray-50/50 px-2 py-1.5 rounded-b-md">
                <div className="flex items-center gap-0.5">
                  <button 
                    onClick={handlePaperclipClick}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer" 
                    title="Attach file"
                    disabled={isUploading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Insert emoji" disabled={isUploading}>
                    <Smile className="w-4 h-4" />
                  </button>
                  <div className="w-px h-3.5 bg-gray-200 mx-0.5"></div>
                  <button 
                    onClick={onToggleTemplates}
                    className="p-1.5 text-[#128C7E] hover:bg-[#128C7E]/5 rounded transition-colors flex items-center gap-1 cursor-pointer" 
                    title="WhatsApp Templates"
                    disabled={isUploading}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-[11px] font-bold">Templates</span>
                  </button>
                </div>
                
                {/* Dynamically toggle between microphone and send buttons */}
                {(!text.trim() && !selectedFile) ? (
                  <button 
                    onClick={startRecording}
                    className="w-8 h-8 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                    title="Record voice note"
                    disabled={isUploading}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={handleSend}
                    className="px-3 py-1.5 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Simple placeholder Play icon for video previews
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
    </svg>
  );
}
