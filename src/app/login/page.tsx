'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser, initiateEmailSignIn } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true); // Start true to show loader initially
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    // This listener handles both initial auth state check and subsequent changes
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // User is logged in, redirect to admin page
        toast({
          title: 'Sėkmingai prisijungėte!',
          description: 'Valdymo skydelis kraunamas...',
        });
        router.replace('/admin');
        // Redirection is handled, but we keep the loader until the new page loads
      } else {
        // User is not logged in, stop showing the initial loader
        setIsRedirecting(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, router, toast]);


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await initiateEmailSignIn(auth, email, password);
      // onAuthStateChanged listener will handle the redirect on success.
    } catch (error: any) {
      console.error(error);
      let description = 'Patikrinkite įvestus duomenis.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = 'Neteisingas el. paštas arba slaptažodis.';
      }
      toast({
        title: 'Klaida prisijungiant',
        description: description,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  // Show a loader while we're checking the initial auth state
  if (isRedirecting) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle>Administratoriaus prisijungimas</CardTitle>
          <CardDescription>Prisijunkite, kad galėtumėte valdyti maršrutus.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">El. paštas</Label>
              <Input
                id="email"
                type="email"
                placeholder="adminas@etransport.lt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Slaptažodis</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Prisijungti
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
