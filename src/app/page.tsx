import { getRoutes } from '@/lib/actions';
import TimetableClient from '@/components/home/TimetableClient';
import Header from '@/components/layout/Header';
import { Suspense } from 'react';

export default async function Home() {
  const routes = await getRoutes();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Suspense fallback={<p>Kraunami maršrutai...</p>}>
          <TimetableClient initialRoutes={routes} />
        </Suspense>
      </main>
    </div>
  );
}
