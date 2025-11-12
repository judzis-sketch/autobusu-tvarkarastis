'use client';

import AdminForms from '@/components/admin/AdminForms';
import AdminHeader from '@/components/layout/AdminHeader';
import { Suspense, useState, useCallback, useMemo } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AdminMap = dynamic(() => import('@/components/admin/AdminMap').then(m => m.AdminMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


export default function AdminPage() {
  const [coords, setCoords] = useState<[number, number] | null>(null);

  const handleCoordsChange = useCallback((newCoords: [number, number]) => {
      setCoords(newCoords);
  }, []);

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-background">
        <AdminHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Suspense fallback={<p>Kraunama...</p>}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AdminForms coords={coords} onCoordsChange={handleCoordsChange} />
              <div className="h-[400px] lg:h-auto w-full rounded-md overflow-hidden border">
                <AdminMap onCoordsChange={handleCoordsChange} coords={coords} />
              </div>
            </div>
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
