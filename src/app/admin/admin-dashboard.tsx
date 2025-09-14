
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
                    <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms ({rooms.length})</TabsTrigger>
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Avatar</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.length > 0 ? users.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <Avatar>
                                                    <AvatarImage src={user.avatar} />
                                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="font-medium">{user.name}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="destructive" size="sm" disabled>Delete</Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center">No users found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Room ID</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     {rooms.length > 0 ? rooms.map(room => (
                                        <TableRow key={room.id}>
                                            <TableCell className="font-mono">{room.id}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="destructive" size="sm" disabled>Delete</Button>
                                            </TableCell>
                                        </TableRow>
                                     )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center">No rooms found.</TableCell>
                                        </TableRow>
                                     )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
