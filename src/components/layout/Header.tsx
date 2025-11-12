
'use client';

import Link from 'next/link';
import { Bus, Cog, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';

export default function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      const checkAdminStatus = async () => {
        const adminDocRef = doc(firestore, 'roles_admin', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        setIsAdmin(adminDocSnap.exists());
      };
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [user, firestore]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };


  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Bus className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground font-headline">eTransport</h1>
          </Link>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              {isUserLoading ? (
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
              ) : user ? (
                <>
                  {isAdmin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="ghost" size="icon">
                          <Link href="/admin">
                            <Cog className="h-5 w-5" />
                            <span className="sr-only">Administravimas</span>
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Administravimo panelė</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                   <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleSignOut}>
                            <LogOut className="h-5 w-5" />
                            <span className="sr-only">Atsijungti</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Atsijungti</p>
                      </TooltipContent>
                    </Tooltip>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon">
                      <Link href="/login">
                        <LogIn className="h-5 w-5" />
                        <span className="sr-only">Prisijungti</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Administratoriaus prisijungimas</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
  );
}
