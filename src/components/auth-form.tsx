
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { User, Loader2 } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, query, orderByChild, equalTo, get, set, update } from 'firebase/database';

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long."),
  email: z.string().email("Please enter a valid email address."),
});

type FormValues = z.infer<typeof formSchema>;

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

export function AuthForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { username: "", email: "" },
    });
    
    useEffect(() => {
        const storedUser = localStorage.getItem('cinesync_user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            form.reset({ username: parsedUser.name, email: parsedUser.email });
        }
    }, [form]);

    const handleLogin: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        const usersRef = ref(database, 'users');
        const emailQuery = query(usersRef, orderByChild('email'), equalTo(data.email));

        try {
            const snapshot = await get(emailQuery);
            let userProfile: UserProfile;

            if (snapshot.exists()) {
                // User with this email already exists.
                const usersData = snapshot.val();
                const userId = Object.keys(usersData)[0];
                userProfile = { ...usersData[userId], id: userId };
                
                // If username has changed, update it.
                if (userProfile.name !== data.username) {
                    await update(ref(database, `users/${userId}`), { name: data.username });
                    userProfile.name = data.username;
                    toast({
                        title: "Username Updated!",
                        description: `Logged in as ${userProfile.name}.`,
                    });
                } else {
                     toast({
                        title: "Welcome Back!",
                        description: `Logged in as ${userProfile.name}.`,
                    });
                }
            } else {
                // New user, create a profile.
                const userId = `user_${uuidv4()}`;
                userProfile = {
                    id: userId,
                    name: data.username,
                    email: data.email,
                    avatar: `https://picsum.photos/seed/${userId}/200/200`
                };
                await set(ref(database, `users/${userId}`), userProfile);
                toast({
                  title: "Account Created!",
                  description: `Welcome, ${data.username}!`,
                });
            }

            localStorage.setItem('cinesync_user', JSON.stringify(userProfile));
            setUser(userProfile);
            
        } catch (error) {
            console.error("Authentication error:", error);
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'An error occurred. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('cinesync_user');
        setUser(null);
        form.reset({ username: "", email: "" });
        toast({ title: "Logged Out", description: "You have been successfully logged out."});
    };
    
    if (user) {
        return (
            <div className="space-y-4 text-center">
                <p className="font-semibold">Welcome back, {user.name}!</p>
                <Button onClick={handleLogout} variant="outline" className="w-full">
                    <User className="mr-2" /> Log Out
                </Button>
            </div>
        );
    }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
        <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                        <Input placeholder="Enter your username" {...field} className="bg-input"/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input type="email" placeholder="Enter your email" {...field} className="bg-input"/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Sign In"}
        </Button>
      </form>
    </Form>
  );
}
