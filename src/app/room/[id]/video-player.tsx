"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, onValue, set, off } from 'firebase/database';

interface VideoPlayerProps {
  roomId: string;
}

export function VideoPlayer({ roomId }: VideoPlayerProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(Date.now());
  const isSyncing = useRef(false);

  const roomStateRef = ref(database, `rooms/${roomId}/video`);

  useEffect(() => {
    if (!roomId) return;

    const onStateChange = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) return;
      
      const { isPlaying: remoteIsPlaying, progress: remoteProgress, videoSrc: remoteVideoSrc, timestamp } = data;
      
      if (Date.now() - lastSyncTimestamp.current < 500) return;

      isSyncing.current = true;

      if (videoRef.current) {
        if (remoteVideoSrc !== videoSrc) {
          setVideoSrc(remoteVideoSrc);
        }

        if (videoRef.current.src !== remoteVideoSrc) {
          videoRef.current.src = remoteVideoSrc;
        }

        if (Math.abs(videoRef.current.currentTime - remoteProgress) > 2) {
            videoRef.current.currentTime = remoteProgress;
            setProgress(remoteProgress);
        }
        
        if (videoRef.current.paused !== !remoteIsPlaying) {
           if (remoteIsPlaying) {
             videoRef.current.play().catch(() => {});
           } else {
             videoRef.current.pause();
           }
        }
      } else {
         if (remoteVideoSrc) {
            setVideoSrc(remoteVideoSrc);
         }
      }
      setIsPlaying(remoteIsPlaying);

      setTimeout(() => {
        isSyncing.current = false;
      }, 100);
    };

    onValue(roomStateRef, onStateChange);

    return () => {
      off(roomStateRef, 'value', onStateChange);
    };
  }, [roomId, videoSrc]);


  const syncState = (state: object) => {
    if (isSyncing.current) return;
    lastSyncTimestamp.current = Date.now();
    set(roomStateRef, { ...state, timestamp: Date.now() });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
      setProgress(0);
      syncState({ videoSrc: url, isPlaying: false, progress: 0 });
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      const newIsPlaying = !isPlaying;
      if (newIsPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
      // The event listeners for 'play' and 'pause' will handle syncing
    }
  };
  
  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
      if(videoRef.current) {
          const currentlyMuted = !videoRef.current.muted;
          videoRef.current.muted = currentlyMuted;
          setIsMuted(currentlyMuted);
          if (!currentlyMuted && volume === 0) {
            setVolume(0.5);
            videoRef.current.volume = 0.5;
          }
      }
  };
  
  const handleProgressChange = (value: number[]) => {
    if (videoRef.current) {
        isSeeking.current = false;
        const newTime = value[0];
        videoRef.current.currentTime = newTime;
        setProgress(newTime);
        syncState({ isPlaying, progress: newTime, videoSrc });
    }
  };
  
  const toggleFullScreen = () => {
    if (playerRef.current) {
      if (!document.fullscreenElement) {
        playerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateProgress = () => {
      if (!isSeeking.current) {
        setProgress(video.currentTime);
      }
    }
    const setVideoDuration = () => {
      if(video.duration !== Infinity) {
        setDuration(video.duration)
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      syncState({ isPlaying: true, progress: video.currentTime, videoSrc });
    };

    const handlePause = () => {
      setIsPlaying(false);
      syncState({ isPlaying: false, progress: video.currentTime, videoSrc });
    };
    
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', setVideoDuration);
    video.addEventListener('durationchange', setVideoDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', setVideoDuration);
      video.removeEventListener('durationchange', setVideoDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };
  
  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!videoSrc) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Select a video to start</h2>
        <p className="text-muted-foreground max-w-sm">Choose a video file from your computer to begin the watch party. The video is streamed locally and not uploaded.</p>
        <Button asChild className="mt-4">
          <label htmlFor="video-upload" className="cursor-pointer">
            Choose Video File
          </label>
        </Button>
        <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <div ref={playerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" onClick={togglePlay} />
      <div className={cn("absolute inset-0 bg-black/20 transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0", "pointer-events-none")} />
      <div className={cn("absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0")}>
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white">{formatTime(progress)}</span>
                <Slider
                    value={[progress]}
                    max={duration}
                    step={1}
                    onValueChange={(value) => {
                      isSeeking.current = true;
                      setProgress(value[0]);
                    }}
                    onValueCommit={handleProgressChange}
                    className="flex-1"
                />
                <span className="text-xs font-mono text-white">{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20 hover:text-white">
                        {isPlaying ? <Pause /> : <Play />}
                    </Button>
                    <div className="flex items-center gap-2 w-32">
                        <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 hover:text-white">
                            {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                        </Button>
                        <Slider
                            value={[isMuted ? 0 : volume]}
                            max={1}
                            step={0.05}
                            onValueChange={handleVolumeChange}
                        />
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-white hover:bg-white/20 hover:text-white">
                    <Maximize />
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
