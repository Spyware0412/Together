
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Film,
  Loader2,
  AlertTriangle,
  Settings,
  X,
  Upload,
  Check,
  Languages,
  Subtitles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { database } from "@/lib/firebase";
import {
  ref,
  onValue,
  set,
  off,
  update,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { v4 as uuidv4 } from "uuid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface VideoPlayerProps {
  roomId: string;
}

interface RoomState {
  fileName: string | null;
  isPlaying: boolean;
  progress: number;
}

interface SubtitleSettings {
  fontSize: number;
  color: string;
  position: number; // As a percentage from the bottom
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

  // New state for advanced features
  const { toast } = useToast();
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedTextTrack, setSelectedTextTrack] = useState<string>("off");
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>("");
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    fontSize: 1, // as rem
    color: "#FFFFFF",
    position: 5, // as percentage
  });
  const externalSubtitlesRef = useRef<Map<string, string>>(new Map());

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(0);
  const [userId] = useState(() => uuidv4());
  const isRemoteUpdate = useRef(false);

  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const userStatusRef = ref(database, `rooms/${roomId}/users/${userId}`);

  // -------------------------------
  // Firebase sync
  // -------------------------------
  useEffect(() => {
    set(userStatusRef, { online: true, last_seen: serverTimestamp() });
    onDisconnect(userStatusRef).remove();

    const onStateChange = (snapshot: any) => {
      const data: RoomState | null = snapshot.val();
      setIsLoading(false);
      
      isRemoteUpdate.current = true;
      setRoomState(data);

      if (videoRef.current && data) {
        if (data.fileName && fileName === data.fileName) {
          const serverTime = data.progress ?? 0;
          const clientTime = videoRef.current.currentTime;
          if (Math.abs(serverTime - clientTime) > 2) {
            videoRef.current.currentTime = serverTime;
          }

          const serverPlaying = data.isPlaying ?? false;
          if (serverPlaying !== !videoRef.current.paused) {
            if (serverPlaying) videoRef.current.play().catch(() => {});
            else videoRef.current.pause();
          }
        }
      }
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 100);
    };

    onValue(roomStateRef, onStateChange);

    return () => {
      off(roomStateRef, "value", onStateChange);
      onDisconnect(userStatusRef).cancel();
      set(userStatusRef, null);
    };
  }, [roomId, fileName]);

  const syncState = useCallback((state: Partial<RoomState>) => {
      if (isRemoteUpdate.current) return;
      update(roomStateRef, state);
  }, [roomStateRef]);

  // -------------------------------
  // File select & track handling
  // -------------------------------
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      externalSubtitlesRef.current.forEach(URL.revokeObjectURL);
      externalSubtitlesRef.current.clear();
      
      const newVideoSrc = URL.createObjectURL(file);
      setVideoSrc(newVideoSrc);
      setFileName(file.name);
      
      set(roomStateRef, {
        fileName: file.name,
        isPlaying: false,
        progress: 0,
      });
      if (videoRef.current) videoRef.current.currentTime = 0;
      setProgress(0);
      setSelectedTextTrack("off");
    }
  };

  const loadTracks = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Text Tracks
    const availableTextTracks = Array.from(video.textTracks);
    setTextTracks(availableTextTracks);
    // Auto-enable first subtitle track if available
    const firstSub = availableTextTracks.find(t => t.kind === 'subtitles');
    if (firstSub) {
      firstSub.mode = 'showing';
      setSelectedTextTrack(firstSub.label || 'track-0');
    } else {
      setSelectedTextTrack('off');
    }

    // Audio Tracks
    const availableAudioTracks = Array.from(video.audioTracks as any);
    setAudioTracks(availableAudioTracks);
    const enabledAudioTrack = availableAudioTracks.find(t => t.enabled);
    if(enabledAudioTrack) {
        setSelectedAudioTrack(enabledAudioTrack.id);
    } else if (availableAudioTracks.length > 0) {
        availableAudioTracks[0].enabled = true;
        setSelectedAudioTrack(availableAudioTracks[0].id);
    }
  }, []);

  const handleSubtitleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && videoRef.current) {
        const trackUrl = URL.createObjectURL(file);
        const trackId = `external-${file.name}`;
        
        // Remove old track if it exists
        const oldTrackEl = playerRef.current?.querySelector(`track[id="${trackId}"]`);
        if(oldTrackEl) oldTrackEl.remove();

        const trackElement = document.createElement('track');
        trackElement.id = trackId;
        trackElement.kind = 'subtitles';
        trackElement.label = file.name;
        trackElement.srclang = 'en'; // default lang
        trackElement.src = trackUrl;
        
        videoRef.current.appendChild(trackElement);
        externalSubtitlesRef.current.set(trackId, trackUrl);

        setTimeout(() => { // give it a moment to load
            loadTracks();
            setSelectedTextTrack(file.name);
            toast({ title: "Success", description: "Subtitle file loaded."});
        }, 500);
    }
  };

  // -------------------------------
  // Player controls
  // -------------------------------
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (fileName !== roomState?.fileName) return;
    syncState({ isPlaying: videoRef.current.paused });
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
  };

  const toggleFullScreen = () => {
    if (playerRef.current) {
      if (!document.fullscreenElement) {
        playerRef.current.requestFullscreen().catch((err) => {
          console.error(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // -------------------------------
  // Advanced Feature Handlers
  // -------------------------------
  useEffect(() => {
    textTracks.forEach((track) => {
        track.mode = (track.label === selectedTextTrack || track.id === selectedTextTrack) ? 'showing' : 'hidden';
    });
    if (selectedTextTrack === 'off') {
        textTracks.forEach(t => t.mode = 'hidden');
    }
  }, [selectedTextTrack, textTracks]);

  useEffect(() => {
    if (videoRef.current && videoRef.current.audioTracks) {
      videoRef.current.audioTracks.onchange = () => {
        const enabledTrack = Array.from(videoRef.current!.audioTracks).find(t => t.enabled);
        if (enabledTrack) setSelectedAudioTrack(enabledTrack.id);
      }
    }
  }, [videoRef.current]);

  const handleAudioTrackChange = (trackId: string) => {
    audioTracks.forEach((track: any) => {
        track.enabled = track.id === trackId;
    });
    setSelectedAudioTrack(trackId);
  };
  
  // Apply subtitle styles via CSS Custom Properties
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.id = 'cinesync-subtitle-styles';
    document.head.appendChild(styleElement);

    const sheet = styleElement.sheet;
    if (sheet) {
        const css = `
        ::cue {
          font-size: ${subtitleSettings.fontSize}rem !important;
          color: ${subtitleSettings.color} !important;
          background-color: rgba(0, 0, 0, 0.7) !important;
          bottom: ${subtitleSettings.position}% !important;
        }
      `;
        // Clear existing rules and add new one
        if (sheet.cssRules.length > 0) {
            sheet.deleteRule(0);
        }
        sheet.insertRule(css, 0);
    }
    return () => {
      document.getElementById('cinesync-subtitle-styles')?.remove();
    };
  }, [subtitleSettings]);

  // -------------------------------
  // Local video event listeners
  // -------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => syncState({ isPlaying: true });
    const onPause = () => {
        if (!isSeeking.current) syncState({ isPlaying: false });
    };
    const onTimeUpdate = () => {
      if (!isSeeking.current) {
        const currentTime = video.currentTime;
        setProgress(currentTime);
        if (Date.now() - lastSyncTimestamp.current > 3000) {
          syncState({ progress: currentTime });
          lastSyncTimestamp.current = Date.now();
        }
      }
    };
    const onDurationChange = () => {
      if (video.duration !== Infinity) setDuration(video.duration);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", onDurationChange);
    video.addEventListener("loadeddata", loadTracks);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", onDurationChange);
      video.removeEventListener("loadeddata", loadTracks);
    };
  }, [videoSrc, syncState, loadTracks]);

  // -------------------------------
  // UI behavior
  // -------------------------------
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleMouseLeave = () => {
    if (roomState?.isPlaying) setShowControls(false);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // -------------------------------
  // Render states
  // -------------------------------
  if (isLoading) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <h2 className="text-2xl font-bold">Loading Room...</h2>
        <p className="text-muted-foreground max-w-sm">Getting things ready for your watch party.</p>
      </div>
    );
  }

  if (!videoSrc) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{roomState?.fileName ? "Join the session" : "Select a video to start"}</h2>
        <p className="text-muted-foreground max-w-sm">
          {roomState?.fileName ? (
            <>The group is watching <span className="font-bold text-foreground">{roomState?.fileName}</span>. Choose the same file to join in.</>
          ) : (
            "Choose a video file to begin the watch party. Playback will sync with others who load the same file."
          )}
        </p>
        <Button asChild className="mt-4"><label htmlFor="video-upload" className="cursor-pointer">Choose Video File</label></Button>
        <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  const isPlaybackDisabled = fileName !== roomState?.fileName;
  if (isPlaybackDisabled && videoRef.current && !videoRef.current.paused) videoRef.current.pause();

  // -------------------------------
  // Final UI
  // -------------------------------
  return (
    <div ref={playerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" onClick={togglePlay} onDoubleClick={toggleFullScreen} crossOrigin="anonymous" />
      
      {isPlaybackDisabled && roomState?.fileName && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>File Mismatch</AlertTitle>
            <AlertDescription>
              The video you selected (<span className="font-bold">{fileName}</span>) is different from the one being played in the room (<span className="font-bold">{roomState.fileName}</span>). Please select the correct file to sync with the group.
            </AlertDescription>
            <div className="mt-4">
              <Button asChild variant="secondary"><label htmlFor="video-upload-mismatch" className="cursor-pointer">Choose Correct Video File</label></Button>
              <input id="video-upload-mismatch" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            </div>
          </Alert>
        </div>
      )}

      <div className={cn("absolute inset-0 bg-black/20 transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0", "pointer-events-none")} />
      
      <div className={cn("absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-10", showControls || !roomState?.isPlaying ? "opacity-100" : "opacity-0", "pointer-events-auto")}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white">{formatTime(progress)}</span>
            <Slider value={[progress]} max={duration} step={1} onValueChange={handleProgressChange} onValueCommit={handleProgressChangeCommit} className="flex-1" disabled={isPlaybackDisabled} />
            <span className="text-xs font-mono text-white">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20 hover:text-white" disabled={isPlaybackDisabled}>
                {roomState?.isPlaying ? <Pause /> : <Play />}
              </Button>
              <div className="flex items-center gap-2 w-32">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 hover:text-white" >
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                </Button>
                <Slider value={[isMuted ? 0 : volume]} max={1} step={0.05} onValueChange={handleVolumeChange} />
              </div>
            </div>

            <div className="flex items-center gap-1">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-white" disabled={isPlaybackDisabled}><Settings /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <h4 className="font-medium leading-none">Subtitles</h4>
                                <Select onValueChange={setSelectedTextTrack} value={selectedTextTrack}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subtitle" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="off">Off</SelectItem>
                                        {textTracks.map((track, i) => (
                                            <SelectItem key={track.id || `track-${i}`} value={track.label || `track-${i}`}>{track.label} ({track.language})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2 pt-2">
                                    <Button size="sm" variant="outline" asChild><label htmlFor="subtitle-upload" className="cursor-pointer flex items-center gap-2"><Upload className="w-4 h-4" /> Upload (.srt, .vtt)</label></Button>
                                    <input id="subtitle-upload" type="file" accept=".srt,.vtt" onChange={handleSubtitleUpload} className="hidden" />
                                    <Button size="sm" variant="outline" disabled>Search Online</Button>
                                </div>
                            </div>
                            {selectedTextTrack !== "off" && (
                              <div className="grid gap-4">
                                <h4 className="font-medium leading-none">Subtitle Style</h4>
                                <div className="grid grid-cols-2 items-center gap-4">
                                  <Label htmlFor="font-size">Font Size</Label>
                                  <Slider id="font-size" value={[subtitleSettings.fontSize]} min={0.5} max={2.5} step={0.1} onValueChange={([val]) => setSubtitleSettings(s => ({ ...s, fontSize: val }))} />
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                  <Label htmlFor="font-color">Font Color</Label>
                                  <Input id="font-color" type="color" value={subtitleSettings.color} onChange={(e) => setSubtitleSettings(s => ({ ...s, color: e.target.value }))} className="p-1 h-8" />
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                  <Label htmlFor="position">Position</Label>
                                  <Slider id="position" value={[subtitleSettings.position]} min={0} max={80} step={1} onValueChange={([val]) => setSubtitleSettings(s => ({ ...s, position: val }))} />
                                </div>
                              </div>
                            )}
                            {audioTracks.length > 1 && (
                                <div className="grid gap-2">
                                    <h4 className="font-medium leading-none">Audio Track</h4>
                                    <Select onValueChange={handleAudioTrackChange} value={selectedAudioTrack}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Select audio track" /></SelectTrigger>
                                        <SelectContent>
                                            {audioTracks.map((track: any, i) => (
                                                <SelectItem key={track.id || `audio-${i}`} value={track.id}>{track.label || `Track ${i+1}`} ({track.language})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

              <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-white hover:bg-white/20 hover:text-white"><Maximize /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
