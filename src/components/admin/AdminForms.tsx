'use client';

import type { Route } from '@/lib/types';
import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Trash2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import dynamic from 'next/dynamic';

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
} from '@/components/ui/alert-dialog';

const AdminMap = dynamic(() => import('./AdminMap'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});


const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const timetableSchema = z.object({
  routeId: z.string({ required_error: 'Prašome pasirinkti maršrutą.' }),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(5, 'Laikai yra privalomi (pvz., 08:00)'),
  coords: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
});

export default function AdminForms() {
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const firestore = useFirestore();

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);


  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      number: '',
      name: '',
    },
  });

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', coords: { lat: 54.6872, lng: 25.2797 } },
  });
  const { setValue, watch } = timetableForm;
  const watchedCoords = watch('coords');


  const handleAddRoute = (values: z.infer<typeof routeSchema>) => {
    startTransitionRoute(async () => {
      if (!firestore) {
        toast({ title: 'Klaida!', description: 'Duomenų bazė nepasiekiama.', variant: 'destructive'});
        return;
      }
      try {
        await addDoc(collection(firestore, 'routes'), {
            ...values,
            createdAt: serverTimestamp(),
        });
        toast({
          title: 'Pavyko!',
          description: 'Maršrutas sėkmingai išsaugotas.',
        });
        routeForm.reset();
        // The useCollection hook will automatically update the routes list
      } catch (error) {
        toast({
          title: 'Klaida!',
          description: 'Nepavyko išsaugoti maršruto.',
          variant: 'destructive',
        });
        console.error('Error adding route:', error);
      }
    });
  };

  const handleAddTimetable = (values: z.infer<typeof timetableSchema>) => {
    startTransitionTimetable(async () => {
      const { routeId, stop, times, coords } = values;

      const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);
      if (parsedTimes.length === 0) {
        toast({
          title: 'Klaida!',
          description: 'Nurodykite bent vieną laiką.',
          variant: 'destructive',
        });
        return;
      }

      if (!firestore) {
        toast({
          title: 'Klaida!',
          description: 'Duomenų bazė nepasiekiama.',
          variant: 'destructive',
        });
        return;
      }

      const payload: any = {
        stop,
        times: parsedTimes,
        createdAt: serverTimestamp(),
      };
      
      if (coords && coords.lat && coords.lng) {
        payload.coords = [coords.lat, coords.lng];
      }

      const timetableColRef = collection(firestore, `routes/${routeId}/timetable`);

      try {
        await addDoc(timetableColRef, payload);
        toast({
          title: 'Pavyko!',
          description: 'Tvarkaraščio įrašas pridėtas.',
        });
        timetableForm.reset({ routeId: '', stop: '', times: '', coords: { lat: 54.6872, lng: 25.2797 } });
      } catch (error) {
        toast({
          title: 'Klaida!',
          description: 'Nepavyko pridėti tvarkaraščio įrašo.',
          variant: 'destructive',
        });
        console.error('Error adding timetable entry:', error);
      }
    });
  };

  const handleDeleteRoute = async (routeId: string) => {
    setIsDeleting(routeId);

    if (!firestore) {
      toast({
        title: 'Klaida!',
        description: 'Duomenų bazė nepasiekiama.',
        variant: 'destructive',
      });
      setIsDeleting(null);
      return;
    }
    
    try {
      // First, delete all documents in the 'timetable' subcollection
      const timetableRef = collection(firestore, 'routes', routeId, 'timetable');
      const timetableSnapshot = await getDocs(timetableRef);
      const batch = writeBatch(firestore);
      timetableSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Then, delete the route document itself
      const routeRef = doc(firestore, 'routes', routeId);
      await deleteDoc(routeRef);

      toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai ištrintas.' });
    } catch (error) {
      console.error('Error deleting route: ', error);
      toast({
        title: 'Klaida!',
        description: 'Nepavyko ištrinti maršruto.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoadingRoutes) {
    return (
      <div className="flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Naujas maršrutas</CardTitle>
          <CardDescription>
            Įveskite naujo maršruto informaciją.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...routeForm}>
            <form
              onSubmit={routeForm.handleSubmit(handleAddRoute)}
              className="space-y-4"
            >
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
                {isPendingRoute && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
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
            <form
              onSubmit={timetableForm.handleSubmit(handleAddTimetable)}
              className="space-y-4"
            >
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
                        {routes && routes.map((r) => (
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
                
              <div>
                <FormLabel>Stotelės koordinatės (pasirinktinai)</FormLabel>
                <p className="text-sm text-muted-foreground">Paspauskite ant žemėlapio, kad parinktumėte vietą.</p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <Controller
                        control={timetableForm.control}
                        name="coords.lat"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Platuma</FormLabel>
                                <FormControl>
                                    <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <Controller
                        control={timetableForm.control}
                        name="coords.lng"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ilguma</FormLabel>
                                <FormControl>
                                    <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                 <div className="mt-4 h-64 w-full rounded-md overflow-hidden border">
                    <AdminMap
                        coords={watchedCoords}
                        onCoordsChange={(lat, lng) => {
                            setValue('coords.lat', lat);
                            setValue('coords.lng', lng);
                        }}
                    />
                </div>
              </div>


              <Button
                type="submit"
                variant="secondary"
                disabled={isPendingTimetable}
              >
                {isPendingTimetable && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pridėti laikus
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ištrinti maršrutą</CardTitle>
          <CardDescription>
            Pasirinkite maršrutą, kurį norite ištrinti. Šis veiksmas
            negrįžtamas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {routes && routes.map((route) => (
              <div
                key={route.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div>
                  <span className="font-bold">{route.number}</span> —{' '}
                  <span>{route.name}</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      disabled={isDeleting === route.id}
                    >
                      {isDeleting === route.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Ar tikrai norite ištrinti?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Šis veiksmas visam laikui ištrins maršrutą "
                        {route.number} - {route.name}" ir visus susijusius
                        tvarkaraščio įrašus. Šio veiksmo negalima anuliuoti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteRoute(route.id!)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
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
