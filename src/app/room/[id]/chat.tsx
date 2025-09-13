"use client";

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Send, Settings, User } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { database } from '@/lib/firebase';
import { ref, onValue, push, serverTimestamp, off } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
}

interface ChatProps {
    roomId: string;
    onNewMessage: (message: Message) => void;
}

export function Chat({ roomId, onNewMessage }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const viewportRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesRef = ref(database, `rooms/${roomId}/chat`);

    useEffect(() => {
        const storedUser = localStorage.getItem('cinesync_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        const onMessages = (snapshot: any) => {
            const data = snapshot.val();
            if (data) {
                const messageList: Message[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => a.timestamp - b.timestamp);
                setMessages(messageList);

                if (messageList.length > 0) {
                    const lastMessage = messageList[messageList.length - 1];
                    // Notify parent if the message is not from the current user
                    if (lastMessage.user.id !== user?.id) {
                        onNewMessage(lastMessage);
                    }
                }
            }
        };

        onValue(messagesRef, onMessages);

        return () => {
            off(messagesRef, 'value', onMessages);
        };
    }, [roomId, user, onNewMessage]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && user) {
            const msg = {
                user: { id: user.id, name: user.name, avatar: user.avatar },
                text: newMessage.trim(),
                timestamp: serverTimestamp()
            };
            push(messagesRef, msg);
            setNewMessage('');
        }
    };
    
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newAvatar = reader.result as string;
                const updatedUser = { ...user, avatar: newAvatar };
                setUser(updatedUser);
                localStorage.setItem('cinesync_user', JSON.stringify(updatedUser));
                setIsSettingsOpen(false); // Close dialog on change
            };
            reader.readAsDataURL(file);
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
                            <Button onClick={() => fileInputRef.current?.click()}>Change Picture</Button>
                            <div className="w-full space-y-2 text-center">
                               <p className="font-semibold text-lg">{user.name}</p>
                               <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <ScrollArea className="flex-1 px-4" viewportRef={viewportRef}>
                <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                        <div key={message.id} className="flex items-start gap-3">
                            <Avatar className="w-8 h-8 border">
                                <AvatarImage src={message.user.avatar} alt={message.user.name} />
                                <AvatarFallback>{message.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{message.user.id === user.id ? "You" : message.user.name}</p>
                                <div className="text-sm bg-secondary p-2 rounded-lg mt-1 w-fit max-w-full">
                                    <p className="break-words">{message.text}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                 <ScrollBar />
            </ScrollArea>
            <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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
