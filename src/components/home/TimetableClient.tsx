'use client';

import { useState, useMemo, FormEvent } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

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
import { Clock, Loader2, MapPin, List, ArrowRight, Search, LocateFixed, X, Route as RouteIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/distance';
import { Badge } from '../ui/badge';


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
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [isSearchingStops, setIsSearchingStops] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

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
    if (!activeSearch) return timetable;
    return timetable.filter(stop =>
      stop.stop.toLowerCase().includes(activeSearch.toLowerCase())
    );
  }, [timetable, activeSearch]);


  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput) {
      setActiveSearch('');
      return;
    }
    
    // If a route is already selected, search within it
    if(selectedRouteId) {
      setActiveSearch(searchInput);
      return;
    }

    // If no route is selected, search across all routes
    if (!firestore || !routes) {
      toast({ title: 'Klaida', description: 'Maršrutų sąrašas dar neužkrautas.', variant: 'destructive'});
      return;
    }

    setIsSearchingStops(true);
    toast({ title: 'Ieškoma stotelės...', description: `Ieškoma "${searchInput}" visuose maršrutuose.`});

    let foundStop = false;
    for (const route of routes) {
      if (!route.id) continue;
      const stopsQuery = query(collection(firestore, `routes/${route.id}/timetable`));
      const stopsSnapshot = await getDocs(stopsQuery);
      
      for (const doc of stopsSnapshot.docs) {
        const stopData = doc.data() as TimetableEntry;
        if (stopData.stop.toLowerCase().includes(searchInput.toLowerCase())) {
          toast({
            title: 'Stotelė rasta!',
            description: `Stotelė "${stopData.stop}" rasta maršrute ${route.number}. Kraunamas tvarkaraštis...`,
          });
          setSelectedRouteId(route.id);
          setActiveSearch(searchInput); // Set active search to filter the newly loaded timetable
          foundStop = true;
          break; // Exit inner loop
        }
      }
      if (foundStop) {
        break; // Exit outer loop
      }
    }

    if (!foundStop) {
      toast({
        title: 'Stotelė nerasta',
        description: `Stotelė pavadinimu "${searchInput}" nerasta jokiame maršrute.`,
        variant: 'destructive',
      });
    }

    setIsSearchingStops(false);
  }

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  }

  const handleFindNearestStop = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolokacija nepalaikoma',
        description: 'Jūsų naršyklė nepalaiko vietos nustatymo funkcijos.',
        variant: 'destructive',
      });
      return;
    }

    setIsFindingLocation(true);
    toast({
      title: 'Ieškoma Jūsų vietos...',
      description: 'Prašome suteikti leidimą nustatyti Jūsų buvimo vietą.',
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast({
          title: 'Vieta rasta!',
          description: 'Ieškoma artimiausios stotelės...',
        });

        if (!firestore || !routes) {
          toast({ title: 'Klaida', description: 'Nepavyko gauti maršrutų sąrašo.', variant: 'destructive'});
          setIsFindingLocation(false);
          return;
        }

        let allStops: (TimetableEntry & { routeId: string })[] = [];
        // Fetch all stops from all routes
        for (const route of routes) {
          if (!route.id) continue;
          const stopsQuery = query(collection(firestore, `routes/${route.id}/timetable`), orderBy('createdAt', 'asc'));
          const stopsSnapshot = await getDocs(stopsQuery);
          stopsSnapshot.forEach(doc => {
            const stopData = doc.data() as TimetableEntry;
            if (stopData.coords) {
              allStops.push({ ...stopData, id: doc.id, routeId: route.id! });
            }
          });
        }
        
        if (allStops.length === 0) {
            toast({ title: 'Nerasta stotelių', description: 'Sistemoje nerasta stotelių su koordinatėmis.', variant: 'destructive'});
            setIsFindingLocation(false);
            return;
        }

        let nearestStop: (TimetableEntry & { routeId: string }) | null = null;
        let minDistance = Infinity;

        allStops.forEach(stop => {
          const distance = getDistance(latitude, longitude, stop.coords![0], stop.coords![1]);
          if (distance < minDistance) {
            minDistance = distance;
            nearestStop = stop;
          }
        });

        if (nearestStop) {
           toast({
              title: 'Artimiausia stotelė rasta!',
              description: `"${nearestStop.stop}" (${(minDistance).toFixed(2)} km). Kraunamas tvarkaraštis...`,
            });
            setSelectedRouteId(nearestStop.routeId);
            setSearchInput(nearestStop.stop);
            setActiveSearch(nearestStop.stop);
        } else {
             toast({ title: 'Klaida', description: 'Nepavyko rasti artimiausios stotelės.', variant: 'destructive'});
        }


        setIsFindingLocation(false);
      },
      (error) => {
        toast({
          title: 'Vietos nustatymo klaida',
          description: error.message,
          variant: 'destructive',
        });
        setIsFindingLocation(false);
      }
    );
  };

  const handleStopClick = (clickedStop: TimetableEntry) => {
    if (!timetable) return;

    const currentIndex = timetable.findIndex(s => s.id === clickedStop.id);
    const nextStop = timetable[currentIndex + 1];

    if (nextStop && clickedStop.routeGeometry && clickedStop.coords && nextStop.coords) {
      setSelectedStopDetail({
        current: clickedStop,
        next: nextStop,
      });
    } else {
      toast({
        title: "Paskutinė stotelė arba trūksta duomenų",
        description: "Tai yra paskutinė maršruto stotelė arba trūksta kelio geometrijos duomenų.",
      });
    }
  };


  const calculateTravelTime = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined || distanceInMeters === null) return null;
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
            <CardTitle>Maršruto ir stotelės paieška</CardTitle>
            <CardDescription>
              Pasirinkite maršrutą arba ieškokite stotelės pagal pavadinimą visuose maršrutuose.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Stotelės paieška</label>
                    <div className="relative flex-grow">
                        <Input 
                        placeholder="Įveskite stotelės pavadinimą..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={handleClearSearch}
                        >
                            <X className="h-4 w-4 text-muted-foreground"/>
                        </Button>
                        )}
                    </div>
                </div>
                 <Button type="submit" variant="secondary" disabled={isSearchingStops}>
                    {isSearchingStops ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="h-4 w-4 mr-2" />}
                    Ieškoti stotelės
                </Button>
             </form>

            <div className="flex items-center gap-4">
                <div className="flex-1 border-t"></div>
                <span className="text-xs text-muted-foreground">ARBA</span>
                <div className="flex-1 border-t"></div>
            </div>
            
            <div className="space-y-2">
                 <label className="text-sm font-medium">Pasirinkite maršrutą</label>
                <Select
                  onValueChange={(value) => {
                    setSelectedRouteId(value);
                    handleClearSearch();
                  }}
                  value={selectedRouteId ?? ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- Pasirinkite iš sąrašo --" />
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
            </div>

            <Button 
                className="w-full" 
                variant="outline" 
                onClick={handleFindNearestStop}
                disabled={isFindingLocation}
            >
                {isFindingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/> }
                Rasti artimiausią stotelę pagal mano lokaciją
            </Button>
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
                      {selectedRoute?.days && selectedRoute.days.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {selectedRoute.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0,3)}</Badge>)}
                        </div>
                      )}
                    </div>
                    <TabsList>
                      <TabsTrigger value="list"><List className="h-4 w-4 mr-2" />Sąrašas</TabsTrigger>
                      <TabsTrigger value="map" disabled={timetableWithCoords.length === 0}><MapPin className="h-4 w-4 mr-2" />Žemėlapis</TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent>
                  <TabsContent value="list">
                    <ScrollArea className="h-[600px] pr-4 mt-4">
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
                             const isLastStop = i === filteredTimetable.length - 1;
                             const canOpenMap = !isLastStop && !!s.routeGeometry;
                             const distanceToNext = s.distanceToNext;
                             const travelTime = calculateTravelTime(distanceToNext);
                             
                             return (
                              <div key={s.id || i} className="border-b pb-3 space-y-1">
                                 <Button 
                                  variant="link" 
                                  className="font-medium flex items-center gap-2 p-0 h-auto text-foreground hover:no-underline"
                                  onClick={() => handleStopClick(s)}
                                  disabled={!canOpenMap}
                                 >
                                  <MapPin className={`h-4 w-4 ${s.coords ? (canOpenMap ? 'text-primary' : 'text-accent') : 'text-muted-foreground'}`} />
                                  <span className={canOpenMap ? 'hover:underline' : 'cursor-default'}>{s.stop}</span>
                                </Button>
                                <div className="text-sm text-accent-foreground/80 flex items-center gap-2 ml-6">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span>{(s.times || []).join(', ')}</span>
                                </div>
                                {!isLastStop && distanceToNext !== undefined && distanceToNext !== null && travelTime && (
                                   <div className="text-sm text-muted-foreground flex items-center gap-2 ml-6">
                                     <RouteIcon className="h-3 w-3" />
                                     <span>Iki {filteredTimetable[i + 1]?.stop}</span>
                                     <ArrowRight className="h-3 w-3" />
                                     <span>{(distanceToNext / 1000).toFixed(2)} km</span>
                                     <span className="text-xs">({travelTime})</span>
                                   </div>
                                )}
                              </div>
                             )
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-10">
                          {activeSearch ? `Stotelių pavadinimuose "${activeSearch}" nerasta.` : 'Šiam maršrutui tvarkaraštis dar nesukurtas.'}
                        </p>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="map">
                    <div className="h-[600px] mt-4 rounded-md overflow-hidden border">
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

      <Sheet open={!!selectedStopDetail} onOpenChange={(isOpen) => !isOpen && setSelectedStopDetail(null)}>
        <SheetContent side="bottom" className="h-[75vh]">
          {selectedStopDetail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-center">Atstumas tarp stotelių</SheetTitle>
                <SheetDescription className="text-center flex items-center justify-center gap-2">
                   <span className="font-semibold">Išvykimas:</span>
                   <span>{selectedStopDetail.current.stop}</span>
                   <ArrowRight className="h-4 w-4 text-muted-foreground" />
                   <span className="font-semibold">Atvykimas:</span>
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
