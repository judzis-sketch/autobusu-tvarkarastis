'use client';

import AdminForms from '@/components/admin/AdminForms';
import DataMigration from '@/components/admin/DataMigration';
import AdminHeader from '@/components/layout/AdminHeader';
import { Suspense } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import { Separator } from '@/components/ui/separator';

export default function AdminPage() {

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-background">
        <AdminHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Suspense fallback={<p>Kraunama...</p>}>
            <div className="max-w-2xl mx-auto space-y-8">
              <DataMigration />
              <Separator />
              <AdminForms />
            </div>
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
