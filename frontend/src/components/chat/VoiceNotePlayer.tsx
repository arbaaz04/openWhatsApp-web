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
  avatarInitial = 'C',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Sync state on audio end
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

    // Initial check in case it loaded before listeners bound
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

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (timeSecs: number) => {
    if (isNaN(timeSecs) || !isFinite(timeSecs)) return '0:00';
    const mins = Math.floor(timeSecs / 60);
    const secs = Math.floor(timeSecs % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 p-2.5 rounded-xl min-w-[245px] sm:min-w-[290px] select-none shadow-sm border border-gray-100",
      isOut 
        ? "bg-[#128C7E]/40 border-[#128C7E]/20 text-white" 
        : "bg-gray-50 border-gray-100 text-gray-800"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm",
          isOut 
            ? "bg-white text-[#128C7E] hover:bg-gray-100" 
            : "bg-[#128C7E] text-white hover:bg-[#075E54]"
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Progress & Time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Scrubber */}
        <div className="relative flex items-center group/scrub">
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
        </div>

        {/* Time display */}
        <div className={cn(
          "flex justify-between items-center text-[10px] font-semibold leading-none",
          isOut ? "text-white/80" : "text-gray-500"
        )}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback speed control */}
      <button
        onClick={cyclePlaybackRate}
        className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight border cursor-pointer shrink-0 transition-colors select-none",
          isOut
            ? "border-white/30 hover:bg-white/10 text-white"
            : "border-gray-200 hover:bg-gray-100 text-gray-600"
        )}
      >
        {playbackRate}x
      </button>

      {/* Avatar / Mic indicator */}
      <div className="shrink-0 flex items-center justify-center">
        {isOut ? (
          <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-bold">
            {avatarInitial}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#128C7E]/10 text-[#128C7E] flex items-center justify-center relative">
            <Mic className="w-4 h-4" />
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full absolute top-0.5 right-0.5 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};
