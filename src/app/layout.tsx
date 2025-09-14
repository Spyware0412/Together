import type {Metadata} from 'next';
import './globals.css';
import Script from 'next/script';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Together 💖',
  description: 'Built for Manoshi',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
          {children}
          <Toaster />
          <Script src="https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/tsparticles.slim.bundle.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
