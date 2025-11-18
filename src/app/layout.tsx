

'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AccessibilityProvider, useAccessibility } from '@/context/AccessibilityContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// This is a client component, but we can't define metadata in it directly.
// So we define it here. It's static, so it's fine.
// export const metadata: Metadata = {
//   title: 'Autobusų tvarkaraštis',
//   description: 'Autobusų tvarkaraštis',
// };
// Since we need to use a hook, we must make RootLayout a client component.
// Metadata should be handled differently if it needs to be dynamic.
// For now, we can set title in useEffect.

function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLargeText } = useAccessibility();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    document.title = 'Autobusų tvarkaraštis';
  }, []);

  if (!isMounted) {
    return (
       <html lang="lt">
        <body className="font-body antialiased">
          {/* You might want to show a loading spinner here */}
        </body>
      </html>
    );
  }

  return (
    <html lang="lt" className={cn({ 'large-text': isLargeText })} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AccessibilityProvider>
        <AppLayout>{children}</AppLayout>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}
