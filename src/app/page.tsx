import TimetableClient from '@/components/home/TimetableClient';
import Header from '@/components/layout/Header';
import { Suspense } from 'react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Suspense fallback={<p>Kraunami maršrutai...</p>}>
          <TimetableClient />
        </Suspense>
      </main>
    </div>
  );
}
