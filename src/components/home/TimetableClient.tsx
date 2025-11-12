'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { getRoutes, getTimetableForRoute } from '@/lib/actions';
import dynamic from 'next/dynamic';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Loader2, MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


const Map = dynamic(() => import('@/components/home/Map'), { 
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-muted rounded-md flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>
});

export default function TimetableClient() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  
  const stopsWithCoords = useMemo(() => {
    return timetable.filter(s => s.coords && Array.isArray(s.coords) && s.coords.length === 2);
  }, [timetable]);

  useEffect(() => {
    const fetchRoutes = async () => {
      setIsLoadingRoutes(true);
      const fetchedRoutes = await getRoutes();
      setRoutes(fetchedRoutes);
      setIsLoadingRoutes(false);
    };
    fetchRoutes();
  }, []);

  useEffect(() => {
    if (!selectedRouteId) {
      setTimetable([]);
      return;
    }
    
    startTransition(async () => {
      const tt = await getTimetableForRoute(selectedRouteId);
      setTimetable(tt);
    });
  }, [selectedRouteId]);

  if (isLoadingRoutes) {
    return <div className="flex justify-center items-center pt-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Pasirinkite maršrutą</CardTitle>
          <CardDescription>Peržiūrėkite norimo maršruto stoteles, laikus ir žemėlapį.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedRouteId} value={selectedRouteId ?? ''}>
            <SelectTrigger>
              <SelectValue placeholder="-- Pasirinkite --" />
            </SelectTrigger>
            <SelectContent>
              {routes.map((r) => (
                <SelectItem key={r.id} value={r.id!}>
                  <span className="font-bold mr-2">{r.number}</span> — <span>{r.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {selectedRouteId && (
        <Card className="flex-grow">
          <CardHeader>
            <CardTitle>Maršrutas: {selectedRoute?.number}</CardTitle>
            <CardDescription>{selectedRoute?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="timetable">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timetable">Tvarkaraštis</TabsTrigger>
                <TabsTrigger value="map" disabled={stopsWithCoords.length === 0}>Žemėlapis</TabsTrigger>
              </TabsList>
              <TabsContent value="timetable">
                  <ScrollArea className="h-[400px] pr-4 mt-4">
                    {isPending ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex flex-col gap-2 border-b pb-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : timetable.length > 0 ? (
                      <div className="space-y-4">
                        {timetable.map((s, i) => (
                          <div key={s.id || i} className="border-b pb-3">
                            <div className="font-medium flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {s.stop}
                            </div>
                            <div className="text-sm text-accent-foreground/80 mt-1 flex items-center gap-2 ml-6">
                              <Clock className="h-3 w-3 text-muted-foreground"/> 
                              {(s.times || []).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-10">Šiam maršrutui tvarkaraštis dar nesukurtas.</p>
                    )}
                  </ScrollArea>
              </TabsContent>
              <TabsContent value="map">
                <div className="mt-4 h-[400px] w-full rounded-md overflow-hidden">
                   {isPending ? (
                     <div className="h-full w-full bg-muted rounded-md flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>
                   ) : (
                     <Map stops={stopsWithCoords} />
                   )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}