import { AuthButtons } from '@/components/auth-buttons';
import { RoomForm } from '@/components/room-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator';
import { Film } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-background to-slate-900">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Film className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold font-headline">Together 💖</h1>
          </div>
          <CardDescription className="text-lg">
            Watch movies together, in sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthButtons />
          <div className="my-6 flex items-center">
            <Separator className="flex-1" />
            <span className="mx-4 text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>
          <RoomForm />
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-center text-xs text-muted-foreground">
        <p>built for manoshi</p>
      </footer>
    </main>
  );
}
