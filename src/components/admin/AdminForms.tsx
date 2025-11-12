'use client';

import type { Route, TimetableEntry } from '@/lib/types';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getRoutes, getTimetableForRoute } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2, MapPin } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, getDocs, writeBatch } from 'firebase/firestore';
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
} from "@/components/ui/alert-dialog";
import { Icon } from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const useMapEvents = dynamic(() => import('react-leaflet').then(mod => mod.useMapEvents), { ssr: false });

// This is a workaround for a bug in react-leaflet where the default icon path is not resolved correctly.
const DefaultIcon = new Icon({
    iconUrl: '/marker-icon.png',
    iconRetinaUrl: '/marker-icon-2x.png',
    shadowUrl: '/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function LocationMarker({ onCoordsChange, coords }: { onCoordsChange: (coords: [number, number]) => void; coords: [number, number] | null }) {
    const [position, setPosition] = useState<[number, number] | null>(coords);
    const map = useMapEvents({
        click(e) {
            const newCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
            setPosition(newCoords);
            onCoordsChange(newCoords);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    useEffect(() => {
        setPosition(coords);
    }, [coords]);

    return position === null ? null : (
        <Marker position={position} icon={DefaultIcon} />
    );
}

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const timetableSchema = z.object({
  routeId: z.string({ required_error: 'Prašome pasirinkti maršrutą.' }),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(5, 'Laikai yra privalomi (pvz., 08:00)'),
  coords: z.string().optional(),
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
      setRoutes(fetchedRoutes);
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
    defaultValues: { routeId: '', stop: '', times: '', coords: '' },
  });

  const coordsValue = timetableForm.watch('coords');
  const selectedMarkerCoords = useMemo(() => {
    if (!coordsValue) return null;
    const parts = coordsValue.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]] as [number, number];
    }
    return null;
  }, [coordsValue]);

  const handleCoordsChange = (newCoords: [number, number]) => {
      timetableForm.setValue('coords', `${newCoords[0].toFixed(6)}, ${newCoords[1].toFixed(6)}`);
  };

  const handleAddRoute = (values: z.infer<typeof routeSchema>) => {
    startTransitionRoute(async () => {
      const routesCollectionRef = collection(firestore, 'routes');
      const newRoute = {
          ...values,
          createdAt: serverTimestamp()
      };
      addDocumentNonBlocking(routesCollectionRef, newRoute);
      
      toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai pridėtas į eilę.' });
      routeForm.reset();
      await fetchRoutes(); // Refresh routes list
    });
  };
  
  const handleAddTimetable = (values: z.infer<typeof timetableSchema>) => {
    startTransitionTimetable(() => {
        const { routeId, stop, times, coords } = values;

        const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);
        if(parsedTimes.length === 0) {
            toast({ title: 'Klaida!', description: 'Nurodykite bent vieną laiką.', variant: 'destructive'});
            return;
        }
        
        let parsedCoords: [number, number] | undefined = undefined;
        if (coords) {
          const parts = coords.split(',').map((p) => parseFloat(p.trim()));
          if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
            parsedCoords = [parts[0], parts[1]];
          } else {
             toast({ title: 'Klaida!', description: 'Neteisingas koordinačių formatas. Turi būti "platumą, ilguma".', variant: 'destructive'});
             return;
          }
        }

        const payload: any = { stop, times: parsedTimes, createdAt: serverTimestamp() };
        if (parsedCoords) {
          payload.coords = parsedCoords;
        }
        
        const timetableColRef = collection(firestore, `routes/${routeId}/timetable`);
        addDocumentNonBlocking(timetableColRef, payload);
        
        toast({ title: 'Pavyko!', description: 'Tvarkaraščio įrašas pridėtas į eilę.' });
        timetableForm.reset();
    });
  };

  const handleDeleteRoute = async (routeId: string) => {
    setIsDeleting(routeId);
    try {
      const routeRef = doc(firestore, 'routes', routeId);
      const timetableRef = collection(firestore, 'routes', routeId, 'timetable');
      
      const batch = writeBatch(firestore);
      const timetableSnapshot = await getDocs(timetableRef);
      timetableSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
      });
      
      deleteDocumentNonBlocking(routeRef, async () => {
        await batch.commit();
        return Promise.resolve();
      });

      toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai ištrintas.'});
      setRoutes(prev => prev.filter(r => r.id !== routeId));

    } catch (e: any) {
        toast({ title: 'Klaida!', description: 'Nepavyko ištrinti maršruto tvarkaraščio įrašų.', variant: 'destructive'});
        console.error(e);
    }
    setIsDeleting(null);
  }
  
  if (isLoadingRoutes) {
    return <div className="flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Form {...timetableForm}>
              <form onSubmit={timetableForm.handleSubmit(handleAddTimetable)} className="space-y-4">
                <FormField
                  control={timetableForm.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maršrutas</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                <FormField
                  control={timetableForm.control}
                  name="coords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Koordinatės (pasirinkti žemėlapyje)</FormLabel>
                      <FormControl>
                        <Input placeholder="Platuma, Ilguma" {...field} />
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
            <div className="h-[400px] w-full rounded-md overflow-hidden border">
              <MapContainer
                  center={[54.6872, 25.2797]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
              >
                  <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <LocationMarker onCoordsChange={handleCoordsChange} coords={selectedMarkerCoords} />
              </MapContainer>
            </div>
          </div>
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
