

'use client';

import { useState, useMemo, FormEvent, useCallback } from 'react';
import type { Route, TimetableEntry } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { DayOfWeek, DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { Clock, Loader2, MapPin, List, ArrowRight, Search, LocateFixed, X, Route as RouteIcon, ChevronLeft, ChevronRight, Watch, CalendarDays, Calendar as CalendarIcon, Map as MapIcon, Star } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/distance';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Calendar } from '../ui/calendar';
import 'react-day-picker/dist/style.css';
import { Separator } from '../ui/separator';
import { normalizeText } from '@/lib/utils';


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
  remaining: TimetableEntry[];
}

type NearbyStop = TimetableEntry & {
  routeId: string;
  routeName: string;
  routeNumber?: string;
  distance: number;
};

interface NearbyRouteGroup {
    stopName: string;
    distance: number;
    routes: {
      routeId: string;
      routeName: string;
      routeNumber?: string;
      arrivalTimes: string[];
      id: string; // This is the TimetableEntry ID
    }[];
}

interface SearchResults {
    foundRoutes: Route[];
    foundStops: NearbyRouteGroup[];
}

const dayNameToNumber: { [key: string]: number } = {
  "Sekmadienis": 0,
  "Pirmadienis": 1,
  "Antradienis": 2,
  "Trečiadienis": 3,
  "Ketvirtadienis": 4,
  "Penktadienis": 5,
  "Šeštadienis": 6,
};

const dayNumberToName: { [key: number]: string } = {
  0: "Sekmadienis",
  1: "Pirmadienis",
  2: "Antradienis",
  3: "Trečiadienis",
  4: "Ketvirtadienis",
  5: "Penktadienis",
  6: "Šeštadienis",
};


