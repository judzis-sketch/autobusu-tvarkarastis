'use client';

import type { Route, TimetableEntry } from '@/lib/types';
import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
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
import { Loader2, Trash2, Route as RouteIcon, ChevronDown, ListOrdered } from 'lucide-react';
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
  deleteDoc,
  limit,
  getDoc
} from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { getRouteDistance } from '@/lib/osrm';

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';

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
  distanceToNext: z.string().optional(),
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
  const [isDeletingStop, setIsDeletingStop] = useState<string | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [lastStopCoords, setLastStopCoords] = useState<[number, number] | null>(null);
  const firestore = useFirestore();

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', distanceToNext: '', coords: { lat: 54.6872, lng: 25.2797 } },
  });
  const { setValue, watch, control, getValues } = timetableForm;
  const watchedCoords = watch('coords');
  const watchedRouteId = watch('routeId');

  const timetableQuery = useMemoFirebase(() => {
    if (!firestore || !watchedRouteId) return null;
    return query(collection(firestore, `routes/${watchedRouteId}/timetable`), orderBy('createdAt', 'asc'));
  }, [firestore, watchedRouteId]);
  const { data: timetableStops, isLoading: isLoadingTimetableStops } = useCollection<TimetableEntry>(timetableQuery);
  const stopPositions = useMemo(() => timetableStops?.map(s => s.coords).filter(Boolean) as [number, number][] || [], [timetableStops]);


  useEffect(() => {
    const fetchLastStop = async () => {
        if (!firestore || !watchedRouteId) {
            setLastStopCoords(null);
            return;
        }

        const lastStopQuery = query(
            collection(firestore, `routes/${watchedRouteId}/timetable`),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const querySnapshot = await getDocs(lastStopQuery);
        if (!querySnapshot.empty) {
            const lastStop = querySnapshot.docs[0].data() as TimetableEntry;
            if (lastStop.coords) {
                setLastStopCoords(lastStop.coords);
            } else {
                setLastStopCoords(null);
            }
        } else {
            setLastStopCoords(null);
        }
    };

    fetchLastStop();
  }, [watchedRouteId, firestore, timetableStops]); // Rerun when timetableStops changes too


  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      number: '',
      name: '',
    },
  });
  
  const handleCalculateDistance = useCallback(async (currentCoords?: { lat?: number, lng?: number }) => {
      const coordsToUse = currentCoords || getValues('coords');

      if (!lastStopCoords) {
          toast({
              title: 'Negalima apskaičiuoti',
              description: 'Tai pirma maršruto stotelė. Nėra atskaitos taško.',
              variant: 'destructive',
          });
          return;
      }
      if (!coordsToUse || !coordsToUse.lat || !coordsToUse.lng) {
          toast({
              title: 'Negalima apskaičiuoti',
              description: 'Prašome pažymėti naujos stotelės vietą žemėlapyje.',
              variant: 'destructive',
          });
          return;
      }

      setIsCalculatingDistance(true);
      try {
          const distanceInMeters = await getRouteDistance(lastStopCoords, [coordsToUse.lat, coordsToUse.lng]);
          if (distanceInMeters !== null) {
              const distanceInKm = distanceInMeters / 1000;
              setValue('distanceToNext', String(distanceInKm.toFixed(3)));
              toast({
                  title: 'Atstumas apskaičiuotas',
                  description: `Apytikslis atstumas iki kitos stotelės: ${distanceInKm.toFixed(3)} km.`,
              });
          } else {
              toast({
                  title: 'Apskaičiavimo klaida',
                  description: 'Nepavyko gauti atstumo iš OSRM tarnybos.',
                  variant: 'destructive',
              });
          }
      } catch (error) {
          console.error("Error calculating distance: ", error);
          toast({
              title: 'Apskaičiavimo klaida',
              description: 'Įvyko netikėta klaida bandant apskaičiuoti atstumą.',
              variant: 'destructive',
          });
      } finally {
          setIsCalculatingDistance(false);
      }
  }, [getValues, lastStopCoords, setValue, toast]);


  const handleCoordsChange = useCallback((lat: number, lng: number) => {
      setValue('coords.lat', lat, { shouldValidate: true });
      setValue('coords.lng', lng, { shouldValidate: true });
      handleCalculateDistance({ lat, lng });
  }, [setValue, handleCalculateDistance]);

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
      const { routeId, stop, times, coords, distanceToNext } = values;

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

      if (distanceToNext) {
        const distanceInKm = parseFloat(distanceToNext);
        if (!isNaN(distanceInKm)) {
            payload.distanceToNext = distanceInKm * 1000; // Convert km to meters for storage
        } else {
            toast({
                title: 'Klaida!',
                description: 'Atstumas turi būti skaičius.',
                variant: 'destructive',
            });
            return;
        }
      }

      const timetableColRef = collection(firestore, `routes/${routeId}/timetable`);

      try {
        await addDoc(timetableColRef, payload);
        toast({
          title: 'Pavyko!',
          description: 'Tvarkaraščio įrašas pridėtas.',
        });
        timetableForm.reset({ routeId: watchedRouteId, stop: '', times: '', distanceToNext: '', coords: { lat: 54.6872, lng: 25.2797 } });
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

  const handleDeleteStop = async (stopId: string) => {
    if (!firestore || !watchedRouteId) {
      toast({ title: 'Klaida!', description: 'Maršrutas nepasirinktas arba duomenų bazė nepasiekiama.', variant: 'destructive'});
      return;
    }
    setIsDeletingStop(stopId);
    try {
      const stopRef = doc(firestore, `routes/${watchedRouteId}/timetable`, stopId);
      await deleteDoc(stopRef);
      toast({ title: 'Pavyko!', description: 'Stotelė sėkmingai ištrinta.' });
    } catch (error) {
       console.error('Error deleting stop: ', error);
      toast({
        title: 'Klaida!',
        description: 'Nepavyko ištrinti stotelės.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingStop(null);
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
              className="space-y-6"
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

              {watchedRouteId && (
                 <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full">
                            <ListOrdered className="mr-2 h-4 w-4" />
                            Esamos maršruto stotelės ({timetableStops?.length ?? 0})
                            <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                       <ScrollArea className="h-60 mt-2 rounded-md border p-2">
                         {isLoadingTimetableStops ? (
                           <div className="flex justify-center items-center h-full">
                             <Loader2 className="h-5 w-5 animate-spin" />
                           </div>
                         ) : timetableStops && timetableStops.length > 0 ? (
                            <ol className="list-decimal list-inside space-y-1">
                              {timetableStops.map((stop, index) => (
                                <li key={stop.id || index} className="text-sm flex items-center justify-between p-1 hover:bg-muted/50 rounded-md">
                                  <div>
                                    <span className="font-semibold">{stop.stop}</span>
                                    <p className="text-xs text-muted-foreground pl-5">{stop.times.join(', ')}</p>
                                  </div>
                                   <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isDeletingStop === stop.id}>
                                          {isDeletingStop === stop.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive/70"/>}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Ar tikrai norite ištrinti?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Šis veiksmas visam laikui ištrins stotelę "{stop.stop}". Šio veiksmo negalima anuliuoti.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteStop(stop.id!)} className="bg-destructive hover:bg-destructive/90">Ištrinti</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </li>
                              ))}
                            </ol>
                         ) : (
                           <p className="text-sm text-muted-foreground text-center pt-4">Šiam maršrutui stotelių dar nepridėta.</p>
                         )}
                       </ScrollArea>
                    </CollapsibleContent>
                 </Collapsible>
              )}


              <div className="space-y-4 pt-4 border-t">
                <FormField
                  control={timetableForm.control}
                  name="stop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Naujos stotelės pavadinimas</FormLabel>
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
                  <div className="space-y-2">
                      <FormField
                      control={timetableForm.control}
                      name="distanceToNext"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Atstumas iki kitos stotelės (kilometrais)</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" placeholder="0.85" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => handleCalculateDistance()} disabled={isCalculatingDistance || !lastStopCoords}>
                          {isCalculatingDistance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
                          Apskaičiuoti atstumą rankiniu būdu
                      </Button>
                  </div>
                  
                <div>
                  <FormLabel>Naujos stotelės koordinatės (pasirinktinai)</FormLabel>
                  <p className="text-sm text-muted-foreground">Paspauskite ant žemėlapio, kad parinktumėte vietą. Atstumas apskaičiuojamas automatiškai.</p>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                      <Controller
                          control={control}
                          name="coords.lat"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Platuma</FormLabel>
                                  <FormControl>
                                      <Input type="number" step="any" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                  </FormControl>
                              </FormItem>
                          )}
                      />
                      <Controller
                          control={control}
                          name="coords.lng"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Ilguma</FormLabel>
                                  <FormControl>
                                      <Input type="number" step="any" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                  </FormControl>
                              </FormItem>
                          )}
                      />
                  </div>
                  <div className="mt-4 h-64 w-full rounded-md overflow-hidden border">
                      <AdminMap
                          coords={watchedCoords}
                          onCoordsChange={handleCoordsChange}
                          stopPositions={stopPositions}
                          lastStopPosition={lastStopCoords}
                      />
                  </div>
                </div>
              </div>


              <Button
                type="submit"
                variant="secondary"
                disabled={isPendingTimetable || !watchedRouteId}
              >
                {isPendingTimetable && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pridėti stotelę ir laikus
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
