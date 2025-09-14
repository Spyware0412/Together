
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chat } from './chat';
import { ContentSuggester } from './content-suggester';
import { VideoPlayer } from './video-player';
import { Clapperboard, MessageSquare, Play } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { database } from '@/lib/firebase';
import { ref, onValue, off, update, serverTimestamp, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingAnimation } from '@/components/loading-animation';
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

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const prevMessagesRef = useRef<Message[]>([]);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState<UserProfile | null>(null);
  
  const { toast } = useToast();
  const userStatusRef = useRef<any>(null);
  const roomStateRef = ref(database, `rooms/${roomId}/video`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUsersRef = useRef<UserProfile[]>([]);
  
  useEffect(() => {
    activeUsersRef.current = activeUsers;
  }, [activeUsers]);

  useEffect(() => {
    const storedUser = localStorage.getItem('cinesync_user');
    if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
    }

    const savedTheme = localStorage.getItem('cinesync-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('cinesync-theme', newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
  };

  useEffect(() => {
    prevMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;

    // --- User presence ---
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

    // --- Message handling ---
    const messagesRef = ref(database, `rooms/${roomId}/chat`);
    const onMessages = (snapshot: any) => {
        const data = snapshot.val();
        if (data) {
            const messageList: Message[] = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => a.timestamp - b.timestamp);

            const oldMessages = prevMessagesRef.current;
            setMessages(messageList);

            if (oldMessages.length > 0 && messageList.length > oldMessages.length) {
                const newMessages = messageList.slice(oldMessages.length);
                const currentUser = JSON.parse(localStorage.getItem('cinesync_user') || '{}');
                const otherUserMessages = newMessages.filter(msg => msg.user.id !== currentUser.id);

                if (otherUserMessages.length > 0) {
                    handleNewMessage(otherUserMessages[otherUserMessages.length - 1]);
                }
            }
        }
    };
    onValue(messagesRef, onMessages);


    return () => {
      off(usersRef, 'value', onUsersChange);
      off(messagesRef, 'value', onMessages);
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
        <Chat 
            roomId={roomId} 
            messages={messages}
            activeUsers={activeUsers}
            user={user}
            setUser={setUser}
            theme={theme}
            toggleTheme={toggleTheme}
            handleLeaveRoom={handleLeaveRoom}
        />
      </div>
      <div className="border-t border-border">
        <ContentSuggester />
      </div>
    </>
  );

  return (
    <div className="flex h-screen max-h-screen bg-background text-foreground overflow-hidden">
      <main className="flex-1 flex flex-col p-2 lg:p-4 gap-4">
        <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
                <Clapperboard className="w-6 h-6 text-primary flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <h1 className="text-lg font-semibold truncate">
                    Room
                  </h1>
                  <span className="font-mono text-sm text-primary bg-accent px-2 py-1 rounded-md truncate">{roomId}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
               <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
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
                      <LoadingAnimation width="24px" height="24px" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Play Video
                  </Button>
                </DialogContent>
              </Dialog>

               <Button variant="outline" size="sm" onClick={handleChangeVideoClick}>
                  Change Video
              </Button>
            
              <div className="lg:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full max-w-sm p-0 flex flex-col bg-background/80 backdrop-blur-sm">
                     <ChatComponents />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
        </header>
        <div className="flex-1 w-full h-full min-h-0 rounded-lg overflow-hidden">
          <VideoPlayer 
            roomId={roomId}
            user={user}
            messages={messages}
            lastMessage={lastMessage}
            showNotification={showNotification}
            onNotificationClick={handleNotificationClick}
            onCloseNotification={closeNotification}
            fileInputRef={fileInputRef}
          />
        </div>
      </main>
      <aside className="w-[350px] border-l border-border flex-col hidden lg:flex">
         <ChatComponents />
      </aside>
    </div>
  );
}

    