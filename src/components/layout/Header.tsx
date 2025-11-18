
'use client';

import Link from 'next/link';
import { Bus, Cog, LogIn, LogOut, User as UserIcon, Accessibility } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAccessibility } from '@/context/AccessibilityContext';

export default function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const { isLargeText, toggleLargeText } = useAccessibility();

  useEffect(() => {
    if (user && firestore) {
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
            <h1 className="text-xl font-bold text-foreground font-headline">Autobusų tvarkaraštis</h1>
          </Link>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isLargeText ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={toggleLargeText}
                  >
                    <Accessibility className="h-5 w-5" />
                    <span className="sr-only">Pritaikymas neįgaliesiems</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Įjungti / išjungti didesnio šrifto režimą</p>
                </TooltipContent>
              </Tooltip>

              {isUserLoading ? (
                <Skeleton className="h-9 w-24 rounded-md" />
              ) : user ? (
                <>
                  {isAdmin && (
                     <Button asChild variant="outline">
                        <Link href="/admin">
                            <Cog />
                            <span>Administravimas</span>
                        </Link>
                    </Button>
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
                <Button asChild variant="ghost">
                    <Link href="/login">
                        <UserIcon />
                        <span>Admin prisijungimas</span>
                    </Link>
                </Button>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
  );
}
