"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, onValue, set, off, update } from 'firebase/database';
import { Progress } from '@/components/ui/progress';

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(0);
  
  const roomStateRef = ref(database, `rooms/${roomId}/video`);

  useEffect(() => {
    const onStateChange = (snapshot: any) => {
      const data = snapshot.val();
      setIsLoadingVideo(false);
      if (!data) return;

      if (data.videoSrc && data.videoSrc !== videoSrc) {
        setVideoSrc(data.videoSrc);
      }
      
      if (!data.videoSrc && videoSrc) {
        setVideoSrc(null);
      }

      if (videoRef.current) {
        const serverTime = data.progress ?? 0;
        const clientTime = videoRef.current.currentTime;
        if (Math.abs(serverTime - clientTime) > 2) {
          videoRef.current.currentTime = serverTime;
        }

        const serverPlaying = data.isPlaying ?? false;
        if (serverPlaying !== !videoRef.current.paused) {
          if (serverPlaying) {
            videoRef.current.play().catch(e => console.error("Play interrupted", e));
          } else {
            videoRef.current.pause();
          }
        }
      }
    };
    onValue(roomStateRef, onStateChange);
    return () => {
      off(roomStateRef, 'value', onStateChange);
    };
  }, [roomId]);


  const syncState = (state: object) => {
    if (Date.now() - lastSyncTimestamp.current > 250) {
        update(roomStateRef, state);
        lastSyncTimestamp.current = Date.now();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadstart = () => {
        setIsUploading(true);
        setUploadProgress(0);
      };
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentLoaded = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentLoaded);
        }
      };
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        set(roomStateRef, { videoSrc: base64, isPlaying: false, progress: 0 });
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        console.error("File could not be read");
      }
      reader.readAsDataURL(file);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.error("Play error", e));
      } else {
        videoRef.current.pause();
      }
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
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        handleVolumeChange([0.5]);
      }
    }
  };
  
  const handleProgressChangeCommit = (value: number[]) => {
    if (videoRef.current) {
        const newTime = value[0];
        videoRef.current.currentTime = newTime;
        setProgress(newTime);
        syncState({ progress: newTime });
        isSeeking.current = false;
    }
  };

  const handleProgressChange = (value: number[]) => {
    isSeeking.current = true;
    setProgress(value[0]);
  }
  
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

    const onPlay = () => {
      setIsPlaying(true);
      syncState({ isPlaying: true });
    };
    const onPause = () => {
      setIsPlaying(false);
      if(!isSeeking.current) {
        syncState({ isPlaying: false });
      }
    };
    const onTimeUpdate = () => {
        if (!isSeeking.current) {
            setProgress(video.currentTime);
            syncState({ progress: video.currentTime });
        }
    };
    const onDurationChange = () => {
        if (video.duration !== Infinity) {
            setDuration(video.duration);
        }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('loadedmetadata', onDurationChange);
    
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('loadedmetadata', onDurationChange);
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
  
  if (isLoadingVideo) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <h2 className="text-2xl font-bold">Loading Room...</h2>
        <p className="text-muted-foreground max-w-sm">Getting things ready for your watch party.</p>
      </div>
    )
  }

  if (!videoSrc) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        {isUploading ? (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <h2 className="text-2xl font-bold">Uploading Video...</h2>
            <p className="text-muted-foreground max-w-sm">Please wait while the video is being prepared for everyone.</p>
            <Progress value={uploadProgress} className="w-full max-w-sm mt-4" />
          </>
        ) : (
          <>
            <Film className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Select a video to start</h2>
            <p className="text-muted-foreground max-w-sm">Choose a video file to begin the watch party. This will be uploaded to sync with everyone.</p>
            <Button asChild className="mt-4">
              <label htmlFor="video-upload" className="cursor-pointer">
                Choose Video File
              </label>
            </Button>
            <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          </>
        )}
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
                    onValueChange={handleProgressChange}
                    onValueCommit={handleProgressChangeCommit}
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
