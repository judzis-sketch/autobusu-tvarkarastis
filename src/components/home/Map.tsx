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
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
  iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
  shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
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
      const defaultCenter: [number, number] = [54.6872, 25.2797]; // Vilnius
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
    map.fitBounds(bounds, { padding: [50, 50] });

    // Function to fetch all route segments
    const fetchAllRouteSegments = async () => {
      const routePromises = [];
      for (let i = 0; i < stopPositionsWithData.length - 1; i++) {
        const start = stopPositionsWithData[i];
        const end = stopPositionsWithData[i + 1];
        routePromises.push(getRoute(start.coords, end.coords));
      }
      
      const settledResults = await Promise.allSettled(routePromises);
      
      const allGeometries: [number, number][][] = [];

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.geometry) {
           const polyline = L.polyline(result.value.geometry, { color: 'blue' }).addTo(map);
           layersRef.current.push(polyline);
           allGeometries.push(result.value.geometry);
        } else {
          // Fallback to straight line on error
          const start = stopPositionsWithData[index];
          const end = stopPositionsWithData[index + 1];
          const polyline = L.polyline([start.coords, end.coords], { color: 'blue', dashArray: '5, 5' }).addTo(map);
          layersRef.current.push(polyline);
          console.error(`Failed to fetch route segment ${index}:`, result.status === 'rejected' ? result.reason : 'No geometry');
        }
      });
      
      // Re-fit bounds to include all new polylines
      if (allGeometries.length > 0) {
        const combinedBounds = stopPositionsWithData.reduce((bounds, stop) => {
            return bounds.extend(stop.coords);
        }, new L.LatLngBounds());
        
        allGeometries.flat().forEach(coord => {
            combinedBounds.extend(coord as L.LatLngExpression);
        });

        if (combinedBounds.isValid()) {
             map.fitBounds(combinedBounds, { padding: [50, 50] });
        }
      }

      setIsLoading(false);
    };

    if (stopPositionsWithData.length > 1) {
      fetchAllRouteSegments();
    } else {
      setIsLoading(false);
    }

    return () => {
        layersRef.current.forEach(layer => layer.remove());
        layersRef.current = [];
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
