
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chat } from './chat';
import { ContentSuggester } from './content-suggester';
import { VideoPlayer } from './video-player';
import { Users, Clapperboard, MessageSquare, LogOut, Link as LinkIcon, Play, Video, Loader2, Palette } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { database } from '@/lib/firebase';
import { ref, onValue, off, update, serverTimestamp, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { themes, Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

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

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string;
    online?: boolean;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [theme, setTheme] = useState('theme-default');
  
  const { toast } = useToast();
  const userStatusRef = useRef<any>(null);
  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUsersRef = useRef<UserProfile[]>([]);
  
  useEffect(() => {
    activeUsersRef.current = activeUsers;
  }, [activeUsers]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('cinesync-theme-global') || 'theme-default';
    setTheme(savedTheme);
  }, []);

  const handleSetTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('cinesync-theme-global', newTheme);
  };

  useEffect(() => {
    if (!roomId) return;
    const usersRef = ref(database, `rooms/${roomId}/users`);
    const storedUser = localStorage.getItem('cinesync_user');
    
    if (storedUser) {
        const user: UserProfile = JSON.parse(storedUser);
        userStatusRef.current = ref(database, `rooms/${roomId}/users/${user.id}`);
    }

    const onUsersChange = (snapshot: any) => {
      const usersData = snapshot.val();
      const userList: UserProfile[] = usersData ? Object.values(usersData).filter((u: any) => u.online) : [];
      const previousUsers = activeUsersRef.current;
      
      const newUsers = userList.filter(u => !previousUsers.some(au => au.id === u.id));
      const currentUser = JSON.parse(localStorage.getItem('cinesync_user') || '{}');

      if (previousUsers.length > 0 && userList.length > previousUsers.length) { 
        newUsers.forEach(newUser => {
          if (newUser.id !== currentUser.id && newUser.name) {
             toast({
              title: 'User Joined',
              description: `${newUser.name} has joined the room.`,
            });
          }
        });
      }
      
      setActiveUsers(userList);
    };

    onValue(usersRef, onUsersChange);

    return () => {
      off(usersRef, 'value', onUsersChange);
      if (userStatusRef.current) {
        update(userStatusRef.current, { online: false, last_seen: serverTimestamp() });
      }
    };
  }, [roomId, toast]);

  const handleSetVideoUrl = async () => {
    if(!videoUrl.trim()) return;

    try {
        new URL(videoUrl); // Basic URL validation
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Invalid URL',
            description: 'Please enter a valid video URL.',
        });
        return;
    }
    
    setIsResolvingUrl(true);

    try {
        set(roomStateRef, {
            videoUrl: videoUrl,
            fileName: new URL(videoUrl).pathname.split('/').pop() || videoUrl,
            isPlaying: false,
            progress: 0,
        });

        setIsUrlDialogOpen(false);
        setVideoUrl('');

    } catch (error: any) {
        console.error("URL processing error:", error);
        toast({
            variant: 'destructive',
            title: 'Error Loading URL',
            description: error.message || 'Could not load the provided video URL.',
        });
    } finally {
        setIsResolvingUrl(false);
    }
  }


  const handleNewMessage = useCallback((message: Message) => {
    if (!isSheetOpen) {
      setLastMessage(message);
      setShowNotification(true);
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isSheetOpen]);

  const handleNotificationClick = () => {
    setShowNotification(false);
    setIsSheetOpen(true);
  };
  
  const closeNotification = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowNotification(false);
  }

  const handleLeaveRoom = () => {
    if (userStatusRef.current) {
      update(userStatusRef.current, { online: false, last_seen: serverTimestamp() }).then(() => {
        router.push('/');
      });
    } else {
      router.push('/');
    }
  };
  
  const handleChangeVideoClick = () => {
    fileInputRef.current?.click();
  };

  if (!roomId) {
    return null; // Or a loading state
  }
  
  const ChatComponents = () => (
    <>
      <div className="flex-1 min-h-0">
        <Chat roomId={roomId} onNewMessage={handleNewMessage} />
      </div>
      <div className="border-t border-border">
        <ContentSuggester />
      </div>
    </>
  );

  return (
    <div className="flex h-screen max-h-screen bg-background text-foreground overflow-hidden relative">
      <main className="flex-1 flex flex-col p-2 md:p-4 gap-4">
        <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Clapperboard className="w-6 h-6 text-primary" />
                <h1 className="text-lg md:text-xl font-semibold">
                  Room: <span className="font-mono text-primary bg-white/10 px-2 py-1 rounded-md">{roomId}</span>
                </h1>
            </div>
            <div className="flex items-center gap-2">
               <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Load URL
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Play from URL</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="video-url" className="text-right">
                        URL
                      </Label>
                      <Input
                        id="video-url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className="col-span-3 bg-input"
                        disabled={isResolvingUrl}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSetVideoUrl} disabled={isResolvingUrl}>
                    {isResolvingUrl ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Play Video
                  </Button>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Palette className="w-4 h-4 mr-2" />
                    Theme
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Select a Theme</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={theme} onValueChange={handleSetTheme}>
                    {themes.map((themeOption) => (
                      <DropdownMenuRadioItem key={themeOption.name} value={themeOption.name}>
                        {themeOption.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Users className="w-5 h-5"/>
                        <span>{activeUsers.length} watching</span>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <DropdownMenuLabel>Users in Room ({activeUsers.length})</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {activeUsers.length > 0 ? (
                    activeUsers.map(user => (
                      <DropdownMenuItem key={user.id} className="gap-2">
                         <Avatar className="w-6 h-6">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{user.name}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                     <DropdownMenuItem disabled>No other users online</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

               <Button variant="ghost" size="icon" onClick={handleChangeVideoClick} title="Change Video">
                  <Video className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLeaveRoom} title="Leave Room">
                  <LogOut className="w-5 h-5 text-muted-foreground" />
              </Button>
              <div className="md:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className={cn("w-[350px] p-0 flex flex-col", theme)}>
                     <SheetHeader className="p-4 border-b">
                        <SheetTitle>Chat & Tools</SheetTitle>
                     </SheetHeader>
                     <ChatComponents />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
        </header>
        <div className="flex-1 w-full h-full min-h-0 rounded-lg overflow-hidden">
          <VideoPlayer 
            roomId={roomId}
            lastMessage={lastMessage}
            showNotification={showNotification}
            onNotificationClick={handleNotificationClick}
            onCloseNotification={closeNotification}
            fileInputRef={fileInputRef}
          />
        </div>
      </main>
      <aside className={cn("w-[350px] border-l border-border flex-col hidden md:flex", theme)}>
         <ChatComponents />
      </aside>
    </div>
  );
}

    