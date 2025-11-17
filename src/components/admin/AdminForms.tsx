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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Trash2, Route as RouteIcon, ChevronDown, ListOrdered, Pencil } from 'lucide-react';
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
  getDoc,
  updateDoc
} from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { getRoute } from '@/lib/osrm';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import type { LatLngTuple } from 'leaflet';

const AdminMap = dynamic(() => import('./AdminMap'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

const daysOfWeek = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"] as const;

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
  days: z.array(z.string()).refine(value => value.length > 0, {
    message: "Pasirinkite bent vieną savaitės dieną."
  })
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

const editStopSchema = z.object({
  stop: z.string().min(1, "Stotelės pavadinimas yra privalomas"),
  times: z.string().min(5, "Laikai yra privalomi"),
});

export default function AdminForms() {
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingStop, setIsDeletingStop] = useState<string | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [lastStopCoords, setLastStopCoords] = useState<[number, number] | null>(null);
  const [editingStop, setEditingStop] = useState<TimetableEntry | null>(null);
  const [isUpdatingStop, setIsUpdatingStop] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [isUpdatingRoute, setIsUpdatingRoute] = useState(false);
  const firestore = useFirestore();
  const [alternativeRoutes, setAlternativeRoutes] = useState<{ distance: number, geometry: LatLngTuple[] }[]>([]);

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', distanceToNext: '', coords: { lat: 55.7333, lng: 26.2500 } },
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
  
  const editStopForm = useForm<z.infer<typeof editStopSchema>>({
      resolver: zodResolver(editStopSchema),
  });

  const editRouteForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
  });

  useEffect(() => {
      if (editingStop) {
          editStopForm.reset({
              stop: editingStop.stop,
              times: editingStop.times.join(', '),
          });
      }
  }, [editingStop, editStopForm]);

  useEffect(() => {
    if (editingRoute) {
      editRouteForm.reset({
        number: editingRoute.number,
        name: editingRoute.name,
        days: editingRoute.days || [],
      });
    }
  }, [editingRoute, editRouteForm]);
  
  // Clear alternatives when route changes
  useEffect(() => {
    setAlternativeRoutes([]);
    setValue('distanceToNext', '');
  }, [watchedRouteId, setValue])

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
  }, [watchedRouteId, firestore]);


  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      number: '',
      name: '',
      days: [],
    },
  });
  
  const handleCalculateDistance = useCallback(async (currentCoords?: { lat?: number, lng?: number }, manual = false) => {
      const coordsToUse = currentCoords || getValues('coords');

      if (!lastStopCoords) {
          if (manual) {
            toast({
                title: 'Negalima apskaičiuoti',
                description: 'Tai pirma maršruto stotelė. Nėra atskaitos taško.',
                variant: 'destructive',
            });
          }
          return;
      }
      if (!coordsToUse || !coordsToUse.lat || !coordsToUse.lng) {
          if (manual) {
            toast({
                title: 'Negalima apskaičiuoti',
                description: 'Prašome pažymėti naujos stotelės vietą žemėlapyje.',
                variant: 'destructive',
            });
          }
          return;
      }

      setIsCalculatingDistance(true);
      setAlternativeRoutes([]);
      try {
          const routes = await getRoute(lastStopCoords, [coordsToUse.lat, coordsToUse.lng], true);
          if (routes && routes.length > 0) {
              setAlternativeRoutes(routes);
              // Set the first route as default
              const firstRoute = routes[0];
              const distanceInKm = firstRoute.distance / 1000;
              setValue('distanceToNext', String(distanceInKm.toFixed(3)));
              toast({
                  title: 'Maršrutai rasti',
                  description: `Pasirinkite vieną iš ${routes.length} maršruto variantų paspausdami ant jo žemėlapyje.`,
              });
          } else {
              toast({
                  title: 'Maršrutų apskaičiavimo klaida',
                  description: 'Nepavyko gauti maršruto iš OSRM tarnybos.',
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

    const handleRouteSelection = (routeIndex: number) => {
    const selectedRoute = alternativeRoutes[routeIndex];
    if (selectedRoute) {
      const distanceInKm = selectedRoute.distance / 1000;
      setValue('distanceToNext', String(distanceInKm.toFixed(3)));
      toast({
        title: 'Maršrutas pasirinktas',
        description: `Pasirinkto maršruto atstumas: ${distanceInKm.toFixed(3)} km`,
      });
      // Re-order the alternativeRoutes array to make the selected one the first (and therefore the primary color)
      const newRoutes = [...alternativeRoutes];
      const [reorderedItem] = newRoutes.splice(routeIndex, 1);
      newRoutes.unshift(reorderedItem);
      setAlternativeRoutes(newRoutes);
    }
  };

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
        timetableForm.reset({ routeId: watchedRouteId, stop: '', times: '', distanceToNext: '', coords: { lat: 55.7333, lng: 26.2500 } });
        setAlternativeRoutes([]);
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
      const timetableRef = collection(firestore, 'routes', routeId, 'timetable');
      const timetableSnapshot = await getDocs(timetableRef);
      const batch = writeBatch(firestore);
      timetableSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

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
  
  const handleUpdateStop = async (values: z.infer<typeof editStopSchema>) => {
    if (!firestore || !watchedRouteId || !editingStop?.id) {
        toast({ title: 'Klaida!', description: 'Nepasirinktas maršrutas arba stotelė redagavimui.', variant: 'destructive'});
        return;
    }
    setIsUpdatingStop(true);
    const parsedTimes = values.times.split(',').map(t => t.trim()).filter(Boolean);
    if (parsedTimes.length === 0) {
        editStopForm.setError('times', { message: 'Nurodykite bent vieną laiką.' });
        setIsUpdatingStop(false);
        return;
    }

    try {
        const stopRef = doc(firestore, `routes/${watchedRouteId}/timetable`, editingStop.id);
        await updateDoc(stopRef, {
            stop: values.stop,
            times: parsedTimes,
        });
        toast({ title: 'Pavyko!', description: 'Stotelės duomenys atnaujinti.' });
        setEditingStop(null);
    } catch (error) {
        console.error("Error updating stop: ", error);
        toast({ title: 'Klaida!', description: 'Nepavyko atnaujinti stotelės duomenų.', variant: 'destructive'});
    } finally {
        setIsUpdatingStop(false);
    }
  };

  const handleUpdateRoute = async (values: z.infer<typeof routeSchema>) => {
    if (!firestore || !editingRoute?.id) {
      toast({ title: 'Klaida!', description: 'Nepasirinktas maršrutas redagavimui.', variant: 'destructive' });
      return;
    }
    setIsUpdatingRoute(true);
    try {
      const routeRef = doc(firestore, 'routes', editingRoute.id);
      await updateDoc(routeRef, values);
      toast({ title: 'Pavyko!', description: 'Maršruto duomenys atnaujinti.' });
      setEditingRoute(null);
    } catch (error) {
      console.error("Error updating route: ", error);
      toast({ title: 'Klaida!', description: 'Nepavyko atnaujinti maršruto duomenų.', variant: 'destructive' });
    } finally {
      setIsUpdatingRoute(false);
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
            Įveskite naujo maršruto informaciją ir pasirinkite, kuriomis dienomis jis kursuoja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...routeForm}>
            <form
              onSubmit={routeForm.handleSubmit(handleAddRoute)}
              className="space-y-6"
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

               <FormField
                  control={routeForm.control}
                  name="days"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Kursavimo dienos</FormLabel>
                        <FormDescription>
                          Pasirinkite dienas, kuriomis maršrutas yra aktyvus.
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {daysOfWeek.map((day) => (
                        <FormField
                          key={day}
                          control={routeForm.control}
                          name="days"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, day])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {day}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />


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
          <CardDescription>Tvarkykite maršrutus ir pridėkite naujas stoteles su jų laikais.</CardDescription>
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
                           {routes && routes.map((route) => (
                              <div key={route.id} className="relative flex items-center pr-8">
                                <SelectItem value={route.id!} className="w-full">
                                  <div className="flex flex-col text-left">
                                      <p><span className="font-bold">{route.number}</span> — <span>{route.name}</span></p>
                                      {route.days && route.days.length > 0 && (
                                         <div className="flex flex-wrap gap-1 mt-1">
                                            {route.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0,3)}</Badge>)}
                                        </div>
                                      )}
                                  </div>
                                </SelectItem>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingRoute(route); }}>
                                        <Pencil className="h-4 w-4 text-muted-foreground"/>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isDeleting === route.id} onClick={(e) => e.stopPropagation()}>
                                                {isDeleting === route.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive/70"/>}
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
                                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Atšaukti</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteRoute(route.id!)} className="bg-destructive hover:bg-destructive/90">Taip, ištrinti</AlertDialogAction>
                                        </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                              </div>
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
                              {timetableStops.map((stop) => (
                                <li key={stop.id} className="text-sm flex items-center justify-between p-1 hover:bg-muted/50 rounded-md">
                                  <div>
                                    <span className="font-semibold">{stop.stop}</span>
                                    <p className="text-xs text-muted-foreground pl-5">{stop.times.join(', ')}</p>
                                  </div>
                                   <div className="flex items-center">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStop(stop)}>
                                        <Pencil className="h-4 w-4 text-muted-foreground"/>
                                      </Button>
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
                                  </div>
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
                      <Button type="button" variant="outline" size="sm" onClick={() => handleCalculateDistance(undefined, true)} disabled={isCalculatingDistance || !lastStopCoords}>
                          {isCalculatingDistance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
                          Apskaičiuoti atstumą rankiniu būdu
                      </Button>
                  </div>
                  
                <div>
                  <FormLabel>Naujos stotelės koordinatės (pasirinktinai)</FormLabel>
                  <p className="text-sm text-muted-foreground">Paspauskite ant žemėlapio, kad parinktumėte vietą. Bus pasiūlyti keli maršruto variantai. Paspauskite ant patinkančio maršruto, kad jį pasirinktumėte.</p>
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
                          alternativeRoutes={alternativeRoutes}
                          onRouteSelect={handleRouteSelection}
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
      
      <Dialog open={!!editingStop} onOpenChange={(isOpen) => !isOpen && setEditingStop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redaguoti stotelę</DialogTitle>
            <DialogDescription>
              Pakeiskite stotelės "{editingStop?.stop}" pavadinimą ir laikus.
            </DialogDescription>
          </DialogHeader>
          <Form {...editStopForm}>
            <form onSubmit={editStopForm.handleSubmit(handleUpdateStop)} className="space-y-4 py-4">
              <FormField
                control={editStopForm.control}
                name="stop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stotelės pavadinimas</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStopForm.control}
                name="times"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laikai (atskirti kableliu)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="outline">Atšaukti</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingStop}>
                      {isUpdatingStop && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Išsaugoti pakeitimus
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRoute} onOpenChange={(isOpen) => !isOpen && setEditingRoute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redaguoti maršrutą</DialogTitle>
            <DialogDescription>
              Pakeiskite maršruto "{editingRoute?.number} - {editingRoute?.name}" duomenis.
            </DialogDescription>
          </DialogHeader>
          <Form {...editRouteForm}>
            <form onSubmit={editRouteForm.handleSubmit(handleUpdateRoute)} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editRouteForm.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numeris</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editRouteForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pavadinimas</FormLabel>                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                  control={editRouteForm.control}
                  name="days"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Kursavimo dienos</FormLabel>
                        <FormDescription>
                          Pasirinkite dienas, kuriomis maršrutas yra aktyvus.
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {daysOfWeek.map((day) => (
                        <FormField
                          key={day}
                          control={editRouteForm.control}
                          name="days"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, day])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {day}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="outline">Atšaukti</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingRoute}>
                      {isUpdatingRoute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Išsaugoti pakeitimus
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
