"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

export function RoomForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    // In a real app, you'd probably do an API call to ensure the room ID is unique.
    const newRoomId = uuidv4().substring(0, 8);
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a room code.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleJoinRoom} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="room-code">Join a Room</Label>
          <Input
            id="room-code"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="bg-input"
          />
        </div>
        <Button type="submit" variant="secondary" className="w-full">
          Join Room
        </Button>
      </form>
      <Button onClick={handleCreateRoom} className="w-full" variant="accent">
        Create a New Room
      </Button>
    </div>
  );
}
