
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, remove, get } from "firebase/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

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
    const { toast } = useToast();

    useEffect(() => {
        const usersRef = ref(database, 'users');
        const roomsRef = ref(database, 'rooms');

        const handleData = (usersSnapshot: any, roomsSnapshot: any) => {
            const allUsersMap = new Map<string, User>();

            // 1. Get users from global /users list
            const globalUsersData = usersSnapshot.val();
            if (globalUsersData) {
                Object.keys(globalUsersData).forEach(key => {
                    if (!allUsersMap.has(key)) {
                        allUsersMap.set(key, { ...globalUsersData[key], id: key });
                    }
                });
            }

            // 2. Get users from within each room and aggregate them
            const roomsData = roomsSnapshot.val();
            if (roomsData) {
                const roomList = Object.keys(roomsData).map(key => ({ id: key, ...roomsData[key] }));
                setRooms(roomList);

                Object.values(roomsData).forEach((room: any) => {
                    if (room.users) {
                        Object.keys(room.users).forEach(userId => {
                            if (!allUsersMap.has(userId)) {
                                const user = room.users[userId];
                                // Ensure user object is valid before adding
                                if (user && user.name && user.email) {
                                     allUsersMap.set(userId, { ...user, id: userId });
                                }
                            }
                        });
                    }
                });
            } else {
                setRooms([]);
            }

            setUsers(Array.from(allUsersMap.values()));
        };

        let usersSnapshot: any, roomsSnapshot: any;
        const onData = () => {
             if (usersSnapshot !== undefined && roomsSnapshot !== undefined) {
                handleData(usersSnapshot, roomsSnapshot);
            }
        }
        
        const usersListener = onValue(usersRef, (snapshot) => {
            usersSnapshot = snapshot;
            onData();
        }, { onlyOnce: false });

        const roomsListener = onValue(roomsRef, (snapshot) => {
            roomsSnapshot = snapshot;
            onData();
        }, { onlyOnce: false });


        return () => {
            usersListener();
            roomsListener();
        };
    }, []);

    const handleDeleteRoom = async (roomId: string) => {
        try {
            await remove(ref(database, `rooms/${roomId}`));
            toast({
                title: "Room Deleted",
                description: `Room ${roomId} has been successfully deleted.`,
            });
        } catch (error) {
            console.error("Error deleting room:", error);
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: "Could not delete the room. Please try again.",
            });
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            // First, remove the user from any rooms they are in
            const roomsSnapshot = await get(ref(database, 'rooms'));
            const allRoomsData = roomsSnapshot.val();

            if (allRoomsData) {
                const deletionPromises: Promise<void>[] = [];
                Object.keys(allRoomsData).forEach(roomId => {
                    const userInRoomRef = ref(database, `rooms/${roomId}/users/${userId}`);
                    deletionPromises.push(remove(userInRoomRef));
                });
                await Promise.all(deletionPromises);
            }
            
            // Finally, remove the user from the global users list
            await remove(ref(database, `users/${userId}`));
            
            toast({
                title: "User Deleted",
                description: `User has been permanently deleted from all records.`,
            });
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: "Could not delete the user. Please try again.",
            });
        }
    };

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
                                        <TableHead>User ID</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.length > 0 ? users.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <Avatar>
                                                    <AvatarImage src={user.avatar} />
                                                    <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="font-medium">{user.name}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell className="font-mono text-xs">{user.id}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm">Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the user and all their associated data from all rooms. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center">No users found.</TableCell>
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
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                         <Button variant="destructive" size="sm">Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the room and all its data. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteRoom(room.id)}>
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
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

    