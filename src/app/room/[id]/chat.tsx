"use client";

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { database } from '@/lib/firebase';
import { ref, onValue, push, serverTimestamp, off } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';

interface Message {
    id: string;
    user: {
        name: string;
        avatar: string;
    };
    text: string;
    timestamp: number;
}

interface ChatProps {
    roomId: string;
}

export function Chat({ roomId }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const viewportRef = useRef<HTMLDivElement>(null);
    const [userId] = useState(() => `user_${uuidv4()}`);
    const [userName] = useState(() => `User${Math.floor(Math.random() * 1000)}`);
    const messagesRef = ref(database, `rooms/${roomId}/chat`);

    useEffect(() => {
        const onMessages = (snapshot: any) => {
            const data = snapshot.val();
            if (data) {
                const messageList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => a.timestamp - b.timestamp);
                setMessages(messageList);
            }
        };

        onValue(messagesRef, onMessages);

        return () => {
            off(messagesRef, 'value', onMessages);
        };
    }, [roomId]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            const msg = {
                user: { name: userName, avatar: `https://picsum.photos/seed/${userId}/40/40` },
                text: newMessage.trim(),
                timestamp: serverTimestamp()
            };
            push(messagesRef, msg);
            setNewMessage('');
        }
    };
    
    useEffect(() => {
        if(viewportRef.current) {
            viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <div className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Live Chat</CardTitle>
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
                                <p className="font-semibold text-sm">{message.user.name === userName ? "You" : message.user.name}</p>
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
