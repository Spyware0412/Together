"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Film, Loader2, AlertTriangle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, onValue, set, off, update, onDisconnect, serverTimestamp } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { v4 as uuidv4 } from 'uuid';

interface VideoPlayerProps {
  roomId: string;
}

interface RoomState {
  fileName: string | null;
  isPlaying: boolean;
  progress: number;
  controllerId: string | null;
}

export function VideoPlayer({ roomId }: VideoPlayerProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(0);
  const [userId] = useState(() => uuidv4());

  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const userStatusRef = ref(database, `rooms/${roomId}/users/${userId}`);
  const usersRef = ref(database, `rooms/${roomId}/users`);

  const isController = roomState?.controllerId === userId;
  const hasControl = roomState?.controllerId === null || isController;

  useEffect(() => {
    onValue(userStatusRef, (snapshot) => {
        if (!snapshot.exists()) {
             set(userStatusRef, { online: true, last_seen: serverTimestamp() });
             onDisconnect(userStatusRef).remove();
        }
    });

    const onStateChange = (snapshot: any) => {
      const data: RoomState | null = snapshot.val();
      setIsLoading(false);
      setRoomState(data);
      
      if (!data?.fileName) {
        setVideoSrc(null);
        setFileName(null);
        return;
      }

      if (videoRef.current && fileName === data.fileName) {
        const serverTime = data.progress ?? 0;
        const clientTime = videoRef.current.currentTime;
        if (Math.abs(serverTime - clientTime) > 2) { 
          videoRef.current.currentTime = serverTime;
        }

        const serverPlaying = data.isPlaying ?? false;
        if (serverPlaying !== !videoRef.current.paused) {
          if (serverPlaying) {
            videoRef.current.play().catch(e => {});
          } else {
            videoRef.current.pause();
          }
        }
      }
    };

    onValue(roomStateRef, onStateChange);
    
    // When controller disconnects, assign a new one
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        if (users && roomState?.controllerId && !users[roomState.controllerId]) {
            const remainingUsers = Object.keys(users);
            if(remainingUsers.length > 0) {
                const newController = remainingUsers[0];
                update(roomStateRef, { controllerId: newController });
            } else {
                 update(roomStateRef, { controllerId: null });
            }
        }
    });

    return () => {
      off(roomStateRef);
      off(userStatusRef);
      off(usersRef);
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      set(userStatusRef, null); // Mark user as offline
    };
  }, [roomId, fileName, videoSrc, userId, roomState?.controllerId]);

  const syncState = (state: Partial<RoomState>) => {
    if (Date.now() - lastSyncTimestamp.current > 250 && isController) {
        update(roomStateRef, state);
        lastSyncTimestamp.current = Date.now();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) {
          URL.revokeObjectURL(videoSrc);
      }
      const newVideoSrc = URL.createObjectURL(file);
      setVideoSrc(newVideoSrc);
      setFileName(file.name);
      
      if (!roomState?.fileName) {
        set(roomStateRef, { fileName: file.name, isPlaying: false, progress: 0, controllerId: userId });
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current && hasControl) {
      const newIsPlaying = !roomState?.isPlaying;
      if (newIsPlaying) {
        videoRef.current.play().catch(e => console.error("Play error", e));
      } else {
        videoRef.current.pause();
      }
      update(roomStateRef, { isPlaying: newIsPlaying });
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
    if (videoRef.current && hasControl) {
        const newTime = value[0];
        videoRef.current.currentTime = newTime;
        setProgress(newTime);
        update(roomStateRef, { progress: newTime });
        isSeeking.current = false;
    }
  };

  const handleProgressChange = (value: number[]) => {
    if (hasControl) {
        isSeeking.current = true;
        setProgress(value[0]);
    }
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
      if(isController) syncState({ isPlaying: true });
    };
    const onPause = () => {
      if(isController && !isSeeking.current) syncState({ isPlaying: false });
    };
    const onTimeUpdate = () => {
        if (!isSeeking.current) {
            setProgress(video.currentTime);
            if (isController) {
              syncState({ progress: video.currentTime });
            }
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
  }, [videoSrc, isController]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };
  
  const handleMouseLeave = () => {
    if (roomState?.isPlaying) {
      setShowControls(false);
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  if (isLoading) {
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
        <Film className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{roomState?.fileName ? "Join the session" : "Select a video to start"}</h2>
        <p className="text-muted-foreground max-w-sm">
          {roomState?.fileName 
            ? <>The group is watching <span className="font-bold text-foreground">{roomState?.fileName}</span>. Choose the same file to join in.</>
            : "Choose a video file to begin the watch party. Playback will sync with others who load the same file."
          }
        </p>
        <Button asChild className="mt-4">
          <label htmlFor="video-upload" className="cursor-pointer">
            Choose Video File
          </label>
        </Button>
        <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  const isPlaybackDisabled = fileName !== roomState?.fileName || !hasControl;

  return (
    <div ref={playerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" onClick={togglePlay} />
      
      {fileName !== roomState?.fileName && roomState?.fileName && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>File Mismatch</AlertTitle>
                <AlertDescription>
                    The video you selected (<span className="font-bold">{fileName}</span>) is different from the one being played in the room (<span className="font-bold">{roomState.fileName}</span>). Please select the correct file to sync with the group.
                </AlertDescription>
                <div className="mt-4">
                    <Button asChild variant="secondary">
                        <label htmlFor="video-upload" className="cursor-pointer">
                            Choose Correct Video File
                        </label>
                    </Button>
                    <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                </div>
            </Alert>
        </div>
      )}
      
      {isController && (
        <div className={cn("absolute top-4 left-4 p-2 bg-black/50 rounded-lg text-white text-xs flex items-center gap-2 transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0")}>
            <Crown className="w-4 h-4 text-amber-400"/> You are the controller
        </div>
      )}


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
                    disabled={isPlaybackDisabled}
                />
                <span className="text-xs font-mono text-white">{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20 hover:text-white" disabled={isPlaybackDisabled}>
                        {roomState?.isPlaying ? <Pause /> : <Play />}
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
