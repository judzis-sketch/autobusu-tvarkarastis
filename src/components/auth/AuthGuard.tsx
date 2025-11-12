'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore(); // This might not be ready immediately on first render
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    // Wait until both user loading is complete and firestore instance is available
    if (isUserLoading || !firestore) {
      return; 
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    const checkAdminStatus = async () => {
      setIsCheckingAdmin(true);
      try {
        const adminDocRef = doc(firestore, 'roles_admin', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          setIsAdmin(true);
        } else {
          console.warn('Access denied. User is not an admin.');
          router.replace('/'); 
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        router.replace('/'); // Redirect on error as well
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, isUserLoading, firestore, router]);

  // Combined loading state
  const isLoading = isUserLoading || isCheckingAdmin || !firestore;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user && isAdmin) {
    return <>{children}</>;
  }

  // Fallback rendering null while redirects are happening
  return null;
}
