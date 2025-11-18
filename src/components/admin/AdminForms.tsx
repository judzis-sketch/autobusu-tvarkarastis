'use client';

import type { Route, TimetableEntry } from '@/lib/types';
import { useState, useTransition, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, Trash2, Route as RouteIcon, ChevronDown, ListOrdered, Pencil, BusFront, Undo2 } from 'lucide-react';
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
  updateDoc
} from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { getRoute } from '@/lib/osrm';
import { searchAddresses, type AddressResult } from '@/lib/nominatim';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import type { LatLngTuple } from 'leaflet';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useDebounce } from '@/hooks/use-debounce';

const AdminMap = dynamic(() => import('./AdminMap'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

const daysOfWeek = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"] as const;

const routeSchema = z.object({
  number: z.string().optional(),
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

type AlternativeRoute = {
  distance: number;
  geometry: LatLngTuple[];
};


export default function AdminForms() {
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [lastStopCoords, setLastStopCoords] = useState<LatLngTuple | null>(null);
  
  const [editingStop, setEditingStop] = useState<TimetableEntry | null>(null);
  const [isUpdatingStop, setIsUpdatingStop] = useState(false);

  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  const [stopToDelete, setStopToDelete] = useState<(TimetableEntry & { routeId: string }) | null>(null);

  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [isUpdatingRoute, setIsUpdatingRoute] = useState(false);

  const firestore = useFirestore();

  const [newStopCoords, setNewStopCoords] = useState<LatLngTuple | null>(null);
  const [manualRoutePoints, setManualRoutePoints] = useState<LatLngTuple[]>([]);
  const [alternativeRoutes, setAlternativeRoutes] = useState<AlternativeRoute[]>([]);
  const [selectedRouteGeometry, setSelectedRouteGeometry] = useState<LatLngTuple[]>([]);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const debouncedAddressQuery = useDebounce(addressQuery, 300);
  const addressInputRef = useRef<HTMLDivElement | null>(null);

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', distanceToNext: '', coords: { lat: undefined, lng: undefined } },
  });
  const { setValue, watch, control, getValues, reset: resetTimetableForm } = timetableForm;
  const watchedRouteId = watch('routeId');

  const selectedRouteForDisplay = useMemo(() => routes?.find(r => r.id === watchedRouteId), [routes, watchedRouteId]);

  const timetableQuery = useMemoFirebase(() => {
    if (!firestore || !watchedRouteId) return null;
    return query(collection(firestore, `routes/${watchedRouteId}/timetable`), orderBy('createdAt', 'asc'));
  }, [firestore, watchedRouteId]);
  const { data: timetableStops, isLoading: isLoadingTimetableStops } = useCollection<TimetableEntry>(timetableQuery);
  
  const editStopForm = useForm<z.infer<typeof editStopSchema>>({
      resolver: zodResolver(editStopSchema),
  });

  const editRouteForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
  });

  // Handle address search
  useEffect(() => {
    const performSearch = async () => {
        if (debouncedAddressQuery.length > 2) {
            setIsAddressSearching(true);
            const results = await searchAddresses(debouncedAddressQuery);
            setAddressResults(results);
            setIsAddressSearching(false);
            if (results.length > 0) {
              setIsAddressPopoverOpen(true);
            } else {
              setIsAddressPopoverOpen(false);
            }
        } else {
            setAddressResults([]);
            setIsAddressPopoverOpen(false);
        }
    };
    performSearch();
  }, [debouncedAddressQuery]);

  const handleAddressSelect = (address: AddressResult) => {
    setValue('stop', address.display_name, { shouldValidate: true });
    setNewStopCoords([address.lat, address.lon]);
    setAddressQuery(address.display_name);
    setIsAddressPopoverOpen(false);
    setAddressResults([]);
  };
  
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
  
  const resetMapState = useCallback(() => {
    setNewStopCoords(null);
    setManualRoutePoints([]);
    setAlternativeRoutes([]);
    setSelectedRouteGeometry([]);
    setValue('distanceToNext', '');
  }, [setValue]);

  useEffect(() => {
    resetMapState();
  }, [watchedRouteId, resetMapState])

  useEffect(() => {
    if (newStopCoords) {
      setValue('coords.lat', newStopCoords[0]);
      setValue('coords.lng', newStopCoords[1]);
    } else {
      setValue('coords.lat', undefined);
      setValue('coords.lng', undefined);
    }
  }, [newStopCoords, setValue]);

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

        try {
          const querySnapshot = await getDocs(lastStopQuery);
          if (!querySnapshot.empty) {
              const lastStop = querySnapshot.docs[0].data() as TimetableEntry;
              if (lastStop.coords) {
                  setLastStopCoords(lastStop.coords as [number, number]);
              } else {
                  setLastStopCoords(null);
              }
          } else {
              setLastStopCoords(null);
          }
        } catch (error) {
          console.error("Error fetching last stop:", error);
          setLastStopCoords(null);
        }
    };

    fetchLastStop();
  }, [watchedRouteId, firestore, timetableStops]);


  const handleCalculateDistance = useCallback(async () => {
    if (!newStopCoords) {
        toast({
            title: 'Negalima apskaičiuoti',
            description: 'Prašome pažymėti naujos stotelės vietą žemėlapyje.',
            variant: 'destructive',
        });
        return;
    }
    
    const allPoints: LatLngTuple[] = [];
    if (lastStopCoords) {
      allPoints.push(lastStopCoords);
    }
    allPoints.push(...manualRoutePoints);
    allPoints.push(newStopCoords);

    if (allPoints.length < 2) {
      toast({
            title: 'Negalima apskaičiuoti',
            description: 'Tai pirma maršruto stotelė. Atstumas neskaičiuojamas. Galite išsaugoti stotelę.',
            variant: 'default',
        });
        return;
    }


    setIsCalculatingDistance(true);
    setAlternativeRoutes([]);
    setSelectedRouteGeometry([]);
    setValue('distanceToNext', '');

    try {
        const routesData = await getRoute(allPoints, true);
        
        if (routesData && routesData.length > 0) {
            if (manualRoutePoints.length > 0 || routesData.length === 1) {
               setSelectedRouteGeometry(routesData[0].geometry);
               setValue('distanceToNext', String((routesData[0].distance / 1000).toFixed(3)));
               toast({
                    title: 'Maršrutas apskaičiuotas',
                    description: `Atstumas: ${(routesData[0].distance / 1000).toFixed(3)} km. Galite išsaugoti stotelę.`,
               });
               setAlternativeRoutes([]);
               return;
            }
            else {
                 toast({
                    title: `Rasta ${routesData.length} maršruto variantų`,
                    description: `Paspauskite ant norimo varianto žemėlapyje, kad jį pasirinktumėte.`,
                });
            }
            setAlternativeRoutes(routesData);
        } else {
            toast({
                title: 'Maršrutų apskaičiavimo klaida',
                description: 'Tarnyba negrąžino jokio maršruto. Patikrinkite naršyklės konsolę.',
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
}, [newStopCoords, lastStopCoords, toast, setValue, manualRoutePoints]);

const handleMapClick = (lat: number, lng: number) => {
    if (!newStopCoords) {
        setNewStopCoords([lat, lng]);
        setManualRoutePoints([]);
        setAlternativeRoutes([]);
        setSelectedRouteGeometry([]);
        setValue('distanceToNext', '');
    } else {
        setManualRoutePoints(prev => [...prev, [lat, lng]]);
        setAlternativeRoutes([]);
        setSelectedRouteGeometry([]);
        setValue('distanceToNext', '');
    }
};

const handleRouteSelection = (route: AlternativeRoute) => {
    setSelectedRouteGeometry(route.geometry);
    setValue('distanceToNext', String((route.distance / 1000).toFixed(3)));
    toast({
        title: 'Maršrutas pasirinktas',
        description: `Atstumas: ${(route.distance / 1000).toFixed(3)} km. Galite išsaugoti stotelę.`,
    });
};

  const handleResetMap = () => {
    resetMapState();
    toast({
        title: 'Žemėlapis išvalytas',
        description: 'Dabar galite iš naujo žymėti stotelę ir maršrutą.'
    });
  }

  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      number: '',
      name: '',
      days: [],
    },
  });
  
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
        routeForm.reset({ number: '', name: '', days: []});
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
      const { routeId, stop, times, distanceToNext } = values;

      if (!firestore) {
        toast({ title: 'Klaida!', description: 'Duomenų bazė nepasiekiama.', variant: 'destructive' });
        return;
      }
       
      if (!newStopCoords) {
        toast({ title: 'Klaida!', description: 'Nepažymėta naujos stotelės vieta.', variant: 'destructive'});
        return;
      }

      const hasPreviousStops = !!lastStopCoords;
      if (hasPreviousStops && selectedRouteGeometry.length === 0) {
        toast({
          title: 'Klaida!',
          description: 'Prašome apskaičiuoti ir pasirinkti maršrutą prieš išsaugant.',
          variant: 'destructive',
        });
        return;
      }

      const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);
      if (parsedTimes.length === 0) {
        toast({ title: 'Klaida!', description: 'Nurodykite bent vieną laiką.', variant: 'destructive' });
        return;
      }

      const payload: Omit<TimetableEntry, 'id'> = {
        stop,
        times: parsedTimes,
        createdAt: serverTimestamp(),
        coords: newStopCoords,
      };
      
      if (selectedRouteGeometry.length > 0) {
        payload.routeGeometry = selectedRouteGeometry.map(point => ({ lat: point[0], lng: point[1] }));
      }

      if (distanceToNext) {
        const distanceInKm = parseFloat(distanceToNext);
        if (!isNaN(distanceInKm)) {
            payload.distanceToNext = distanceInKm * 1000;
        } else {
            toast({ title: 'Klaida!', description: 'Atstumas turi būti skaičius.', variant: 'destructive' });
            return;
        }
      }

      const timetableColRef = collection(firestore, `routes/${routeId}/timetable`);

      try {
        await addDoc(timetableColRef, payload);
        toast({ title: 'Pavyko!', description: 'Tvarkaraščio įrašas pridėtas.' });
        resetTimetableForm({ routeId: watchedRouteId, stop: '', times: '', distanceToNext: '' });
        setAddressQuery('');
        resetMapState();
      } catch (error) {
        toast({ title: 'Klaida!', description: 'Nepavyko pridėti tvarkaraščio įrašo.', variant: 'destructive' });
        console.error('Error adding timetable entry:', error);
      }
    });
  };

  const handleDeleteRoute = async () => {
    if (!firestore || !routeToDelete?.id) return;

    setIsDeleting(true);
    try {
      const timetableRef = collection(firestore, 'routes', routeToDelete.id, 'timetable');
      const timetableSnapshot = await getDocs(timetableRef);
      
      const batch = writeBatch(firestore);
      
      timetableSnapshot.docs.forEach((subDoc) => {
        batch.delete(subDoc.ref);
      });
  
      const routeRef = doc(firestore, 'routes', routeToDelete.id);
      batch.delete(routeRef);
  
      await batch.commit();
  
      toast({ title: 'Pavyko!', description: 'Maršrutas ir jo tvarkaraščiai sėkmingai ištrinti.' });
    } catch (error) {
      console.error('Error deleting route:', error);
      toast({ title: 'Klaida!', description: `Nepavyko ištrinti maršruto. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setRouteToDelete(null); 
    }
  };

  const handleDeleteStop = async () => {
    if (!firestore || !stopToDelete) return;
    
    setIsDeleting(true);
    try {
      const stopRef = doc(firestore, 'routes', stopToDelete.routeId, 'timetable', stopToDelete.id!);
      await deleteDoc(stopRef);
      toast({ title: 'Pavyko!', description: 'Stotelė sėkmingai ištrinta.' });
    } catch (error) {
      console.error('Error deleting stop:', error);
      toast({ title: 'Klaida!', description: `Nepavyko ištrinti stotelės. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setStopToDelete(null);
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
                      <FormLabel>Numeris (nebūtina)</FormLabel>
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
                                        ? field.onChange([...(field.value || []), day])
                                        : field.onChange(
                                            (field.value || [])?.filter(
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <BusFront className="h-4 w-4" />
                      <span>Visi maršrutai ({routes?.length ?? 0})</span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <ScrollArea className="h-60 rounded-md p-2">
                    {routes && routes.length > 0 ? (
                      <div className="space-y-1">
                        {routes.map((route) => (
                          <div key={route.id} className="text-sm flex items-center justify-between p-1 hover:bg-muted/50 rounded-md">
                            <div className="flex-grow flex flex-col text-left">
                              <p><span className="font-bold">{route.number}</span> — <span>{route.name}</span></p>
                              {route.days && route.days.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {route.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0, 3)}</Badge>)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoute(route)}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRouteToDelete(route)}>
                                <Trash2 className="h-4 w-4 text-destructive/70" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center pt-4">Maršrutų dar nesukurta.</p>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <FormField
                control={timetableForm.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pasirinkite maršrutą stotelei pridėti</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-auto">
                            <SelectValue placeholder="-- Pasirinkti maršrutą --">
                              {selectedRouteForDisplay ? (
                                <div className="flex flex-col text-left">
                                  <p><span className="font-bold">{selectedRouteForDisplay.number}</span> — <span>{selectedRouteForDisplay.name}</span></p>
                                  {selectedRouteForDisplay.days && selectedRouteForDisplay.days.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {selectedRouteForDisplay.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0, 3)}</Badge>)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                '-- Pasirinkti maršrutą --'
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {routes && routes.map((route) => (
                              <SelectItem
                                key={route.id}
                                value={route.id!}
                              >
                                <div className="flex-grow flex flex-col text-left">
                                    <p><span className="font-bold">{route.number}</span> — <span>{route.name}</span></p>
                                    {route.days && route.days.length > 0 && (
                                       <div className="flex flex-wrap gap-1 mt-1">
                                          {route.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0,3)}</Badge>)}
                                      </div>
                                    )}
                                </div>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedRouteId && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <ListOrdered className="h-4 w-4" />
                        <span>Esamos maršruto stotelės ({timetableStops?.length ?? 0})</span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <ScrollArea className="h-60 mt-2 rounded-md p-2">
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
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStop(stop)}>
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStopToDelete({ ...stop, routeId: watchedRouteId })}>
                                  <Trash2 className="h-4 w-4 text-destructive/70" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center pt-4">Šiam maršrutui stotelių dar nepridėta.</p>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}


              <div className="space-y-4 pt-4 border-t">
                <FormField
                  control={timetableForm.control}
                  name="stop"
                  render={({ field }) => (
                    <FormItem ref={addressInputRef}>
                      <FormLabel>Naujos stotelės pavadinimas</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Vinco Kudirkos aikštė"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setAddressQuery(e.target.value);
                            if (e.target.value.length > 2) {
                              setIsAddressPopoverOpen(true);
                            } else {
                              setIsAddressPopoverOpen(false);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding to allow click on popover
                            setTimeout(() => setIsAddressPopoverOpen(false), 150);
                          }}
                          onFocus={() => {
                              if (addressQuery.length > 2 && addressResults.length > 0) {
                                setIsAddressPopoverOpen(true);
                              }
                          }}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Popover open={isAddressPopoverOpen}>
                    <PopoverTrigger asChild>
                        <div />
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[--radix-popover-trigger-width] max-h-60 overflow-auto p-1"
                        style={{ width: addressInputRef.current?.offsetWidth }}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        align="start"
                    >
                      {isAddressSearching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          Ieškoma...
                        </div>
                      ) : addressResults.length > 0 ? (
                        <div className="space-y-1">
                          {addressResults.map((address) => (
                            <Button
                              key={address.place_id}
                              type="button"
                              variant="ghost"
                              className="w-full h-auto text-left justify-start p-2"
                              onClick={() => handleAddressSelect(address)}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{address.display_name}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      ) : debouncedAddressQuery.length > 2 ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">Adresų nerasta.</p>
                      ) : null}
                    </PopoverContent>
                </Popover>

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
                            <Input type="number" step="any" placeholder="Pasirinkite maršrutą žemėlapyje" {...field} readOnly />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                      />
                       <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleCalculateDistance} disabled={isCalculatingDistance || !newStopCoords}>
                            {isCalculatingDistance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
                            Apskaičiuoti maršrutą
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetMap} disabled={!newStopCoords && alternativeRoutes.length === 0 && manualRoutePoints.length === 0}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            Išvalyti žemėlapį
                        </Button>
                       </div>
                  </div>
                  
                <div>
                  <FormLabel>Maršruto sudarymas</FormLabel>
                   <p className="text-sm text-muted-foreground">
                    1. **Pažymėkite naują stotelę:** Adreso paieškoje raskite norimą vietą arba paspauskite tiesiai ant žemėlapio. Pirmas paspaudimas visada pažymi naujos stotelės vietą (raudonas žymeklis).<br/>
                    2. **Patikslinkite kelią (nebūtina):** Jei automatiškai rastas kelias netinka, galite pridėti tarpinių taškų. Tiesiog paspauskite ant žemėlapio tose vietose, per kurias maršrutas turi eiti. Atsiras mėlyni žymekliai.<br/>
                    3. **Apskaičiuokite maršrutą:** Paspauskite mygtuką "Apskaičiuoti maršrutą".<br/>
                    4. **Pasirinkite variantą:** Jei sistema ras kelis kelio variantus, jie bus atvaizduoti pilka spalva. Paspauskite ant norimos linijos, kad ją pasirinktumėte (ji nusidažys mėlynai).
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                      <Controller
                          control={control}
                          name="coords.lat"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Platuma</FormLabel>
                                  <FormControl>
                                      <Input readOnly type="number" step="any" {...field} value={field.value ?? ''} />
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
                                      <Input readOnly type="number" step="any" {...field} value={field.value ?? ''} />
                                  </FormControl>
                              </FormItem>
                          )}
                      />
                  </div>
                  <div className="mt-4 h-[500px] w-full rounded-md overflow-hidden border">
                      <AdminMap
                          newStopCoords={newStopCoords}
                          onMapClick={handleMapClick}
                          onRouteSelect={handleRouteSelection}
                          existingStops={timetableStops || []}
                          lastStopPosition={lastStopCoords}
                          alternativeRoutes={alternativeRoutes}
                          selectedRouteGeometry={selectedRouteGeometry}
                          manualRoutePoints={manualRoutePoints}
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
      
      {/* Edit Stop Dialog */}
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
      
      {/* Edit Route Dialog */}
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
      
      {/* Delete Route Dialog */}
       <Dialog open={!!routeToDelete} onOpenChange={() => setRouteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ar tikrai norite ištrinti maršrutą?</DialogTitle>
            <DialogDescription>
              Šis veiksmas visam laikui ištrins maršrutą "{routeToDelete?.number} - {routeToDelete?.name}" ir visus susijusius tvarkaraščio įrašus. Šio veiksmo negalima anuliuoti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRouteToDelete(null)}>Atšaukti</Button>
            <Button 
              type="button" 
              onClick={handleDeleteRoute} 
              disabled={isDeleting} 
              variant="destructive"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ištrinti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Stop Dialog */}
       <Dialog open={!!stopToDelete} onOpenChange={() => setStopToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ar tikrai norite ištrinti stotelę?</DialogTitle>
            <DialogDescription>
              Šis veiksmas visam laikui ištrins stotelę "{stopToDelete?.stop}". Šio veiksmo negalima anuliuoti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStopToDelete(null)}>Atšaukti</Button>
            <Button 
              type="button" 
              onClick={handleDeleteStop}
              disabled={isDeleting} 
              variant="destructive"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ištrinti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
