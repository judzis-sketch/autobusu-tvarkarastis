'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    } else if (user) {
      const checkAdminStatus = async () => {
        setIsCheckingAdmin(true);
        const adminDocRef = doc(firestore, 'roles_admin', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          setIsAdmin(true);
        } else {
          // If not an admin, deny access. You might want to redirect
          // to a specific 'access-denied' page or just back to home.
          console.warn('Access denied. User is not an admin.');
          router.replace('/'); 
        }
        setIsCheckingAdmin(false);
      };

      checkAdminStatus();
    }
  }, [user, isUserLoading, router, firestore]);

  if (isUserLoading || isCheckingAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user && isAdmin) {
    return <>{children}</>;
  }

  // Fallback, although the useEffect should have already redirected.
  return null;
}
