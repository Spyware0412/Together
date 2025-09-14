

"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar, ScrollAreaViewport } from '@/components/ui/scroll-area';
import { Send, Settings, User, SmilePlus, Search, Shield, Users, Sun, Moon, LogOut } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { database } from '@/lib/firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useDebounce } from '@/hooks/use-debounce';
import { ProfileSettings } from '@/components/profile-settings';
import type { UserProfile } from '@/components/auth-form';
import { LoadingAnimation } from '@/components/loading-animation';

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

interface Gif {
    id: string;
    url: string;
    preview: string;
    dims: [number, number];
}

interface ChatProps {
    roomId: string;
    messages: Message[];
    activeUsers: UserProfile[];
    theme: string;
    toggleTheme: () => void;
    handleLeaveRoom: () => void;
}

export function Chat({ roomId, messages, activeUsers, theme, toggleTheme, handleLeaveRoom }: ChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const [user, setUser] = useState<UserProfile | null>(null);

    // GIF state
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    const [gifSearchQuery, setGifSearchQuery] = useState('');
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [isSearchingGifs, startGifSearchTransition] = useTransition();
    const debouncedSearchTerm = useDebounce(gifSearchQuery, 300);

    const viewportRef = useRef<HTMLDivElement>(null);
    const messagesRef = ref(database, `rooms/${roomId}/chat`);

    useEffect(() => {
        const storedUser = localStorage.getItem('cinesync_user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
        }
    }, []);

    useEffect(() => {
        const fetchGifs = async () => {
            startGifSearchTransition(async () => {
                const endpoint = debouncedSearchTerm ? `/api/tenor?q=${debouncedSearchTerm}` : '/api/tenor';
                const res = await fetch(endpoint);
                const data = await res.json();
                if (data.gifs) {
                    setGifs(data.gifs);
                }
            });
        };
        if(isGifPickerOpen) {
            fetchGifs();
        }
    }, [isGifPickerOpen, debouncedSearchTerm]);


    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && user) {
            const msg = {
                user: { id: user.id, name: user.name, avatar: user.avatar },
                text: newMessage.trim(),
                type: 'text',
                timestamp: serverTimestamp()
            };
            push(messagesRef, msg);
            setNewMessage('');
        }
    };

    const handleSendGif = (gifUrl: string) => {
        if(user) {
            const msg = {
                user: { id: user.id, name: user.name, avatar: user.avatar },
                gif: gifUrl,
                type: 'gif',
                timestamp: serverTimestamp()
            };
            push(messagesRef, msg);
            setIsGifPickerOpen(false);
            setGifSearchQuery('');
        }
    }

    useEffect(() => {
        if(viewportRef.current) {
            viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <User className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Please Log In</h3>
                <p className="text-sm text-muted-foreground">You need to be logged in to join the chat.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                 <CardTitle>Live Chat</CardTitle>
                 <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title={`${activeUsers.length} users watching`}>
                                <Users className="w-5 h-5"/>
                                <span className="sr-only">Users in Room</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 max-w-[80vw]" align="end">
                        <DropdownMenuLabel>Watching Now ({activeUsers.length})</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {activeUsers.length > 0 ? (
                            activeUsers.map(u => (
                            <DropdownMenuItem key={u.id} className="gap-2">
                                <Avatar className="w-6 h-6">
                                    <AvatarImage src={u.avatar} alt={u.name} />
                                    <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{u.name}</span>
                            </DropdownMenuItem>
                            ))
                        ) : (
                            <DropdownMenuItem disabled>No other users online</DropdownMenuItem>
                        )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                     <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle Theme">
                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                    
                    <ProfileSettings 
                        user={user} 
                        setUser={setUser}
                        trigger={
                            <Button variant="ghost" size="icon" title="Settings">
                                <Settings className="w-5 h-5" />
                            </Button>
                        }
                    >
                        <Button variant="secondary" asChild className="w-full">
                            <Link href="/admin">
                                <Shield className="mr-2 h-4 w-4" /> Admin Panel
                            </Link>
                        </Button>
                    </ProfileSettings>

                     <Button variant="ghost" size="icon" onClick={handleLeaveRoom} title="Leave Room">
                        <LogOut className="w-5 h-5" />
                     </Button>
                </div>
            </CardHeader>
            <ScrollArea className="flex-1">
                <ScrollAreaViewport ref={viewportRef} className="px-4">
                    <div className="space-y-4 pb-4">
                        {messages.map((message) => (
                            <div key={message.id} className="flex items-start gap-3">
                                <Avatar className="w-8 h-8 border">
                                    <AvatarImage src={message.user.avatar} alt={message.user.name} />
                                    <AvatarFallback>{message.user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{message.user.id === user.id ? "You" : message.user.name}</p>
                                    {message.type === 'gif' ? (
                                        <div className="mt-1 bg-secondary rounded-lg overflow-hidden w-fit">
                                            <Image 
                                              src={message.gif!} 
                                              alt="gif" 
                                              width={200}
                                              height={150}
                                              unoptimized
                                              className="max-w-xs h-auto"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-sm bg-secondary p-2 rounded-lg mt-1 w-fit max-w-full">
                                            <p className="break-words">{message.text}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollAreaViewport>
                 <ScrollBar />
            </ScrollArea>
            <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <Popover open={isGifPickerOpen} onOpenChange={setIsGifPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                                <SmilePlus className="w-5 h-5"/>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[90vw] max-w-sm" align="start">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                                    <Input
                                        placeholder="Search GIFs..."
                                        value={gifSearchQuery}
                                        onChange={(e) => setGifSearchQuery(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                                <ScrollArea className="h-60">
                                    <div className="grid grid-cols-2 gap-2 p-1">
                                        {isSearchingGifs ? (
                                            <div className="col-span-2 flex justify-center items-center h-full">
                                                <LoadingAnimation width="60px" height="60px"/>
                                            </div>
                                        ) : (
                                            gifs.map(gif => (
                                                <button key={gif.id} onClick={() => handleSendGif(gif.url)} className="relative aspect-square focus:outline-none focus:ring-2 focus:ring-ring rounded overflow-hidden">
                                                    <Image src={gif.preview} alt="gif" fill objectFit="cover" unoptimized/>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
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
    );
}

    

    