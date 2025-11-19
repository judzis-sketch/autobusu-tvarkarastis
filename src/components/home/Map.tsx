'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';


// Fix for default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});


interface MapProps {
  stops: TimetableEntry[];
  onStopClick: (stop: TimetableEntry) => void;
  highlightedStopId?: string | null;
}

export default function Map({ stops, onStopClick, highlightedStopId }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  const redIcon = useMemo(() => new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  }), []);

  const greenIcon = useMemo(() => new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), []);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const defaultCenter: [number, number] = [55.7333, 26.2500]; // Zarasai
      const map = L.map(mapRef.current).setView(defaultCenter, 12);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
    }
  }, []);

  // Update markers, polyline and bounds when stops change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !stops) return;

    // Clear existing layers
    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    
    setIsLoading(true);

    const stopPositionsWithData = stops.filter(s => s.coords) as (TimetableEntry & { id: string, coords: [number, number] })[];
    
    if (stopPositionsWithData.length === 0) {
      setIsLoading(false);
      return;
    }

    // Add markers for each stop
    stopPositionsWithData.forEach((stop, index) => {
      const isLastStop = index === stopPositionsWithData.length - 1;
      const isHighlighted = stop.id === highlightedStopId;
      const marker = L.marker(stop.coords, { icon: isHighlighted ? greenIcon : redIcon }).addTo(map);
      
      const arrivalTimes = (stop.arrivalTimes || (stop as any).times || []).join(', ');
      const departureTimes = (stop.departureTimes && stop.departureTimes.length > 0) 
        ? stop.departureTimes.join(', ') 
        : arrivalTimes;

      const popupContent = `<b>${stop.stop}</b><br/>Atvyksta: ${arrivalTimes}<br/>Išvyksta: ${departureTimes}`;
      marker.bindPopup(popupContent);

      // Show popup on hover for desktop, but not mobile to avoid interfering with click
      if (!isMobile) {
        marker.on('mouseover', () => {
          marker.openPopup();
        });
        marker.on('mouseout', () => {
          marker.closePopup();
        });
      }
      
      // Open dialog on click
      marker.on('click', () => {
        if (!isLastStop) {
          onStopClick(stop);
        } else {
            // On mobile, click should still show the popup for the last stop
            if (isMobile) {
                marker.openPopup();
            }
        }
      });

      layersRef.current.push(marker);
    });

    // Collect all stored route geometries from each stop to form the full path
    const fullRoutePath: LatLngTuple[] = [];
    
    stops.forEach((stop) => {
        // The geometry to the *next* stop is stored on the *current* stop object.
        if (stop.routeGeometry && stop.routeGeometry.length > 0) {
            const segmentPath = stop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple);
            fullRoutePath.push(...segmentPath);
        }
    });

    // If there are any admin-defined geometries, draw them as a single continuous line.
    if (fullRoutePath.length > 1) {
        const polyline = L.polyline(fullRoutePath, { color: 'blue', weight: 5 }).addTo(map);
        layersRef.current.push(polyline);
        if (polyline.getBounds().isValid()) {
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        }
    } else if (stopPositionsWithData.length > 0) {
        // If there's no path at all (only fallbacks or single stop), just fit to the stops
        const bounds = L.latLngBounds(stopPositionsWithData.map(s => s.coords));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    setIsLoading(false);

    return () => {
        if(mapRef.current) { // Prevent cleanup on unmount if component is being fast-refreshed
            layersRef.current.forEach(layer => layer.remove());
            layersRef.current = [];
        }
    }

  }, [stops, onStopClick, isMobile, highlightedStopId, redIcon, greenIcon]);

  return (
     <div className="relative h-full w-full">
        {isLoading && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
                 <div className="flex items-center gap-2 rounded-md bg-background p-3 shadow-md">
                     <Loader2 className="h-5 w-5 animate-spin text-primary" />
                     <span className="text-muted-foreground">Kraunami keliai...</span>
                 </div>
             </div>
        )}
        <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 5 }} />
    </div>
  );
}
