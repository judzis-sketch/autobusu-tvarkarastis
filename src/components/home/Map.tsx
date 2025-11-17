'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRoute } from '@/lib/osrm';
import { Loader2 } from 'lucide-react';

// Fix for default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


interface MapProps {
  stops: TimetableEntry[];
}

export default function Map({ stops }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    const stopPositionsWithData = stops.filter(s => s.coords) as (TimetableEntry & { coords: [number, number] })[];
    
    if (stopPositionsWithData.length === 0) {
      setIsLoading(false);
      return;
    }

    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Add markers
    stopPositionsWithData.forEach((stop) => {
      const marker = L.marker(stop.coords, { icon: redIcon }).addTo(map);
      marker.bindPopup(`<b>${stop.stop}</b><br/>Laikai: ${stop.times.join(', ')}`);
      layersRef.current.push(marker);
    });

    // Fit map to markers
    const bounds = L.latLngBounds(stopPositionsWithData.map(s => s.coords));
    if (stopPositionsWithData.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    

    // Function to fetch all route segments
    const fetchAllRouteSegments = async () => {
      const allGeometries: [number, number][][] = [];

      for (let i = 0; i < stopPositionsWithData.length - 1; i++) {
        const start = stopPositionsWithData[i];
        const end = stopPositionsWithData[i + 1];
        
        try {
          const routes = await getRoute(start.coords, end.coords, false);
          if (routes && routes.length > 0) {
            const primaryRoute = routes[0];
            allGeometries.push(primaryRoute.geometry);
          } else {
            // Fallback for this segment
             allGeometries.push([start.coords, end.coords]);
          }
        } catch (error) {
            console.error(`Failed to fetch route segment ${i}:`, error);
            // Fallback for this segment
            allGeometries.push([start.coords, end.coords]);
        }
      }
      
      const fullRoutePolyline = allGeometries.flat();
      const polyline = L.polyline(fullRoutePolyline, { color: 'blue' }).addTo(map);
      layersRef.current.push(polyline);
      
      // Re-fit bounds to include the entire route polyline
      if (polyline.getBounds().isValid()) {
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }

      setIsLoading(false);
    };

    if (stopPositionsWithData.length > 1) {
      fetchAllRouteSegments();
    } else {
      setIsLoading(false);
    }

    return () => {
        if(mapRef.current) { // Prevent cleanup on unmount if component is being fast-refreshed
            layersRef.current.forEach(layer => layer.remove());
            layersRef.current = [];
        }
    }

  }, [stops]);

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
