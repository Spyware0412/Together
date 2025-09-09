"use client";

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';

interface Message {
    id: number;
    user: {
        name: string;
        avatar: string;
    };
    text: string;
}

const initialMessages: Message[] = [
    { id: 1, user: { name: 'Alex', avatar: 'https://picsum.photos/seed/alex/40/40' }, text: 'Hey everyone, ready for the movie?' },
    { id: 2, user: { name: 'Beth', avatar: 'https://picsum.photos/seed/beth/40/40' }, text: 'Yeah! So excited for this one.' },
    { id: 3, user: { name: 'You', avatar: 'https://picsum.photos/seed/you/40/40' }, text: 'I just picked the file. Let me know when you are all ready.' },
];

export function Chat() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            const msg: Message = {
                id: messages.length + 1,
                user: { name: 'You', avatar: 'https://picsum.photos/seed/you/40/40' },
                text: newMessage.trim(),
            };
            setMessages([...messages, msg]);
            setNewMessage('');
        }
    };
    
    useEffect(() => {
        if(scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);


    return (
        <div className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Live Chat</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-4" viewportRef={scrollAreaRef}>
                <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                        <div key={message.id} className="flex items-start gap-3">
                            <Avatar className="w-8 h-8 border">
                                <AvatarImage src={message.user.avatar} alt={message.user.name} />
                                <AvatarFallback>{message.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{message.user.name}</p>
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
