

"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chat } from './chat';
import { ContentSuggester } from './content-suggester';
import { VideoPlayer } from './video-player';
import { Users, Clapperboard, MessageSquare, LogOut, Link as LinkIcon, Play } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { database } from '@/lib/firebase';
import { ref, onValue, off, update, serverTimestamp, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Message {
    id: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
    text: string;
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
  
  const { toast } = useToast();
  const initialLoadRef = useRef(true);
  const userStatusRef = useRef<any>(null);
  const roomStateRef = ref(database, `rooms/${roomId}/video`);

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

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      } else if (userList.length > activeUsers.length) {
        const newUsers = userList.filter(u => !activeUsers.some(au => au.id === u.id));
        const currentUser = JSON.parse(localStorage.getItem('cinesync_user') || '{}');

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
  }, [roomId, activeUsers, toast]);

  const handleSetVideoUrl = () => {
    if(videoUrl.trim()){
      // Validate URL roughly
      try {
        new URL(videoUrl);
        set(roomStateRef, {
          videoUrl: videoUrl,
          fileName: new URL(videoUrl).pathname.split('/').pop() || 'Video from URL',
          isPlaying: false,
          progress: 0,
        });
        setIsUrlDialogOpen(false);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Invalid URL',
          description: 'Please enter a valid video URL.',
        })
      }
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

  if (!roomId) {
    return null; // Or a loading state
  }

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
            <div className="flex items-center gap-4">
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
                      />
                    </div>
                  </div>
                  <Button onClick={handleSetVideoUrl}>
                    <Play className="w-4 h-4 mr-2" />
                    Play Video
                  </Button>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-5 h-5"/>
                  <span>{activeUsers.length} watching</span>
              </div>
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
                  <SheetContent side="right" className="w-[350px] p-0 flex flex-col bg-card">
                     <SheetHeader className="p-4 border-b">
                        <SheetTitle>Chat & Tools</SheetTitle>
                     </SheetHeader>
                     <div className="flex-1 min-h-0">
                        <Chat roomId={roomId} onNewMessage={handleNewMessage} />
                      </div>
                      <div className="border-t border-border">
                        <ContentSuggester />
                      </div>
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
          />
        </div>
      </main>
      <aside className="w-[350px] bg-card border-l border-border flex-col hidden md:flex">
        <div className="flex-1 min-h-0">
          <Chat roomId={roomId} onNewMessage={handleNewMessage} />
        </div>
        <div className="border-t border-border">
          <ContentSuggester />
        </div>
      </aside>
    </div>
  );
}
