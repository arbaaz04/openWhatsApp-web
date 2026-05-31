import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceNotePlayerProps {
  src: string;
  isOut: boolean;
  avatarInitial?: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  src,
  isOut,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error('Audio play failed:', err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTo = parseFloat(e.target.value);
    audio.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  const formatTime = (timeSecs: number) => {
    if (isNaN(timeSecs) || !isFinite(timeSecs)) return '0:00';
    const mins = Math.floor(timeSecs / 60);
    const secs = Math.floor(timeSecs % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1 bg-transparent select-none min-w-[210px] sm:min-w-[250px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95",
          isOut 
            ? "bg-white text-[#128C7E] hover:bg-gray-100" 
            : "bg-[#128C7E] text-white hover:bg-[#075E54]"
        )}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      {/* Mic icon */}
      <Mic className={cn("w-4 h-4 shrink-0", isOut ? "text-white/70" : "text-gray-400")} />

      {/* Progress & Time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Scrubber */}
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={cn(
            "w-full h-1 cursor-pointer appearance-none rounded-lg focus:outline-none bg-gray-200",
            isOut ? "accent-white" : "accent-[#128C7E]"
          )}
          style={{
            background: `linear-gradient(to right, ${isOut ? '#ffffff' : '#128C7E'} ${progress}%, ${isOut ? 'rgba(255,255,255,0.2)' : '#e2e8f0'} ${progress}%)`
          }}
        />

        {/* Time display */}
        <div className={cn(
          "text-[10px] font-semibold leading-none",
          isOut ? "text-white/70" : "text-gray-500"
        )}>
          <span>{formatTime(isPlaying ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  );
};
