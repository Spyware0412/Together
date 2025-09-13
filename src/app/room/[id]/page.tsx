"use client";

import { useState, useCallback } from 'react';
import { Chat } from './chat';
import { ContentSuggester } from './content-suggester';
import { VideoPlayer } from './video-player';
import { Users, Clapperboard, MessageSquare, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
    id: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
    text: string;
}

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  const handleNewMessage = useCallback((message: Message) => {
    // Only show notification if the sheet is closed and player is active
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
                  <span>3 watching</span>
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
