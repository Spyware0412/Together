
"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar, ScrollAreaViewport } from '@/components/ui/scroll-area';
import { Send, Settings, User, SmilePlus, Search, Loader2, Shield, Save } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { database } from '@/lib/firebase';
import { ref, push, serverTimestamp, update, get } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

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
}

export function Chat({ roomId, messages }: ChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // Edit Profile State
    const [newUsername, setNewUsername] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // GIF state
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    const [gifSearchQuery, setGifSearchQuery] = useState('');
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [isSearchingGifs, startGifSearchTransition] = useTransition();
    const debouncedSearchTerm = useDebounce(gifSearchQuery, 300);

    const { toast } = useToast();
    const viewportRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesRef = ref(database, `rooms/${roomId}/chat`);

    useEffect(() => {
        const storedUser = localStorage.getItem('cinesync_user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setNewUsername(parsedUser.name);
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
    
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            setIsSaving(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const newAvatar = reader.result as string;
                const updatedUser = { ...user, avatar: newAvatar };
                
                try {
                    const updates: { [key: string]: any } = {};
                    updates[`/users/${user.id}/avatar`] = newAvatar;
                    
                    const roomsSnapshot = await get(ref(database, 'rooms'));
                    if (roomsSnapshot.exists()) {
                        const allRooms = roomsSnapshot.val();
                        Object.keys(allRooms).forEach(roomId => {
                            if (allRooms[roomId].users?.[user.id]) {
                                updates[`/rooms/${roomId}/users/${user.id}/avatar`] = newAvatar;
                            }
                        });
                    }

                    await update(ref(database), updates);

                    setUser(updatedUser);
                    localStorage.setItem('cinesync_user', JSON.stringify(updatedUser));
                    
                    toast({
                        title: "Avatar Updated",
                        description: "Your new profile picture has been saved.",
                    });

                } catch (error) {
                    console.error("Failed to update avatar:", error);
                    toast({
                        variant: 'destructive',
                        title: "Update Failed",
                        description: "Could not save your new avatar. Please try again.",
                    });
                } finally {
                    setIsSaving(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProfileUpdate = async () => {
        if (!user || !newUsername.trim() || newUsername.trim() === user.name) {
            setIsSettingsOpen(false);
            return;
        };

        setIsSaving(true);
        const updatedUser = { ...user, name: newUsername.trim() };

        try {
            const updates: { [key: string]: any } = {};
            updates[`/users/${user.id}/name`] = updatedUser.name;

            const roomsSnapshot = await get(ref(database, 'rooms'));
            if (roomsSnapshot.exists()) {
                const allRooms = roomsSnapshot.val();
                Object.keys(allRooms).forEach(roomId => {
                    if (allRooms[roomId].users?.[user.id]) {
                        updates[`/rooms/${roomId}/users/${user.id}/name`] = updatedUser.name;
                    }
                });
            }

            await update(ref(database), updates);

            setUser(updatedUser);
            localStorage.setItem('cinesync_user', JSON.stringify(updatedUser));

            toast({
                title: "Profile Updated",
                description: "Your username has been changed.",
            });

        } catch (error) {
            console.error("Failed to update profile:", error);
            toast({
                variant: 'destructive',
                title: "Update Failed",
                description: "Could not save your changes. Please try again.",
            });
        } finally {
            setIsSaving(false);
            setIsSettingsOpen(false);
        }
    };

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
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Live Chat</CardTitle>
                 <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Settings className="w-5 h-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Profile Settings</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                             <Avatar className="w-24 h-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                            <Button onClick={() => fileInputRef.current?.click()} disabled={isSaving}>Change Picture</Button>
                            
                            <div className="w-full space-y-2 text-left">
                               <Label htmlFor="username-input">Username</Label>
                               <Input 
                                 id="username-input"
                                 value={newUsername}
                                 onChange={(e) => setNewUsername(e.target.value)}
                                 className="bg-input"
                                 disabled={isSaving}
                               />
                               <p className="text-sm text-muted-foreground mt-2">
                                 Your email: {user.email}
                               </p>
                            </div>

                            <Button onClick={handleProfileUpdate} disabled={isSaving || newUsername.trim() === user.name} className="w-full">
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                                Save Changes
                            </Button>

                            <Button variant="secondary" asChild className="w-full">
                                <Link href="/admin">
                                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                                </Link>
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
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
                        <PopoverContent className="w-80" align="start">
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
                                                <Loader2 className="w-8 h-8 animate-spin"/>
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

    