export default function TimetableClient() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStopDetail, setSelectedStopDetail] = useState<StopDetail | null>(null);
  const [showFullPath, setShowFullPath] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchDialogTitle, setSearchDialogTitle] = useState('Paieškos rezultatai');
  const [isRouteSelectedFromDropdown, setIsRouteSelectedFromDropdown] = useState(false);
  const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDateRoutesDialogOpen, setIsDateRoutesDialogOpen] = useState(false);
  const [dateSpecificRoutes, setDateSpecificRoutes] = useState<{ local: Route[]; longDistance: Route[] } | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();

  const routesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'routes'), orderBy('number', 'asc'));
  }, [firestore]);
  const { data: routes, isLoading: isLoadingRoutes } = useCollection<Route>(routesQuery);

  const localRoutes = useMemo(() => routes?.filter(r => r.type === 'Vietinio susisiekimo') || [], [routes]);
  const longDistanceRoutes = useMemo(() => routes?.filter(r => r.type === 'Tolimojo susisiekimo') || [], [routes]);


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
  
  const busStationImage = useMemo(() => PlaceHolderImages.find(p => p.id === 'bus-station'), []);

  const filteredTimetable = useMemo(() => {
    if (!timetable) return [];
    if (!activeSearch) return timetable;
    const normalizedSearch = normalizeText(activeSearch);
    return timetable.filter(stop =>
      normalizeText(stop.stop).includes(normalizedSearch)
    );
  }, [timetable, activeSearch]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && routes) {
        const selectedDayName = dayNumberToName[date.getDay()];
        if (!selectedDayName) return;

        const activeLocal = localRoutes.filter(route => route.days && route.days.includes(selectedDayName));
        const activeLongDistance = longDistanceRoutes.filter(route => route.days && route.days.includes(selectedDayName));

        setDateSpecificRoutes({ local: activeLocal, longDistance: activeLongDistance });
        setIsDateRoutesDialogOpen(true);
    } else {
        setDateSpecificRoutes(null);
    }
  };

  const handleRouteSelectFromDialog = (routeId: string) => {
    setSelectedRouteId(routeId);
    handleClearSearch();
    setIsRouteSelectedFromDropdown(true);
    setIsDateRoutesDialogOpen(false);
    setSearchResults(null);
  };


  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const searchTerm = searchInput.trim();
    if (!searchTerm) {
        setActiveSearch('');
        setHighlightedStopId(null);
        return;
    }

    // If a route is already selected, just filter stops within that route
    if (isRouteSelectedFromDropdown && selectedRouteId) {
        setActiveSearch(searchTerm);
        setHighlightedStopId(null); // Clear any previous highlight
        return;
    }

    // If no route is selected, perform a global search for routes and stops
    if (!firestore || !routes) {
        toast({ title: 'Klaida', description: 'Maršrutų sąrašas dar neužkrautas.', variant: 'destructive' });
        return;
    }

    setIsSearching(true);
    toast({ title: 'Vykdoma paieška...', description: `Ieškoma "${searchTerm}"...` });
    
    const normalizedSearch = normalizeText(searchTerm);
    
    // Search for routes
    const foundRoutes = routes.filter(route => 
        (normalizeText(route.name).includes(normalizedSearch)) || 
        (route.number && normalizeText(route.number).includes(normalizedSearch))
    );

    // Search for stops across all routes
    let allFoundStops: (TimetableEntry & { routeId: string; routeName: string; routeNumber?: string })[] = [];

    for (const route of routes) {
        if (!route.id) continue;
        const stopsQuery = query(collection(firestore, `routes/${route.id}/timetable`));
        const stopsSnapshot = await getDocs(stopsQuery);

        stopsSnapshot.forEach(doc => {
            const stopData = doc.data() as TimetableEntry;
            if (normalizeText(stopData.stop).includes(normalizedSearch)) {
                allFoundStops.push({
                    ...stopData,
                    id: doc.id,
                    routeId: route.id!,
                    routeName: route.name,
                    routeNumber: route.number,
                });
            }
        });
    }
    
    const groupedByStopName: { [key: string]: NearbyRouteGroup } = allFoundStops.reduce((acc, stop) => {
        const stopNameKey = normalizeText(stop.stop);
        if (!acc[stopNameKey]) {
            acc[stopNameKey] = {
                stopName: stop.stop,
                distance: -1, 
                routes: [],
            };
        }
        acc[stopNameKey].routes.push({
            routeId: stop.routeId,
            routeName: stop.routeName,
            routeNumber: stop.routeNumber,
            arrivalTimes: (stop.arrivalTimes || []),
            id: stop.id,
        });
        return acc;
    }, {} as { [key: string]: NearbyRouteGroup });
    
    const foundStops = Object.values(groupedByStopName);


    if (foundRoutes.length === 0 && foundStops.length === 0) {
        toast({
            title: 'Nieko nerasta',
            description: `Nepavyko rasti maršrutų ar stotelių, atitinkančių "${searchTerm}".`,
            variant: 'destructive',
        });
        setSearchResults(null);
    } else {
        toast({
            title: 'Paieškos rezultatai',
            description: `Rasta ${foundRoutes.length} maršrutų ir ${foundStops.length} stotelių.`
        })

        setSearchDialogTitle(`Paieškos "${searchTerm}" rezultatai`);
        setSearchResults({ foundRoutes, foundStops });
    }

    setIsSearching(false);
};

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setIsRouteSelectedFromDropdown(false);
    setHighlightedStopId(null);
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
          description: 'Ieškoma artimiausių stotelių...',
        });

        if (!firestore || !routes) {
          toast({ title: 'Klaida', description: 'Nepavyko gauti maršrutų sąrašo.', variant: 'destructive'});
          setIsFindingLocation(false);
          return;
        }

        let allStopsWithDistance: NearbyStop[] = [];
        
        for (const route of routes) {
          if (!route.id) continue;
          const stopsQuery = query(collection(firestore, `routes/${route.id}/timetable`), orderBy('createdAt', 'asc'));
          const stopsSnapshot = await getDocs(stopsQuery);
          stopsSnapshot.forEach(doc => {
            const stopData = doc.data() as TimetableEntry;
            if (stopData.coords) {
              const distance = getDistance(latitude, longitude, stopData.coords![0], stopData.coords![1]);
              allStopsWithDistance.push({
                  ...stopData,
                  id: doc.id,
                  routeId: route.id!,
                  routeName: route.name,
                  routeNumber: route.number,
                  distance: distance
              });
            }
          });
        }
        
        if (allStopsWithDistance.length === 0) {
            toast({ title: 'Nerasta stotelių', description: 'Sistemoje nerasta stotelių su koordinatėmis.', variant: 'destructive'});
            setIsFindingLocation(false);
            return;
        }

        allStopsWithDistance.sort((a, b) => a.distance - b.distance);
        
        const stopsGroupedByName: { [key: string]: NearbyStop[] } = allStopsWithDistance.reduce((acc, stop) => {
            const name = stop.stop.toLowerCase();
            if (!acc[name]) {
                acc[name] = [];
            }
            acc[name].push(stop);
            return acc;
        }, {} as { [key: string]: NearbyStop[] });

        const uniqueNearestStops = Object.values(stopsGroupedByName)
            .map(group => group.sort((a, b) => a.distance - b.distance)[0])
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);

        if(uniqueNearestStops.length === 0) {
            toast({ title: 'Nerasta stotelių', description: 'Nepavyko rasti artimiausių stotelių.', variant: 'destructive'});
            setIsFindingLocation(false);
            return;
        }

        const resultGroups: NearbyRouteGroup[] = uniqueNearestStops.map(stop => {
            const routesForThisStop = allStopsWithDistance
                .filter(s => s.stop.toLowerCase() === stop.stop.toLowerCase())
                .map(s => ({
                    routeId: s.routeId,
                    routeName: s.routeName,
                    routeNumber: s.routeNumber,
                    arrivalTimes: (s.arrivalTimes || []),
                    id: s.id,
                }));
            
            return {
                stopName: stop.stop,
                distance: stop.distance,
                routes: routesForThisStop
            };
        });
        
        toast({
          title: 'Stotelės rastos!',
          description: `Rastos ${resultGroups.length} artimiausios stotelės.`,
        });
        
        setSearchDialogTitle('Artimiausios stotelės');
        setSearchResults({ foundRoutes: [], foundStops: resultGroups });

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
  
  const handleSearchResultSelect = (routeId: string, stopId?: string, stopName?: string) => {
    setSelectedRouteId(routeId);
    if(stopName) {
      setSearchInput(stopName);
      setActiveSearch(stopName);
    } else {
       handleClearSearch();
    }

    if (stopId) {
       setHighlightedStopId(stopId); 
    }
    
    setSearchResults(null);
    setIsRouteSelectedFromDropdown(true); // Treat this as a selection to enable filtering within the route
    toast({
      title: 'Maršrutas parinktas',
      description: `Kraunamas pasirinktas maršrutas.`,
    });
  }


  const handleStopClick = useCallback((clickedStop: TimetableEntry) => {
    if (!timetable) return;
  
    const currentIndex = timetable.findIndex(s => s.id === clickedStop.id);
    const isLastStop = currentIndex === timetable.length - 1;
  
    if (isLastStop) {
      return;
    }
  
    const currentStop = timetable[currentIndex];
    const nextStop = timetable[currentIndex + 1];
    const remainingStops = timetable.slice(currentIndex + 1);
  
    if (currentStop.coords && nextStop && nextStop.coords) {
      setSelectedStopDetail({
        current: currentStop,
        next: nextStop,
        remaining: remainingStops,
      });
    } else {
      toast({
        title: "Trūksta duomenų",
        description: "Trūksta stotelės koordinačių duomenų, kad būtų galima atvaizduoti maršrutą.",
        variant: 'destructive'
      });
    }
  }, [timetable, toast]);

  const navigateStop = useCallback((direction: 'next' | 'prev') => {
    if (!selectedStopDetail || !timetable) return;
  
    const currentIndex = timetable.findIndex(s => s.id === selectedStopDetail.current.id);
  
    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex + 1;
    } else {
      newIndex = currentIndex - 1;
    }
  
    if (newIndex < 0 || newIndex >= timetable.length - 1) {
      return;
    }
  
    const newCurrentStop = timetable[newIndex];
    const newNextStop = timetable[newIndex + 1];
    const newRemainingStops = timetable.slice(newIndex + 1);
  
    if (newCurrentStop.coords && newNextStop.coords) {
      setSelectedStopDetail({
        current: newCurrentStop,
        next: newNextStop,
        remaining: newRemainingStops
      });
    } else {
       toast({
        title: "Navigacija negalima",
        description: "Sekanti arba ankstesnė atkarpa neturi reikalingų maršruto duomenų.",
        variant: "destructive"
      })
    }
  }, [selectedStopDetail, timetable, toast]);


  const calculateTravelTime = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined || distanceInMeters === null) return null;
    const averageSpeedKmh = 50;
    const distanceInKm = distanceInMeters / 1000;
    const timeHours = distanceInKm / averageSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    if (timeMinutes < 1) return "&lt; 1 min.";
    return `~ ${timeMinutes} min.`;
  }

  const isFirstStopInDialog = useMemo(() => {
    if (!selectedStopDetail || !timetable) return false;
    return timetable.findIndex(s => s.id === selectedStopDetail.current.id) === 0;
  }, [selectedStopDetail, timetable]);

  const isLastStopInDialog = useMemo(() => {
      if (!selectedStopDetail || !timetable) return false;
      return timetable.findIndex(s => s.id === selectedStopDetail.current.id) >= timetable.length - 2;
  }, [selectedStopDetail, timetable]);
  
  const finalDestination = useMemo(() => {
    if (!selectedStopDetail || showFullPath === false) return null;
    return selectedStopDetail.remaining[selectedStopDetail.remaining.length - 1];
  }, [selectedStopDetail, showFullPath]);

  const fullRemainingDistance = useMemo(() => {
    if (!selectedStopDetail || showFullPath === false) return null;
    
    // Distance from current to next
    let totalDistance = selectedStopDetail.current.distanceToNext || 0;
    
    // Sum of distances for the rest of the segments
    // The last stop in 'remaining' doesn't have a `distanceToNext`, so we slice it off.
    selectedStopDetail.remaining.slice(0, -1).forEach(stop => {
      totalDistance += stop.distanceToNext || 0;
    });

    return totalDistance;
  }, [selectedStopDetail, showFullPath]);


  if (isLoadingRoutes) {
    return (
      <div className="flex justify-center items-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderRouteList = (routesToList: Route[], type: string) => {
    if (routesToList.length === 0) {
      return <p className="text-sm text-muted-foreground px-4">Šio tipo maršrutų nėra.</p>;
    }
    return (
      <div className="flex flex-col gap-1">
        {routesToList.map((r) => (
          <Button
            key={r.id}
            variant={selectedRouteId === r.id ? 'default' : 'ghost'}
            className="w-full justify-start h-auto text-left"
            onClick={() => {
              setSelectedRouteId(r.id!);
              handleClearSearch();
              setIsRouteSelectedFromDropdown(true);
            }}
          >
            <div className="flex flex-col">
              <p className="font-semibold">
                <span className="font-bold mr-2">{r.number}</span> —{' '}
                <span>{r.name}</span>
              </p>
              {r.days && r.days.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.days.map(day => <Badge key={day} variant={selectedRouteId === r.id ? 'secondary' : 'outline'} className="text-xs">{day.slice(0,3)}</Badge>)}
                </div>
              )}
            </div>
          </Button>
        ))}
      </div>
    );
  };

    const renderRouteListInDialog = (routesToList: Route[], type: string) => {
    if (routesToList.length === 0) {
      return <p className="text-sm text-muted-foreground px-1 py-4 text-center">Šio tipo maršrutų nėra.</p>;
    }
    return (
      <div className="flex flex-col gap-1">
        {routesToList.map((r) => (
          <Button
            key={r.id}
            variant="ghost"
            className="w-full justify-start h-auto text-left"
            onClick={() => handleRouteSelectFromDialog(r.id!)}
          >
            <div className="flex flex-col">
              <p className="font-semibold">
                <span className="font-bold mr-2">{r.number}</span> —{' '}
                <span>{r.name}</span>
              </p>
            </div>
          </Button>
        ))}
      </div>
    );
  };


  return (
    <>
      <div className="flex flex-col gap-8">
        {busStationImage && (
          <div className="relative h-48 md:h-64 w-full rounded-xl overflow-hidden shadow-lg">
            <Image
              src={busStationImage.imageUrl}
              alt={busStationImage.description}
              fill
              className="object-cover"
              data-ai-hint={busStationImage.imageHint}
              priority
            />
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <Card>
              <CardHeader>
                  <CardTitle>Maršruto paieška</CardTitle>
                  <CardDescription>Raskite maršrutą pagal pavadinimą, stotelę, datą arba savo buvimo vietą.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Tabs defaultValue="stop" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                          <TabsTrigger value="stop"><Search className="h-4 w-4 mr-2" />Pagal pavadinimą</TabsTrigger>
                          <TabsTrigger value="date"><CalendarIcon className="h-4 w-4 mr-2" />Pagal datą</TabsTrigger>
                          <TabsTrigger value="location"><LocateFixed className="h-4 w-4 mr-2" />Pagal vietovę</TabsTrigger>
                          <TabsTrigger value="list"><List className="h-4 w-4 mr-2" />Sąrašas</TabsTrigger>
                      </TabsList>
                      <TabsContent value="stop" className="pt-4">
                          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="stop-search-input">Maršruto pavadinimas arba stotelė</Label>
                              <div className="relative flex-grow">
                                  <Input 
                                      id="stop-search-input"
                                      placeholder="pvz., Stotis arba 10G"
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
                          <Button type="submit" variant="secondary" disabled={isSearching}>
                              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="h-4 w-4 mr-2" />}
                              Ieškoti
                          </Button>
                          </form>
                      </TabsContent>
                      <TabsContent value="date" className="pt-4 flex flex-col items-center">
                          <Calendar
                              captionLayout="dropdown-buttons"
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 10}
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleDateSelect}
                              locale={lt}
                              weekStartsOn={1}
                              className="rounded-md border"
                              modifiers={{ weekend: { dayOfWeek: [6, 0] } }}
                              modifiersClassNames={{ weekend: 'day-weekend' }}
                          />
                          {selectedDate && (
                              <Button variant="outline" size="sm" onClick={() => setSelectedDate(undefined)} className="mt-4">
                                  <X className="h-4 w-4 mr-2" />
                                  Išvalyti datą
                              </Button>
                          )}
                      </TabsContent>
                      <TabsContent value="location" className="pt-4">
                          <div className="flex flex-col items-center gap-4 text-center">
                              <p className="text-sm text-muted-foreground">
                                  Leiskite mums nustatyti jūsų vietą ir parodyti artimiausias stoteles.
                              </p>
                              <Button 
                                  className="w-full" 
                                  variant="secondary" 
                                  onClick={handleFindNearestStop}
                                  disabled={isFindingLocation}
                              >
                                  {isFindingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/> }
                                  Naudoti mano lokaciją
                              </Button>
                          </div>
                      </TabsContent>
                      <TabsContent value="list" className="pt-4">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="local">
                            <AccordionTrigger>Vietinio susisiekimo maršrutai ({localRoutes.length})</AccordionTrigger>
                            <AccordionContent>
                              <ScrollArea className="h-60">
                                {renderRouteList(localRoutes, 'Vietinio susisiekimo')}
                              </ScrollArea>
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="long-distance">
                            <AccordionTrigger>Tolimojo susisiekimo maršrutai ({longDistanceRoutes.length})</AccordionTrigger>
                            <AccordionContent>
                              <ScrollArea className="h-60">
                                {renderRouteList(longDistanceRoutes, 'Tolimojo susisiekimo')}
                              </ScrollArea>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </TabsContent>
                  </Tabs>
              </CardContent>
          </Card>
        </div>


        {selectedRouteId && (
            <Tabs defaultValue="list">
              <Card className="flex-grow">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                      <div className="text-base font-semibold text-muted-foreground">Maršrutas</div>
                      <CardTitle className="text-3xl font-bold">
                        {selectedRoute?.number && <span className="mr-2">{selectedRoute.number}</span>}
                        {selectedRoute?.name}
                      </CardTitle>
                      {selectedRoute?.days && selectedRoute.days.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                           <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                            {selectedRoute.days.map(day => <Badge key={day} variant="secondary" className="text-xs">{day.slice(0,3)}</Badge>)}
                        </div>
                      )}
                    </div>
                    <TabsList className='w-full sm:w-auto'>
                      <TabsTrigger value="list" className='flex-1 sm:flex-initial'><List className="h-4 w-4 mr-2" />Sąrašas</TabsTrigger>
                      <TabsTrigger value="map" className='flex-1 sm:flex-initial' disabled={timetableWithCoords.length === 0}><MapPin className="h-4 w-4 mr-2" />Žemėlapis</TabsTrigger>
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
                             const canOpenMap = !isLastStop; // Any stop but the last can be clicked
                             const distanceToNext = s.distanceToNext;
                             const travelTime = calculateTravelTime(distanceToNext);
                             
                             return (
                              <div key={s.id || i} className="border-b pb-3 space-y-1">
                                 <Button 
                                  variant="link" 
                                  className="font-medium text-base flex items-center gap-2 p-0 h-auto text-foreground hover:no-underline"
                                  onClick={() => handleStopClick(s)}
                                  disabled={!canOpenMap}
                                 >
                                  <MapPin className={`h-4 w-4 ${s.coords ? (canOpenMap ? 'text-primary' : 'text-accent') : 'text-muted-foreground'}`} />
                                  <span className={canOpenMap ? 'hover:underline' : 'cursor-default'}>{s.stop}</span>
                                </Button>

                                <div className="flex items-center gap-2 pl-6">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">{(s.arrivalTimes || (s as any).times || []).join(', ')}</span>
                                    {s.departureTimes && s.departureTimes.length > 0 && JSON.stringify(s.departureTimes) !== JSON.stringify(s.arrivalTimes) && (
                                      <span className="text-muted-foreground/80"> (išv. {s.departureTimes.join(', ')})</span>
                                    )}
                                  </p>
                                </div>


                                {!isLastStop && distanceToNext !== undefined && distanceToNext !== null && travelTime && (
                                   <div className="text-sm text-muted-foreground flex items-center gap-2 ml-6">
                                     <RouteIcon className="h-3 w-3" />
                                     <span>Iki {filteredTimetable[i + 1]?.stop}</span>
                                     <ArrowRight className="h-3 w-3" />
                                     <span>{(distanceToNext / 1000).toFixed(2)} km</span>
                                     <span className="text-xs" dangerouslySetInnerHTML={{ __html: `(${travelTime})` }}></span>
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
                        <Map stops={timetableWithCoords} onStopClick={handleStopClick} highlightedStopId={highlightedStopId} />
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

      <Dialog open={!!selectedStopDetail} onOpenChange={(isOpen) => {if (!isOpen) setSelectedStopDetail(null)}}>
        <DialogContent className="max-w-4xl w-full h-screen p-4 flex flex-col">
          {selectedStopDetail && (
            <>
              <div className="flex-shrink-0 pt-1 pb-1">
                 <DialogHeader>
                    <DialogTitle>
                        {showFullPath ? 'Visas likęs maršrutas' : 'Maršruto atkarpa'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Žemėlapis, rodantis maršrutą nuo {selectedStopDetail.current.stop} iki {finalDestination ? finalDestination.stop : selectedStopDetail.next.stop}.
                    </DialogDescription>
                 </DialogHeader>
                <div className="text-center text-base flex items-center justify-center gap-2 py-1">
                    <span className="font-semibold">{selectedStopDetail.current.stop}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-semibold">{finalDestination ? finalDestination.stop : selectedStopDetail.next.stop}</span>
                </div>
                <div className="grid grid-cols-3 items-center text-center py-1">
                    <div className="text-left">
                        <p className="text-xs text-muted-foreground">Išvyksta</p>
                        <p className="font-bold text-lg">{((selectedStopDetail.current.departureTimes && selectedStopDetail.current.departureTimes.length > 0 ? selectedStopDetail.current.departureTimes : selectedStopDetail.current.arrivalTimes) || (selectedStopDetail.current as any).times || []).join(', ')}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center border-x">
                        <Watch className="h-5 w-5 text-primary" />
                        <p className="font-bold text-lg text-primary" dangerouslySetInnerHTML={{ __html: calculateTravelTime(showFullPath ? fullRemainingDistance : selectedStopDetail.current.distanceToNext) || '-' }}></p>
                        <p className="text-xs text-muted-foreground">
                          ({(((showFullPath ? fullRemainingDistance : selectedStopDetail.current.distanceToNext) || 0) / 1000).toFixed(2)} km)
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">Atvyksta</p>
                        <p className="font-bold text-lg">{((finalDestination ? finalDestination.arrivalTimes : selectedStopDetail.next.arrivalTimes) || (finalDestination || selectedStopDetail.next as any).times || []).join(', ')}</p>
                    </div>
                </div>
              </div>
              <div className="flex-grow min-h-0 mt-2 rounded-md overflow-hidden border">
                <StopToStopMap 
                    currentStop={selectedStopDetail.current}
                    nextStop={selectedStopDetail.next}
                    remainingStops={selectedStopDetail.remaining}
                    showFullPath={showFullPath}
                />
              </div>
              <div className="flex-shrink-0 pt-2">
                  <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between items-center pt-1">
                      <div className="flex items-center space-x-2">
                        <Switch id="full-path-switch" checked={showFullPath} onCheckedChange={setShowFullPath} />
                        <Label htmlFor="full-path-switch">Rodyti visą likusį maršrutą</Label>
                      </div>
                      <div className='flex gap-2'>
                        <Button variant="outline" onClick={() => navigateStop('prev')} disabled={isFirstStopInDialog}>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Ankstesnė
                        </Button>
                        <Button variant="outline" onClick={() => navigateStop('next')} disabled={isLastStopInDialog}>
                            Kita
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                  </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!searchResults} onOpenChange={() => setSearchResults(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{searchDialogTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="py-4 space-y-6">
              {searchResults?.foundRoutes && searchResults.foundRoutes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Rasti maršrutai ({searchResults.foundRoutes.length})</h3>
                  <div className="space-y-2">
                    {searchResults.foundRoutes.map(route => (
                      <Button key={route.id} variant="secondary" className="w-full h-auto justify-start text-left" onClick={() => handleSearchResultSelect(route.id!)}>
                        <div className="flex flex-col">
                            <p className="font-semibold">
                                {route.number && <span className="font-bold mr-2">{route.number}</span>}
                                {route.name}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {route.days.map(day => <Badge key={day} variant="outline" className="text-xs">{day.slice(0,3)}</Badge>)}
                            </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults?.foundRoutes.length > 0 && searchResults?.foundStops.length > 0 && <Separator />}

              {searchResults?.foundStops && searchResults.foundStops.length > 0 && (
                 <div>
                    <h3 className="text-lg font-semibold mb-3">Rastos stotelės ({searchResults.foundStops.length})</h3>
                    <div className="space-y-4">
                    {searchResults.foundStops.map((group) => (
                        <div key={group.stopName}>
                            <h4 className="font-semibold text-md mb-2">
                                {group.stopName}
                                {group.distance !== -1 && (
                                    <span className="text-sm text-muted-foreground font-normal ml-2">
                                        (už {(group.distance * 1000).toFixed(0)} m)
                                    </span>
                                )}
                            </h4>
                            <ul className="space-y-2 border-l pl-4 ml-1">
                                {group.routes.map((route) => (
                                <li key={route.routeId + route.id}>
                                    <Button 
                                    variant="outline" 
                                    className="w-full h-auto justify-start text-left" 
                                    onClick={() => handleSearchResultSelect(route.routeId, route.id, group.stopName)}
                                    >
                                    <div className="flex-grow">
                                        <p className="font-semibold">Maršrutas {route.routeNumber}: {route.routeName}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Atvyksta: {route.arrivalTimes.join(', ')}</span>
                                        </p>
                                    </div>
                                    </Button>
                                </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    </div>
                </div>
              )}

              {(!searchResults?.foundRoutes || searchResults.foundRoutes.length === 0) && (!searchResults?.foundStops || searchResults.foundStops.length === 0) && (
                 <p className="text-center text-muted-foreground">Nieko nerasta.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isDateRoutesDialogOpen} onOpenChange={setIsDateRoutesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Maršrutai, kursuojantys {selectedDate ? format(selectedDate, 'yyyy-MM-dd', { locale: lt }) : ''}
            </DialogTitle>
            <DialogDescription>
              Pasirinkite maršrutą, kad pamatytumėte jo tvarkaraštį.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            {dateSpecificRoutes && (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2 text-lg border-b pb-2">Vietinio susisiekimo maršrutai ({dateSpecificRoutes.local.length})</h3>
                        {renderRouteListInDialog(dateSpecificRoutes.local, 'Vietinio susisiekimo')}
                    </div>
                     <div>
                        <h3 className="font-semibold mb-2 text-lg border-b pb-2">Tolimojo susisiekimo maršrutai ({dateSpecificRoutes.longDistance.length})</h3>
                        {renderRouteListInDialog(dateSpecificRoutes.longDistance, 'Tolimojo susisiekimo')}
                    </div>
                </div>
            )}
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
