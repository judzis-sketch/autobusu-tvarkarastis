'use client';

import AdminForms from '@/components/admin/AdminForms';
import AdminHeader from '@/components/layout/AdminHeader';
import { Suspense } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function AdminPage() {

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-background">
        <AdminHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Suspense fallback={<p>Kraunama...</p>}>
            <div className="max-w-2xl mx-auto">
              <AdminForms />
            </div>
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
