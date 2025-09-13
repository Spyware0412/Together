
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Chat } from './chat';
import { ContentSuggester } from './content-suggester';
import { VideoPlayer } from './video-player';
import { Users, Clapperboard, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

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

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const usersRef = ref(database, `rooms/${roomId}/users`);
    const onUsersChange = (snapshot: any) => {
      const usersData = snapshot.val();
      if (usersData) {
        const userList: UserProfile[] = Object.values(usersData).filter((u: any) => u.online);
        
        // Check for new users
        if (userList.length > activeUsers.length) {
          const newUsers = userList.filter(u => !activeUsers.some(au => au.id === u.id));
          newUsers.forEach(newUser => {
            // Don't notify for self
            const currentUser = JSON.parse(localStorage.getItem('cinesync_user') || '{}');
            if (newUser.id !== currentUser.id) {
               toast({
                title: 'User Joined',
                description: `${newUser.name} has joined the room.`,
              });
            }
          });
        }
        
        setActiveUsers(userList);
      } else {
        setActiveUsers([]);
      }
    };

    onValue(usersRef, onUsersChange);

    return () => {
      off(usersRef, 'value', onUsersChange);
    };
  }, [roomId, activeUsers, toast]);


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
              <div className="hidden md:flex items-center gap-2 text-muted-foreground">
                  <Users className="w-5 h-5"/>
                  <span>{activeUsers.length} watching</span>
              </div>
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
