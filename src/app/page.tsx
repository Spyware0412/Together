"use client";

import { AuthForm } from '@/components/auth-form';
import { RoomForm } from '@/components/room-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator';
import { Film } from 'lucide-react';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

// Define the type for the VANTA object for TypeScript
declare global {
  interface Window {
    VANTA: any;
  }
}

export default function Home() {
  const vantaRef = useRef(null);
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  useEffect(() => {
    // This effect will run when the component mounts.
    // It initializes the Vanta.js effect after the scripts have loaded.
    if (vantaRef.current && window.VANTA && !vantaEffect) {
        setVantaEffect(window.VANTA.CLOUDS({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          // You can customize colors here if you want
          // skyColor: 0x1e293b, 
          // cloudColor: 0x334155,
        }));
    }

    // This is a cleanup function that will be called when the component unmounts.
    // It ensures the Vanta.js animation is destroyed to prevent memory leaks.
    return () => {
      if (vantaEffect) {
        vantaEffect.destroy();
      }
    };
  }, [vantaEffect]);


  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js" strategy="afterInteractive" />
      <Script 
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js" 
        strategy="afterInteractive"
        onLoad={() => {
          // This will trigger the useEffect to run again once the script is loaded
          if (vantaRef.current && !vantaEffect) {
            setVantaEffect(window.VANTA.CLOUDS({
              el: vantaRef.current,
              mouseControls: true,
              touchControls: true,
              gyroControls: false,
              minHeight: 200.00,
              minWidth: 200.00,
            }));
          }
        }}
      />
      <main ref={vantaRef} className="flex min-h-screen flex-col items-center justify-center p-8 bg-background relative overflow-hidden">
        <Card className="w-full max-w-md shadow-2xl z-10">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-3 mb-4">
              <Film className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold font-headline">Together 💖</h1>
            </div>
            <CardDescription className="text-lg">
              Built for Manoshi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthForm />
            <div className="my-6 flex items-center">
              <Separator className="flex-1" />
              <span className="mx-4 text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>
            <RoomForm />
          </CardContent>
        </Card>
        <footer className="absolute bottom-4 text-center text-xs text-muted-foreground z-10">
          <p>Built for Manoshi</p>
        </footer>
      </main>
    </>
  );
}
