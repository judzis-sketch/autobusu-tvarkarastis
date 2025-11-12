'use client';

import { useState, useEffect } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Loader2, MapPin, List } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('./Map'), { 
    ssr: false,
    loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

export default function TimetableClient() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const firestore = useFirestore();

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('number', 'asc'));
  }, [firestore]);
  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);

  const timetableQuery = useMemoFirebase(() => {
    if (!firestore || !selectedRouteId) return null;
    return query(
      collection(firestore, `routes/${selectedRouteId}/timetable`),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, selectedRouteId]);

  const { data: timetable, isLoading: isLoadingTimetable } = useCollection<TimetableEntry>(timetableQuery);

  const selectedRoute = routes?.find((r) => r.id === selectedRouteId);
  const timetableWithCoords = timetable?.filter(s => s.coords && s.coords.length === 2) || [];

  if (isLoadingRoutes) {
    return (
      <div className="flex justify-center items-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Pasirinkite maršrutą</CardTitle>
          <CardDescription>
            Peržiūrėkite norimo maršruto stoteles ir laikus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={setSelectedRouteId}
            value={selectedRouteId ?? ''}
          >
            <SelectTrigger>
              <SelectValue placeholder="-- Pasirinkite --" />
            </SelectTrigger>
            <SelectContent>
              {routes && routes.map((r) => (
                <SelectItem key={r.id} value={r.id!}>
                  <span className="font-bold mr-2">{r.number}</span> —{' '}
                  <span>{r.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedRouteId && (
        <Tabs defaultValue="list">
          <Card className="flex-grow">
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Maršrutas: {selectedRoute?.number}</CardTitle>
                    <CardDescription>{selectedRoute?.name}</CardDescription>
                  </div>
                  <TabsList>
                    <TabsTrigger value="list"><List className="h-4 w-4 mr-2"/>Sąrašas</TabsTrigger>
                    <TabsTrigger value="map" disabled={timetableWithCoords.length === 0}><MapPin className="h-4 w-4 mr-2"/>Žemėlapis</TabsTrigger>
                  </TabsList>
              </div>
            </CardHeader>
            <CardContent>
                <TabsContent value="list">
                  <ScrollArea className="h-[400px] pr-4 mt-4">
                    {isLoadingTimetable ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex flex-col gap-2 border-b pb-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : timetable && timetable.length > 0 ? (
                      <div className="space-y-4">
                        {timetable.map((s, i) => (
                          <div key={s.id || i} className="border-b pb-3">
                            <div className="font-medium flex items-center gap-2">
                              <MapPin className={`h-4 w-4 ${s.coords ? 'text-primary' : 'text-muted-foreground'}`} />
                              {s.stop}
                            </div>
                            <div className="text-sm text-accent-foreground/80 mt-1 flex items-center gap-2 ml-6">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {(s.times || []).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-10">
                        Šiam maršrutui tvarkaraštis dar nesukurtas.
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="map">
                    <div className="h-[400px] mt-4 rounded-md overflow-hidden border">
                       {timetableWithCoords.length > 0 ? (
                           <Map stops={timetableWithCoords} />
                       ) : (
                           <div className="w-full h-full flex items-center justify-center bg-muted">
                               <p className="text-muted-foreground">Nėra stotelių su koordinatėmis.</p>
                           </div>
                       )}
                    </div>
                </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}
    </div>
  );
}
