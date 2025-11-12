'use client';

import { useState, useEffect, useTransition } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { getRoutes, getTimetableForRoute } from '@/lib/actions';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Loader2, MapPin } from 'lucide-react';


export default function TimetableClient() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedRoute = routes.find(r => r.id === selectedRouteId);

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
          <CardDescription>Peržiūrėkite norimo maršruto stoteles ir laikus.</CardDescription>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
