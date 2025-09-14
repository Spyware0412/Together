
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Film,
  Settings,
  Upload,
  Search,
  Download,
  ArrowLeft,
  X,
  Info,
  MessageSquare,
  Send,
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
  push,
} from "firebase/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingAnimation } from "@/components/loading-animation";

interface Message {
    id: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
    text?: string;
    gif?: string;
    type: 'text' | 'gif';
    timestamp: number;
}

interface VideoPlayerProps {
  roomId: string;
  user: UserProfile | null;
  messages: Message[];
  lastMessage: Message | null;
  showNotification: boolean;
  onNotificationClick: () => void;
  onCloseNotification: (e?: React.MouseEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

interface RoomState {
  videoUrl?: string | null;
  fileName?: string | null;
  isPlaying: boolean;
  progress: number;
}

interface SubtitleSettings {
  fontSize: number;
  color: string;
  position: number;
}

interface SubtitleSearchResult {
  language: string;
  url: string;
  fileName: string;
}

interface TmdbMovieSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string;
}


// Helper function to convert SRT subtitles to VTT format
const srtToVtt = (srtText: string): string => {
  let vtt = "WEBVTT\n\n";
  const srtLines = srtText.trim().replace(/\r/g, '').split('\n');

  let i = 0;
  while (i < srtLines.length) {
    if (srtLines[i].match(/^\d+$/) && srtLines[i+1]?.includes('-->')) {
      const timeLine = srtLines[i+1].replace(/,/g, '.');
      vtt += timeLine + "\n";
      i += 2;

      let text = "";
      while (i < srtLines.length && srtLines[i].trim() !== "") {
        text += srtLines[i] + "\n";
        i++;
      }
      vtt += text.trim() + "\n\n";
    } else {
        i++;
    }
  }
  return vtt;
};

export function VideoPlayer({ roomId, user, messages, lastMessage, showNotification, onNotificationClick, onCloseNotification, fileInputRef }: VideoPlayerProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const [selectedTextTrack, setSelectedTextTrack] = useState<string>("off");
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    fontSize: 1,
    color: "#FFFFFF",
    position: 5,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [movieSearchResults, setMovieSearchResults] = useState<TmdbMovieSearchResult[]>([]);
  const [subtitleSearchResults, setSubtitleSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState<'movie' | 'subtitle'>('movie');
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieSearchResult | null>(null);
  const [isChatOverlayOpen, setIsChatOverlayOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const externalSubtitlesRef = useRef<Map<string, string>>(new Map());
  const localVideoUrlRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatViewportRef = useRef<HTMLDivElement>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(0);
  const isRemoteUpdate = useRef(false);

  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const messagesRef = ref(database, `rooms/${roomId}/chat`);

  useEffect(() => {
    if (chatViewportRef.current) {
        chatViewportRef.current.scrollTo({ top: chatViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isChatOverlayOpen]);


  const handleSendChatMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatMessage.trim() && user) {
            const msg = {
                user: { id: user.id, name: user.name, avatar: user.avatar },
                text: chatMessage.trim(),
                type: 'text',
                timestamp: serverTimestamp()
            };
            push(messagesRef, msg);
            setChatMessage('');
        }
    };

  useEffect(() => {
    let userStatusRef: any;
    const storedUser = localStorage.getItem('cinesync_user');
    
    if (storedUser) {
        const user: UserProfile = JSON.parse(storedUser);
        userStatusRef = ref(database, `rooms/${roomId}/users/${user.id}`);
        set(userStatusRef, { ...user, online: true, last_seen: serverTimestamp() });
        onDisconnect(userStatusRef).update({ online: false, last_seen: serverTimestamp() });
    }

    const onStateChange = (snapshot: any) => {
      const data: RoomState | null = snapshot.val();
      setIsLoading(false);
      isRemoteUpdate.current = true;
      setRoomState(data);
      
      if (data?.videoUrl) {
          if (localVideoUrlRef.current) {
              URL.revokeObjectURL(localVideoUrlRef.current);
              localVideoUrlRef.current = null;
          }
          if (videoSrc !== data.videoUrl) {
              setVideoSrc(data.videoUrl);
          }
          setLocalFileName(data.fileName ?? "Video from URL");
      } else if (data?.fileName) {
          if (videoSrc && !localVideoUrlRef.current) {
              setVideoSrc(null);
          }
          setLocalFileName(data.fileName);
      } else {
          if (localVideoUrlRef.current) {
              URL.revokeObjectURL(localVideoUrlRef.current);
              localVideoUrlRef.current = null;
          }
          setVideoSrc(null);
          setLocalFileName(null);
      }

      if (videoRef.current && data) {
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

      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 100);
    };

    onValue(roomStateRef, onStateChange);

    return () => {
      off(roomStateRef, "value", onStateChange);
      if (userStatusRef) {
          onDisconnect(userStatusRef).cancel();
          update(userStatusRef, { online: false, last_seen: serverTimestamp() });
      }
      if(localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current);
    };
  }, [roomId]);

  const syncState = useCallback((state: Partial<RoomState>) => {
      if (isRemoteUpdate.current) return;
      update(roomStateRef, state);
  }, [roomStateRef]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current);
      externalSubtitlesRef.current.forEach(URL.revokeObjectURL);
      externalSubtitlesRef.current.clear();
      
      const newVideoSrc = URL.createObjectURL(file);
      localVideoUrlRef.current = newVideoSrc;
      
      setVideoSrc(newVideoSrc);
      
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      setSearchQuery(cleanFileName);
      setLocalFileName(file.name); 
      
      set(roomStateRef, {
        fileName: file.name,
        isPlaying: false,
        progress: 0,
        videoUrl: null, 
      });

      if (videoRef.current) videoRef.current.currentTime = 0;
      setProgress(0);
      setSelectedTextTrack("off");
      setMovieSearchResults([]);
      setSubtitleSearchResults([]);
      setSearchStep('movie');
    }
  };

  const loadTracks = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    setTimeout(() => {
      const availableTextTracks = Array.from(video.textTracks);
      setTextTracks(availableTextTracks);

      const firstSub = availableTextTracks.find(t => t.kind === 'subtitles');
      if (firstSub && selectedTextTrack === 'off') {
        availableTextTracks.forEach(t => t.mode = 'hidden');
        firstSub.mode = 'showing';
        setSelectedTextTrack(firstSub.label || `track-${firstSub.language}`);
      } else {
        availableTextTracks.forEach(track => {
            track.mode = (track.label === selectedTextTrack || track.id === selectedTextTrack) ? 'showing' : 'hidden';
        });
      }
    }, 500);
  }, [selectedTextTrack]);

