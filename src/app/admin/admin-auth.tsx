
"use client";

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';

// In a real app, these would NOT be hardcoded on the client.
// This is just for demonstration purposes.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN;

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  pin: z.string().min(4, "PIN must be at least 4 characters long."),
});

type FormValues = z.infer<typeof formSchema>;

interface AdminAuthProps {
    onLoginSuccess: () => void;
}

export function AdminAuth({ onLoginSuccess }: AdminAuthProps) {
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { email: "", pin: "" },
    });

    const handleLogin: SubmitHandler<FormValues> = (data) => {
        // This is a basic, insecure check. A real app would use a server endpoint.
        if (data.email === "rishuguptark@gmail.com" && data.pin === "0412") {
            // Create a session token
            const sessionToken = uuidv4();
            localStorage.setItem('cinesync_admin_session', sessionToken);
            
            toast({
                title: "Admin Login Successful",
                description: "Welcome, administrator!",
            });
            onLoginSuccess();
        } else {
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: "Invalid email or PIN.",
            });
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Admin Login</CardTitle>
                <CardDescription>Please enter your credentials to access the admin panel.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="admin@example.com" {...field} className="bg-input"/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="pin"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>PIN</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="••••" {...field} className="bg-input"/>
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
            </CardContent>
        </Card>
    );
}
