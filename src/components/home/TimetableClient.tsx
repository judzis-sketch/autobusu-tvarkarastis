'use client';

import { useState, useEffect, useTransition } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { getTimetableForRoute } from '@/lib/actions';
import { MapController } from '@/lib/map-controller';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, MapPin } from 'lucide-react';

type TimetableClientProps = {
  initialRoutes: Route[];
};

export default function TimetableClient({ initialRoutes }: TimetableClientProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  // We will store the map controller instance in state to ensure it's handled by React's lifecycle
  const [mapController, setMapController] = useState<MapController | null>(null);

  const selectedRoute = initialRoutes.find(r => r.id === selectedRouteId);

  useEffect(() => {
    // This effect initializes the map and should only run once.
    let controller: MapController | null = null;
    
    // Check if map is already initialized to prevent re-initialization
    if (document.getElementById('map') && !document.getElementById('map')?.hasChildNodes()) {
        import('leaflet').then(L => {
             // This is to fix the missing icon issue with react-leaflet
            const markerIcon2x = '/_next/static/media/marker-icon-2x.b4553f17.png';
            const markerIcon = '/_next/static/media/marker-icon.7c2c9535.png';
            const markerShadow = '/_next/static/media/marker-shadow.a0c6a589.png';
            
            // @ts-ignore
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: markerIcon,
                iconRetinaUrl: markerIcon2x,
                shadowUrl: markerShadow,
            });

            controller = new MapController('map', L);
            setMapController(controller);
        });
    }

    // Cleanup function to destroy the map instance when the component unmounts
    return () => {
        controller?.destroy();
        setMapController(null);
    }
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  useEffect(() => {
    if (!selectedRouteId) {
      setTimetable([]);
      mapController?.updateStops([]);
      return;
    }
    
    startTransition(async () => {
      const tt = await getTimetableForRoute(selectedRouteId);
      setTimetable(tt);
      const stopsWithCoords = tt.filter(s => s.coords && s.coords.length === 2) as (TimetableEntry & { coords: [number, number] })[];
      mapController?.updateStops(stopsWithCoords);
    });
  }, [selectedRouteId, mapController]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
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
                {initialRoutes.map((r) => (
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
              <CardTitle>Tvarkaraštis: {selectedRoute?.number}</CardTitle>
              <CardDescription>{selectedRoute?.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
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
                      <div key={i} className="border-b pb-3">
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

      <Card className="lg:h-auto min-h-[400px] lg:min-h-0">
         <CardHeader>
            <CardTitle>Maršruto žemėlapis</CardTitle>
            <CardDescription>Stotelės pažymėtos žemėlapyje.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-120px)]">
             <div id="map" className="h-full w-full rounded-lg z-0" />
        </CardContent>
      </Card>
    </div>
  );
}
