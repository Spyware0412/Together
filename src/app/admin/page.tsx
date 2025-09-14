
"use client";

import { useState, useEffect } from 'react';
import { AdminAuth } from './admin-auth';
import { AdminDashboard } from './admin-dashboard';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check for admin session token in localStorage
    const adminSession = localStorage.getItem('cinesync_admin_session');
    if (adminSession) {
      // In a real app, you'd validate this token with a server
      setIsAdmin(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAdmin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('cinesync_admin_session');
    setIsAdmin(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-6xl">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                    <h1 className="text-3xl font-bold">Admin Panel</h1>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/">Back to Home</Link>
                </Button>
            </header>
            
            {isAdmin ? (
                <AdminDashboard onLogout={handleLogout} />
            ) : (
                <AdminAuth onLoginSuccess={handleLoginSuccess} />
            )}
        </div>
    </main>
  );
}