  const handleSubtitleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && videoRef.current) {
        if(file.name.endsWith('.srt')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const srtText = e.target?.result as string;
            const vttText = srtToVtt(srtText);
            const blob = new Blob([vttText], { type: 'text/vtt' });
            const trackUrl = URL.createObjectURL(blob);
            addTrackToVideo(trackUrl, file.name.replace('.srt', '.vtt'), 'en');
          };
          reader.readAsText(file);
        } else {
          const trackUrl = URL.createObjectURL(file);
          addTrackToVideo(trackUrl, file.name, 'en');
        }
    }
  };
  
  const addTrackToVideo = (trackUrl: string, label: string, language: string, isExternal = true) => {
    if (!videoRef.current) return;
    const trackId = `${isExternal ? 'external-' : ''}${label}`;
    
    const oldTrackEl = playerRef.current?.querySelector(`track[id="${trackId}"]`);
    if(oldTrackEl) oldTrackEl.remove();

    const trackElement = document.createElement('track');
    trackElement.id = trackId;
    trackElement.kind = 'subtitles';
    trackElement.label = label;
    trackElement.srclang = language;
    trackElement.src = trackUrl;
    
    videoRef.current.appendChild(trackElement);
    if(isExternal) {
      externalSubtitlesRef.current.set(trackId, trackUrl);
    }
    
    setTimeout(() => {
        loadTracks();
        setSelectedTextTrack(label);
        toast({ title: "Success", description: "Subtitle file loaded."});
    }, 100);
  }

  const handleMovieSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    setMovieSearchResults([]);
    setSubtitleSearchResults([]);
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(searchQuery)}`);
      const data: TmdbMovieSearchResult[] | {error: string} = await res.json();
      
      if (res.ok && Array.isArray(data)) {
          setMovieSearchResults(data);
          if (data.length === 0) {
            toast({ variant: 'destructive', title: 'No Movies Found', description: 'Could not find any movies for this query.' });
          }
      } else {
          const error = Array.isArray(data) ? {error: 'Unknown error'} : data;
          toast({ variant: 'destructive', title: 'Error Searching Movies', description: error.error });
      }
    } catch (err) {
      console.error("Movie search failed:", err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to search for movies.' });
    } finally {
      setIsSearching(false);
    }
  }

  const handleSubtitleSearch = async (movie: TmdbMovieSearchResult) => {
    setSelectedMovie(movie);
    setSearchStep('subtitle');
    setIsSearching(true);
    setSubtitleSearchResults([]);
    try {
      const res = await fetch(`/api/subtitles?tmdb_id=${movie.id}`);
      const subs: SubtitleSearchResult[] | {error: string} = await res.json();
      
      if (res.ok && Array.isArray(subs)) {
          setSubtitleSearchResults(subs);
          if (subs.length === 0) {
            toast({ variant: 'destructive', title: 'No Subtitles Found', description: `No subtitles found for ${movie.title}.` });
          }
      } else {
          const error = Array.isArray(subs) ? {error: 'Unknown error'} : subs;
          toast({ variant: 'destructive', title: 'Error Searching Subtitles', description: error.error });
      }
    } catch (err) {
      console.error("Subtitle search failed:", err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to search for subtitles.' });
    } finally {
      setIsSearching(false);
    }
  }

  const loadOnlineSubtitle = (subtitle: SubtitleSearchResult) => {
    addTrackToVideo(subtitle.url, subtitle.fileName, subtitle.language, false);
    resetSearch();
    toast({ title: 'Subtitle Loaded', description: `${subtitle.fileName} has been added.`});
  }

  const resetSearch = () => {
    setSearchStep('movie');
    setMovieSearchResults([]);
    setSubtitleSearchResults([]);
    setSelectedMovie(null);
  }

  const togglePlay = () => {
    if (!videoRef.current || isPlaybackDisabled) return;
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
      if (!newMuted && volume === 0) handleVolumeChange([0.5]);
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
    const player = playerRef.current;
    if (player) {
      if (!document.fullscreenElement) {
        player.requestFullscreen().catch((err) => {
          console.error(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };
  
  useEffect(() => {
    textTracks.forEach((track) => {
        track.mode = (track.label === selectedTextTrack || track.id === selectedTextTrack) ? 'showing' : 'hidden';
    });
    if (selectedTextTrack === 'off') {
        textTracks.forEach(t => t.mode = 'hidden');
    }
  }, [selectedTextTrack, textTracks]);
  
  useEffect(() => {
    const styleId = 'cinesync-subtitle-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    
    const sheet = styleElement.sheet;
    if (sheet) {
        if (sheet.cssRules.length > 0) sheet.deleteRule(0);
        sheet.insertRule(\`
        ::cue {
          font-size: \${subtitleSettings.fontSize}rem !important;
          color: \${subtitleSettings.color} !important;
          background-color: rgba(0, 0, 0, 0.7) !important;
          bottom: \${subtitleSettings.position}% !important;
        }
      \`, 0);
    }
  }, [subtitleSettings]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => syncState({ isPlaying: true });
    const onPause = () => !isSeeking.current && syncState({ isPlaying: false });
    const onTimeUpdate = () => {
      if (isSeeking.current) return;
      const currentTime = video.currentTime;
      setProgress(currentTime);
      if (Date.now() - lastSyncTimestamp.current > 3000) {
        syncState({ progress: currentTime });
        lastSyncTimestamp.current = Date.now();
      }
    };
    const onDurationChange = () => video.duration !== Infinity && setDuration(video.duration);

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
  }, [syncState, loadTracks]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleMouseLeave = () => { if (roomState?.isPlaying) setShowControls(false); };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return \`\${minutes}:\${seconds.toString().padStart(2, "0")}\`;
  };

  if (isLoading) {
    return (
      <div className="w-full h-full bg-background flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <LoadingAnimation />
        <h2 className="text-2xl font-bold">Loading Room...</h2>
        <p className="text-muted-foreground max-w-sm">Getting things ready for your watch party.</p>
      </div>
    );
  }
  
  const hasVideoSource = !!videoSrc;
  const isPlaybackDisabled = roomState?.fileName && !roomState.videoUrl && !localVideoUrlRef.current;

  if (isPlaybackDisabled && videoRef.current && !videoRef.current.paused) videoRef.current.pause();

  if (!hasVideoSource && !roomState?.fileName) {
    return (
      <div className="w-full h-full bg-background flex flex-col items-center justify-center gap-4 text-center rounded-lg p-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Select a video to start</h2>
        <p className="text-muted-foreground max-w-sm">
          Choose a video file or load a URL to begin the watch party. Playback will sync with others.
        </p>
        <Button asChild className="mt-4"><label htmlFor="video-upload" className="cursor-pointer">Choose Video File</label></Button>
        <input id="video-upload" type="file" accept="video/*,.mkv" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
      </div>
    );
  }

  return (
    <div ref={playerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <video ref={videoRef} src={videoSrc ?? undefined} className="w-full h-full object-contain" onClick={togglePlay} onDoubleClick={toggleFullScreen} crossOrigin="anonymous" preload="metadata" />
      <input id="video-upload" type="file" accept="video/*,.mkv" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
      
      {isPlaybackDisabled && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <Alert className="max-w-md">
            <Info className="h-4 w-4" />
            <AlertTitle>Your friends are watching!</AlertTitle>
            <AlertDescription>
              They are watching <span className="font-bold">{roomState?.fileName}</span>. Select your file to sync and join in.
            </AlertDescription>
            <div className="mt-4">
              <Button asChild variant="secondary"><label htmlFor="video-upload-mismatch" className="cursor-pointer">Choose Video File</label></Button>
              <input id="video-upload-mismatch" type="file" accept="video/*,.mkv" onChange={handleFileChange} className="hidden" />
            </div>
          </Alert>
        </div>
      )}

      {/* Independent Controls in Top Right */}
      <div className={cn(
        "absolute top-0 right-0 z-20 p-2 flex items-center gap-2 transition-opacity duration-300",
        showControls || !roomState?.isPlaying || isSettingsOpen || isInfoOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <DropdownMenu onOpenChange={setIsInfoOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" disabled={isPlaybackDisabled}><Info /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-96" align="end">
            <div className="grid gap-3 p-2">
                <h4 className="font-medium leading-none">Video Info</h4>
                <div className="text-sm space-y-2">
                    <p><span className="font-semibold">File:</span> <span className="text-muted-foreground break-all">{localFileName ?? 'N/A'}</span></p>
                    <p><span className="font-semibold">Source:</span> <span className="text-muted-foreground break-all">{roomState?.videoUrl ? 'URL' : 'Local File'}</span></p>
                    <p><span className="font-semibold">Duration:</span> <span className="text-muted-foreground">{formatTime(duration)}</span></p>
                    <p><span className="font-semibold">Resolution:</span> <span className="text-muted-foreground">{videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}</span></p>
                    <p><span className="font-semibold">Subtitles:</span> <span className="text-muted-foreground">{textTracks.length}</span></p>
                </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu onOpenChange={setIsSettingsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" disabled={isPlaybackDisabled}><Settings /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-96" align="end">
                <div className="grid gap-4 p-2">
                    <div className="grid gap-2">
                        <Label className="font-medium leading-none">Subtitles</Label>
                        <Select onValueChange={setSelectedTextTrack} value={selectedTextTrack}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select subtitle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="off">Off</SelectItem>
                                {textTracks.map((track, i) => (
                                    <SelectItem key={track.id || \`track-\${i}\`} value={track.label || \`track-\${i}\`}>{track.label} ({track.language})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" variant="outline" asChild><label htmlFor="subtitle-upload" className="cursor-pointer flex items-center gap-2"><Upload className="w-4 h-4" /> Upload File</label></Button>
                            <input id="subtitle-upload" type="file" accept=".srt,.vtt" onChange={handleSubtitleUpload} className="hidden" />
                        </div>
                    </div>
                    <Separator/>
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium leading-none">Search Subtitles Online</Label>
                          {searchStep === 'subtitle' && (
                            <Button variant="ghost" size="sm" onClick={resetSearch} className="flex items-center gap-1 text-xs h-auto p-1">
                              <ArrowLeft className="w-3 h-3" /> Back
                            </Button>
                          )}
                        </div>
                        
                        {searchStep === 'movie' && (
                          <form onSubmit={handleMovieSearch} className="flex gap-2">
                              <Input 
                                  placeholder={localFileName || 'e.g., Inception'}
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="bg-input"
                              />
                              <Button type="submit" size="icon" disabled={isSearching}>
                                  {isSearching ? <LoadingAnimation width="24px" height="24px" /> : <Search className="w-4 h-4" />}
                              </Button>
                          </form>
                        )}

                        {isSearching && <div className="flex justify-center p-4"><LoadingAnimation width="60px" height="60px"/></div>}

                        {!isSearching && movieSearchResults.length > 0 && searchStep === 'movie' && (
                            <ScrollArea className="h-60 mt-2 border rounded-md">
                                <div className="p-2 space-y-2">
                                {movieSearchResults.map((movie) => (
                                  <div
                                    key={movie.id}
                                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                                    onClick={() => handleSubtitleSearch(movie)}
                                  >
                                    <div className="w-12 flex-shrink-0">
                                      <Image
                                          src={movie.poster_path ? \`https://image.tmdb.org/t/p/w92\${movie.poster_path}\` : 'https://picsum.photos/seed/1/92/138'}
                                          width={48}
                                          height={72}
                                          alt={\`Poster for \${movie.title}\`}
                                          className="rounded"
                                          unoptimized
                                      />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{movie.title}</p>
                                        <p className="text-xs text-muted-foreground">{movie.release_date.split('-')[0]}</p>
                                    </div>
                                  </div>
                                ))}
                                </div>
                            </ScrollArea>
                        )}
                        
                        {!isSearching && subtitleSearchResults.length > 0 && searchStep === 'subtitle' && (
                            <ScrollArea className="h-60 mt-2 border rounded-md">
                                <div className="p-2 space-y-2">
                                  <div className="font-semibold text-sm p-2">Results for {selectedMovie?.title}</div>
                                  {subtitleSearchResults.map((sub, i) => (
                                    <div
                                        key={i}
                                        className="flex justify-between items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                                        onClick={() => loadOnlineSubtitle(sub)}
                                    >
                                        <div className="flex-1 truncate">
                                            <Badge variant="outline">{sub.language}</Badge>
                                            <span className="ml-2 text-sm text-muted-foreground truncate">{sub.fileName}</span>
                                        </div>
                                        <Download className="w-4 h-4"/>
                                    </div>
                                  ))}
                                </div>
                            </ScrollArea>
                        )}

                    </div>

                    {selectedTextTrack !== "off" && (
                      <>
                        <Separator />
                        <div className="grid gap-4">
                          <Label className="font-medium leading-none">Subtitle Style</Label>
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
                      </>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Controls Bar */}
      <div className={cn(
          "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
          showControls || !roomState?.isPlaying || isChatOverlayOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white">{formatTime(progress)}</span>
            <Slider value={[progress]} max={duration} step={1} onValueChange={handleProgressChange} onValueCommit={handleProgressChangeCommit} className="flex-1" disabled={isPlaybackDisabled} />
            <span className="text-xs font-mono text-white">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10" disabled={isPlaybackDisabled}>
                {roomState?.isPlaying ? <Pause /> : <Play />}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/10" >
                    {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                </Button>
                <Slider value={[isMuted ? 0 : volume]} max={1} step={0.05} onValueChange={handleVolumeChange} className="w-24" />
              </div>
            </div>

            <div className="flex items-center gap-1 text-white">
              <Button variant="ghost" size="icon" onClick={() => setIsChatOverlayOpen(v => !v)} className="text-white hover:bg-white/10" disabled={isPlaybackDisabled}><MessageSquare /></Button>
              <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-white hover:bg-white/10"><Maximize /></Button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNotification && lastMessage && (
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ ease: "easeInOut", duration: 0.3 }}
                className="absolute bottom-24 right-5 z-30"
            >
                <div 
                    className="p-3 rounded-lg bg-popover/80 backdrop-blur-sm border border-border shadow-2xl cursor-pointer w-80"
                    onClick={onNotificationClick}
                >
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">New Message</p>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onCloseNotification}>
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>
                    <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 border">
                            <AvatarImage src={lastMessage.user.avatar} alt={lastMessage.user.name} />
                            <AvatarFallback>{lastMessage.user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-semibold text-sm">{lastMessage.user.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                                {lastMessage.type === 'gif' ? 'Sent a GIF' : lastMessage.text}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isChatOverlayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}
            className="absolute bottom-0 left-0 z-20 p-4 w-full md:w-96"
          >
            <div className="h-[40vh] bg-background/80 backdrop-blur-sm border border-border rounded-lg flex flex-col">
              <div className="p-2 border-b flex justify-between items-center">
                  <h3 className="font-semibold px-2">Live Chat</h3>
                  <Button variant="ghost" size="icon" onClick={() => setIsChatOverlayOpen(false)}>
                      <X className="w-4 h-4" />
                  </Button>
              </div>
              <ScrollArea className="flex-1">
                  <ScrollAreaViewport ref={chatViewportRef} className="px-4 py-2">
                       <div className="space-y-4 pb-4">
                      {messages.map((message) => (
                          <div key={message.id} className="flex items-start gap-3">
                              <Avatar className="w-8 h-8 border">
                                  <AvatarImage src={message.user.avatar} alt={message.user.name} />
                                  <AvatarFallback>{message.user.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                  <p className="font-semibold text-sm text-foreground">{user?.id === message.user.id ? "You" : message.user.name}</p>
                                  {message.type === 'gif' ? (
                                      <div className="mt-1 bg-secondary rounded-lg overflow-hidden w-fit">
                                          <Image 
                                            src={message.gif!} 
                                            alt="gif" 
                                            width={150}
                                            height={0}
                                            style={{ height: 'auto', objectFit: 'contain' }}
                                            unoptimized
                                            className="max-w-[150px] h-auto"
                                          />
                                      </div>
                                  ) : (
                                      <div className="text-sm bg-secondary p-2 rounded-lg mt-1 w-fit max-w-full">
                                          <p className="break-words text-secondary-foreground">{message.text}</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                  </ScrollAreaViewport>
              </ScrollArea>
              <div className="p-2 border-t">
                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                       <Input
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 bg-input"
                          autoComplete="off"
                      />
                      <Button type="submit" size="icon" variant="accent">
                          <Send className="w-4 h-4" />
                      </Button>
                  </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
