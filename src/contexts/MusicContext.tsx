import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type Track = {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  cover_url: string | null;
  visibility: string;
};

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: "none" | "one" | "all";
  shuffleOn: boolean;
  playTrack: (track: Track, tracks: Track[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (mode: "none" | "one" | "all") => void;
  setShuffleOn: (on: boolean) => void;
  queue: Track[];
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("none");
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
        }
    };
    const updateDuration = () => {
        if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
        }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => playNext();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplay", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplay", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const playTrack = useCallback((track: Track, tracks: Track[]) => {
    if (!audioRef.current) return;
    
    setOriginalQueue(tracks);
    if (shuffleOn) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
    } else {
      setQueue(tracks);
    }

    setCurrentTrack(track);
    setDuration(0); // Reset duration for new track
    setCurrentTime(0);
    audioRef.current.src = track.file_url;
    audioRef.current.load(); // Force load
    audioRef.current.play().catch(() => {
      toast.info("Нажмите Play для начала воспроизведения");
    });
  }, [shuffleOn]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying, currentTrack]);

  const playNext = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;
    
    if (repeatMode === "one") {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeatMode === "all") {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    setCurrentTrack(nextTrack);
    setDuration(0);
    setCurrentTime(0);
    audioRef.current.src = nextTrack.file_url;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
  }, [currentTrack, queue, repeatMode]);

  const playPrev = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      if (repeatMode === "all") {
        prevIndex = queue.length - 1;
      } else {
        prevIndex = 0;
      }
    }

    const prevTrack = queue[prevIndex];
    setCurrentTrack(prevTrack);
    setDuration(0);
    setCurrentTime(0);
    audioRef.current.src = prevTrack.file_url;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
  }, [currentTrack, queue, repeatMode]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  useEffect(() => {
    if (shuffleOn) {
      setQueue(prev => [...prev].sort(() => Math.random() - 0.5));
    } else {
      setQueue(originalQueue);
    }
  }, [shuffleOn, originalQueue]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        repeatMode,
        shuffleOn,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seek,
        setVolume,
        setRepeatMode,
        setShuffleOn,
        queue
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within a MusicProvider");
  return context;
};
