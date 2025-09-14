
"use client";

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';
import type { UserProfile } from './auth-form';

interface ProfileSettingsProps {
    user: UserProfile;
    setUser: (user: UserProfile) => void;
    trigger: React.ReactNode;
    children?: React.ReactNode;
}

export function ProfileSettings({ user, setUser, trigger, children }: ProfileSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newUsername, setNewUsername] = useState(user.name);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            setIsSaving(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const newAvatar = reader.result as string;
                
                try {
                    const updates: { [key: string]: any } = {};
                    // 1. Update global user avatar
                    updates[`/users/${user.id}/avatar`] = newAvatar;
                    
                    // 2. Update avatar in all rooms the user is in
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

                    // 3. Update local state and storage
                    const updatedUser = { ...user, avatar: newAvatar };
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
            setIsOpen(false);
            return;
        };

        setIsSaving(true);

        try {
            const updates: { [key: string]: any } = {};
            // 1. Update global user name
            updates[`/users/${user.id}/name`] = newUsername.trim();

            // 2. Update name in all rooms the user is in
            const roomsSnapshot = await get(ref(database, 'rooms'));
            if (roomsSnapshot.exists()) {
                const allRooms = roomsSnapshot.val();
                Object.keys(allRooms).forEach(roomId => {
                    if (allRooms[roomId].users?.[user.id]) {
                        updates[`/rooms/${roomId}/users/${user.id}/name`] = newUsername.trim();
                    }
                });
            }

            await update(ref(database), updates);

            // 3. Update local state and storage
            const updatedUser = { ...user, name: newUsername.trim() };
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
            setIsOpen(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
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
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isSaving} variant="outline">Change Picture</Button>
                    
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

                    <Button 
                        onClick={handleProfileUpdate} 
                        disabled={isSaving || !newUsername.trim() || newUsername.trim() === user.name} 
                        className="w-full"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                        Save Changes
                    </Button>

                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
