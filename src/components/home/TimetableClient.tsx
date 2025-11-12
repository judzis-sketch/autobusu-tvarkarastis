'use client';

import { useState, useMemo } from 'react';
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
import { Clock, Loader2, MapPin, List, ArrowRight, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';


// Dynamically import the map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

const StopToStopMap = dynamic(() => import('./StopToStopMap'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

interface StopDetail {
  current: TimetableEntry;
  next: TimetableEntry;
}

export default function TimetableClient() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStopDetail, setSelectedStopDetail] = useState<StopDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredTimetable = useMemo(() => {
    if (!timetable) return [];
    if (!searchQuery) return timetable;
    return timetable.filter(stop =>
      stop.stop.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [timetable, searchQuery]);


  const handleStopClick = (stop: TimetableEntry) => {
    if (!timetable) return;

    const currentIndex = timetable.findIndex(s => s.id === stop.id);
    if (currentIndex === -1 || currentIndex >= timetable.length - 1) {
      return;
    }

    const nextStop = timetable[currentIndex + 1];

    if (stop.coords && nextStop.coords) {
      setSelectedStopDetail({ current: stop, next: nextStop });
    }
  };

  const calculateTravelTime = (distanceInMeters?: number) => {
    if (!distanceInMeters) return null;
    const averageSpeedKmh = 30;
    const distanceInKm = distanceInMeters / 1000;
    const timeHours = distanceInKm / averageSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    if (timeMinutes < 1) return "< 1 min.";
    return `~ ${timeMinutes} min.`;
  }

  if (isLoadingRoutes) {
    return (
      <div className="flex justify-center items-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
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
              onValueChange={(value) => {
                setSelectedRouteId(value);
                setSearchQuery(''); // Reset search on new route selection
              }}
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
          <>
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-muted-foreground"/>
                    Stotelės paieška
                  </CardTitle>
              </CardHeader>
              <CardContent>
                <Input 
                  placeholder="Įveskite stotelės pavadinimą..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </CardContent>
            </Card>

            <Tabs defaultValue="list">
              <Card className="flex-grow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Maršrutas: {selectedRoute?.number}</CardTitle>
                      <CardDescription>{selectedRoute?.name}</CardDescription>
                    </div>
                    <TabsList>
                      <TabsTrigger value="list"><List className="h-4 w-4 mr-2" />Sąrašas</TabsTrigger>
                      <TabsTrigger value="map" disabled={timetableWithCoords.length === 0}><MapPin className="h-4 w-4 mr-2" />Žemėlapis</TabsTrigger>
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
                      ) : filteredTimetable.length > 0 ? (
                        <div className="space-y-4">
                          {filteredTimetable.map((s, i) => {
                             if (!timetable) return null;
                             const originalIndex = timetable.findIndex(ts => ts.id === s.id);
                             const canOpenMap = s.coords && originalIndex < timetable.length - 1 && timetable[originalIndex+1].coords;
                             
                             return (
                              <div key={s.id || i} className="border-b pb-3">
                                 <Button 
                                  variant="link" 
                                  className="font-medium flex items-center gap-2 p-0 h-auto text-foreground hover:no-underline"
                                  onClick={() => handleStopClick(s)}
                                  disabled={!canOpenMap}
                                 >
                                  <MapPin className={`h-4 w-4 ${s.coords ? (canOpenMap ? 'text-primary' : 'text-accent') : 'text-muted-foreground'}`} />
                                  <span className={canOpenMap ? 'hover:underline' : 'cursor-default'}>{s.stop}</span>
                                </Button>
                                <div className="text-sm text-accent-foreground/80 mt-1 flex items-center gap-2 ml-6">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {(s.times || []).join(', ')}
                                </div>
                              </div>
                             )
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-10">
                          {searchQuery ? `Stotelių pavadinimuose "${searchQuery}" nerasta.` : 'Šiam maršrutui tvarkaraštis dar nesukurtas.'}
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
          </>
        )}
      </div>

      <Sheet open={!!selectedStopDetail} onOpenChange={(isOpen) => !isOpen && setSelectedStopDetail(null)}>
        <SheetContent side="bottom" className="h-[75vh]">
          {selectedStopDetail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-center">Atstumas tarp stotelių</SheetTitle>
                <SheetDescription className="text-center flex items-center justify-center gap-2">
                   <span>{selectedStopDetail.current.stop}</span>
                   <ArrowRight className="h-4 w-4 text-muted-foreground" />
                   <span>{selectedStopDetail.next.stop}</span>
                </SheetDescription>
                 <div className="text-center font-bold text-lg text-primary pt-2">
                    {calculateTravelTime(selectedStopDetail.current.distanceToNext)}
                 </div>
              </SheetHeader>
              <div className="h-[calc(100%-120px)] mt-4 rounded-md overflow-hidden border">
                <StopToStopMap 
                    currentStop={selectedStopDetail.current}
                    nextStop={selectedStopDetail.next}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
