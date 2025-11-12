'use client';

import { useState } from 'react';
import { useAuth, initiateEmailSignIn } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // We don't await this, the onAuthStateChanged listener will handle the redirect
      initiateEmailSignIn(auth, email, password);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Klaida prisijungiant',
        description: error.message || 'Patikrinkite įvestus duomenis.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };
  
  // The redirect logic will be handled by AuthGuard now. 
  // If a user is already logged in and tries to access /login, AuthGuard could redirect them away.

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
