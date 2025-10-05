
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
import type { UserProfile } from '@/components/auth-form';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const externalSubtitlesRef = useRef<Map<string, string>>(new Map());
  const localVideoUrlRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatViewportRef = useRef<HTMLDivElement>(null);
  const isSeeking = useRef(false);
  const lastSyncTimestamp = useRef(0);
  const isRemoteUpdate = useRef(false);

  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const messagesRef = ref(database, `rooms/${roomId}/chat`);
  const videoInfoRef = useRef({width: 0, height: 0});
  
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

      const video = videoRef.current;
      if (video && data) {
        const serverTime = data.progress ?? 0;
        const clientTime = video.currentTime;
        if (Math.abs(serverTime - clientTime) > 2) {
          video.currentTime = serverTime;
        }

        const serverPlaying = data.isPlaying ?? false;
        if (serverPlaying !== !video.paused) {
          if (serverPlaying) video.play().catch(() => {});
          else video.pause();
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
      setMovieSearchResults([]);
      setSubtitleSearchResults([]);
      
      set(roomStateRef, {
        fileName: file.name,
        isPlaying: false,
        progress: 0,
        videoUrl: null, 
      });

      if (videoRef.current) videoRef.current.currentTime = 0;
      setProgress(0);
      setSelectedTextTrack("off");
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
            track.mode = (track.label === selectedTextTrack) ? 'showing' : 'hidden';
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
    const video = videoRef.current;
    if (!video) return;

    const trackId = `${isExternal ? 'external-' : ''}${label}`;

    // Remove existing track if any
    const existingTracks = Array.from(video.textTracks).filter(t => t.label === label);
    existingTracks.forEach(track => {
        // We can't directly remove text tracks. Instead we disable them.
        track.mode = 'disabled';
    });

    // Create a new track element and append it
    const trackElement = document.createElement('track');
    trackElement.id = trackId;
    trackElement.kind = 'subtitles';
    trackElement.label = label;
    trackElement.srclang = language;
    trackElement.src = trackUrl;
    trackElement.default = false; // Set to false to manage manually
    
    // Clear old external ref for this label
    const oldUrl = externalSubtitlesRef.current.get(label);
    if(oldUrl) URL.revokeObjectURL(oldUrl);

    if(isExternal) {
      externalSubtitlesRef.current.set(label, trackUrl);
    }
    
    video.appendChild(trackElement);
    
    setTimeout(() => {
        loadTracks();
        setSelectedTextTrack(label);
        toast({ title: "Success", description: "Subtitle file loaded."});
    }, 500);
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
      const data: SubtitleSearchResult[] | {error: string} = await res.json();
      
      if (res.ok && Array.isArray(data)) {
          setSubtitleSearchResults(data);
          if (data.length === 0) {
            toast({ variant: 'destructive', title: 'No Subtitles Found', description: `No subtitles found for ${movie.title}.` });
          }
      } else {
          const error = Array.isArray(data) ? {error: 'Unknown error'} : data;
          toast({ variant: 'destructive', title: 'Error Searching Subtitles', description: error.error });
      }
    } catch (err) {
      console.error("Subtitle search failed:", err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to search for subtitles.' });
    } finally {
      setIsSearching(false);
    }
  }

  const loadOnlineSubtitle = async (subtitle: SubtitleSearchResult) => {
      try {
        const response = await fetch(subtitle.url);
        if (!response.ok) {
            throw new Error(`Failed to download subtitle: ${response.statusText}`);
        }
        const srtText = await response.text();
        const vttText = srtToVtt(srtText);
        const blob = new Blob([vttText], { type: 'text/vtt' });
        const trackUrl = URL.createObjectURL(blob);
        
        addTrackToVideo(trackUrl, subtitle.fileName, subtitle.language, true);

        resetSearch();
        toast({ title: 'Subtitle Loaded', description: `${subtitle.fileName} has been added.`});
    } catch (error: any) {
        console.error("Error loading online subtitle:", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load subtitle.' });
    }
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
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
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
    const container = containerRef.current;
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch((err) => {
          alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        track.mode = (track.label === selectedTextTrack) ? 'showing' : 'hidden';
    }
    if (selectedTextTrack === 'off') {
       for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'hidden';
       }
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
        sheet.insertRule(`
            ::cue {
              font-size: ${subtitleSettings.fontSize}rem !important;
              color: ${subtitleSettings.color} !important;
              background-color: rgba(0, 0, 0, 0.7) !important;
              bottom: ${subtitleSettings.position}% !important;
            }
          `, 0);
    }
  }, [subtitleSettings]);


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
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
    <div ref={containerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <video
        ref={videoRef}
        src={videoSrc || undefined}
        onClick={togglePlay}
        onPlay={() => syncState({ isPlaying: true })}
        onPause={() => !isSeeking.current && syncState({ isPlaying: false })}
        onTimeUpdate={(e) => {
            if (isSeeking.current) return;
            const currentTime = e.currentTarget.currentTime;
            setProgress(currentTime);
            if (Date.now() - lastSyncTimestamp.current > 3000) {
                syncState({ progress: currentTime });
                lastSyncTimestamp.current = Date.now();
            }
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
            setVolume(e.currentTarget.volume);
            setIsMuted(e.currentTarget.muted);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          videoInfoRef.current = { width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight };
        }}
        onLoadedData={loadTracks}
        className="w-full h-full object-contain"
        playsInline
      ></video>
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
        "absolute top-0 right-0 z-20 p-2 flex items-center gap-2 transition-opacity duration-300 pointer-events-auto",
        (showControls || !roomState?.isPlaying) ? "opacity-100" : "opacity-0"
      )}>
        <DropdownMenu onOpenChange={setIsInfoOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              disabled={isPlaybackDisabled}
            >
              <Info />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-96 bg-background shadow-lg rounded-md"
            align="end"
          >
            <div className="grid gap-3 p-2">
              <h4 className="font-medium leading-none">Video Info</h4>
              <div className="text-sm space-y-2">
                <p>
                  <span className="font-semibold">File:</span>{" "}
                  <span className="text-muted-foreground break-all">
                    {localFileName ?? "N/A"}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Source:</span>{" "}
                  <span className="text-muted-foreground break-all">
                    {roomState?.videoUrl ? "URL" : "Local File"}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Duration:</span>{" "}
                  <span className="text-muted-foreground">
                    {formatTime(duration)}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Resolution:</span>{" "}
                  <span className="text-muted-foreground">
                    {videoInfoRef.current.width}x{videoInfoRef.current.height}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Subtitles:</span>{" "}
                  <span className="text-muted-foreground">{textTracks.length}</span>
                </p>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu onOpenChange={setIsSettingsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              disabled={isPlaybackDisabled}
            >
              <Settings />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-96 bg-background shadow-lg rounded-md"
            align="end"
          >
              <div className="grid gap-4 p-2">
                  <div className="grid gap-2">
                      <Label className="font-medium leading-none">Subtitles</Label>
                      <Select onValueChange={setSelectedTextTrack} value={selectedTextTrack}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Select subtitle" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="off">Off</SelectItem>
                              {textTracks.map((track, i) => (
                                  <SelectItem key={track.id || `track-${i}`} value={track.label || `track-${i}`}>{track.label} ({track.language})</SelectItem>
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
                                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : 'https://picsum.photos/seed/1/92/138'}
                                      width={48}
                                      height={72}
                                      alt={`Poster for ${movie.title}`}
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
          (showControls || !roomState?.isPlaying || isChatOverlayOpen) ? "opacity-100" : "opacity-0 pointer-events-none"
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
                className="absolute bottom-24 right-5 z-30 pointer-events-auto"
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
            className="absolute bottom-0 left-0 z-20 p-4 w-full md:w-96 pointer-events-auto"
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
                                            height={150}
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
