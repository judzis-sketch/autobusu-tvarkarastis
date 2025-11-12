'use client';

import type { Route, TimetableEntry } from '@/lib/types';
import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getRoutes, addRoute } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, getDocs, writeBatch } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const timetableSchema = z.object({
  routeId: z.string({ required_error: 'Prašome pasirinkti maršrutą.' }),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(5, 'Laikai yra privalomi (pvz., 08:00)'),
});


export default function AdminForms() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const firestore = useFirestore();

  const fetchRoutes = async () => {
    setIsLoadingRoutes(true);
    try {
      const fetchedRoutes = await getRoutes();
      setRoutes(fetchedRoutes.sort((a,b) => a.number.localeCompare(b.number, 'lt', { numeric: true })));
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      toast({
        title: 'Klaida gaunant maršrutus',
        description: 'Nepavyko gauti maršrutų sąrašo. Patikrinkite konsolę.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      number: '',
      name: '',
    },
  });

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '' },
  });


 const handleAddRoute = (values: z.infer<typeof routeSchema>) => {
    startTransitionRoute(async () => {
      try {
        await addRoute(values);
        toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai išsaugotas. Atnaujinamas sąrašas...' });
        routeForm.reset();
        await fetchRoutes(); // Fetch fresh data to guarantee consistency
      } catch (error) {
          toast({ title: 'Klaida!', description: 'Nepavyko išsaugoti maršruto.', variant: 'destructive'});
          console.error("Error adding route:", error);
      }
    });
  };
  
  const handleAddTimetable = (values: z.infer<typeof timetableSchema>) => {
    startTransitionTimetable(async () => {
        const { routeId, stop, times } = values;

        const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);
        if(parsedTimes.length === 0) {
            toast({ title: 'Klaida!', description: 'Nurodykite bent vieną laiką.', variant: 'destructive'});
            return;
        }
        
        const payload: any = { stop, times: parsedTimes, createdAt: serverTimestamp() };
        
        const timetableColRef = collection(firestore, `routes/${routeId}/timetable`);
        
        try {
            await addDoc(timetableColRef, payload);
            toast({ title: 'Pavyko!', description: 'Tvarkaraščio įrašas pridėtas.' });
            timetableForm.reset();
        } catch (error) {
            toast({ title: 'Klaida!', description: 'Nepavyko pridėti tvarkaraščio įrašo.', variant: 'destructive' });
            console.error("Error adding timetable entry:", error);
        }
    });
  };

  const handleDeleteRoute = (routeId: string) => {
    setIsDeleting(routeId);
    const routeRef = doc(firestore, 'routes', routeId);
    
    const preDelete = async () => {
        const timetableRef = collection(firestore, 'routes', routeId, 'timetable');
        const batch = writeBatch(firestore);
        const timetableSnapshot = await getDocs(timetableRef);
        timetableSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    };
    
    deleteDocumentNonBlocking(routeRef, preDelete).then(() => {
      setRoutes(prev => prev.filter(r => r.id !== routeId));
      toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai ištrintas.' });
      setIsDeleting(null);
    }).catch(error => {
      console.error("Error deleting route: ", error);
      toast({ title: 'Klaida!', description: 'Nepavyko ištrinti maršruto.', variant: 'destructive'});
      setIsDeleting(null);
    })
  }
  
  if (isLoadingRoutes) {
    return <div className="flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Naujas maršrutas</CardTitle>
          <CardDescription>Įveskite naujo maršruto informaciją.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit(handleAddRoute)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={routeForm.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numeris</FormLabel>
                      <FormControl>
                        <Input placeholder="10G" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pavadinimas</FormLabel>
                      <FormControl>
                        <Input placeholder="Stotis - Centras" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isPendingRoute}>
                {isPendingRoute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pridėti maršrutą
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pridėti stotelės laikus</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...timetableForm}>
              <form onSubmit={timetableForm.handleSubmit(handleAddTimetable)} className="space-y-4">
                <FormField
                  control={timetableForm.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maršrutas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="-- Pasirinkti maršrutą --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {routes.map((r) => (
                            <SelectItem key={r.id} value={r.id!}>
                              {r.number} — {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={timetableForm.control}
                  name="stop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stotelės pavadinimas</FormLabel>
                      <FormControl>
                        <Input placeholder="Vinco Kudirkos aikštė" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={timetableForm.control}
                  name="times"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laikai (atskirti kableliu)</FormLabel>
                      <FormControl>
                        <Input placeholder="08:00, 08:30, 09:15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="secondary" disabled={isPendingTimetable}>
                  {isPendingTimetable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pridėti laikus
                </Button>
              </form>
            </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Ištrinti maršrutą</CardTitle>
            <CardDescription>Pasirinkite maršrutą, kurį norite ištrinti. Šis veiksmas negrįžtamas.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                {routes.map((route) => (
                    <div key={route.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div>
                            <span className="font-bold">{route.number}</span> — <span>{route.name}</span>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" disabled={isDeleting === route.id}>
                                  {isDeleting === route.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Ar tikrai norite ištrinti?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Šis veiksmas visam laikui ištrins maršrutą "{route.number} - {route.name}" ir visus susijusius tvarkaraščio įrašus. Šio veiksmo negalima anuliuoti.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteRoute(route.id!)} className="bg-destructive hover:bg-destructive/90">
                                        Taip, ištrinti
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
