"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { User } from 'lucide-react';

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

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { username: "", email: "" },
    });
    
    useEffect(() => {
        const storedUser = localStorage.getItem('cinesync_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const handleLogin: SubmitHandler<FormValues> = (data) => {
        const userId = `user_${uuidv4()}`;
        const newUser: UserProfile = {
            id: userId,
            name: data.username,
            email: data.email,
            avatar: `https://picsum.photos/seed/${userId}/200/200`
        };
        localStorage.setItem('cinesync_user', JSON.stringify(newUser));
        setUser(newUser);
        toast({
          title: "Logged In!",
          description: `Welcome, ${data.username}!`,
        });
        // Optionally redirect or update UI
    };
    
    const handleLogout = () => {
        localStorage.removeItem('cinesync_user');
        setUser(null);
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
                        <Input placeholder="Enter your email" {...field} className="bg-input"/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </Form>
  );
}
