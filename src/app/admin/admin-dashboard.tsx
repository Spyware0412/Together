
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

interface Room {
    id: string;
    // Add other room properties as needed
}

interface AdminDashboardProps {
    onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    useEffect(() => {
        // In a real app, you might want more robust data fetching and pagination
        const usersRef = ref(database, 'users');
        const roomsRef = ref(database, 'rooms');

        const onUsers = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            const userList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            setUsers(userList);
        });

        const onRooms = onValue(roomsRef, (snapshot) => {
            const data = snapshot.val();
            const roomList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            setRooms(roomList);
        });

        return () => {
            // Detach listeners
        };
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Dashboard</h2>
                <Button variant="outline" onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
            
            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Users</CardTitle>
                            <CardDescription>
                                A list of all registered users in the application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>User management feature coming soon.</p>
                            {/* Placeholder for user list */}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="rooms">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Rooms</CardTitle>
                            <CardDescription>
                                A list of all active and past rooms.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <p>Room management feature coming soon.</p>
                             {/* Placeholder for room list */}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
