import { getRoutes } from '@/lib/actions';
import AdminForms from '@/components/admin/AdminForms';
import AdminHeader from '@/components/layout/AdminHeader';
import { Suspense } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const routes = await getRoutes();

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-background">
        <AdminHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Suspense fallback={<p>Kraunama...</p>}>
            <AdminForms routes={routes} />
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
