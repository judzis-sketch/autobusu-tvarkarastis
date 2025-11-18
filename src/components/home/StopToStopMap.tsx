'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';

// Fix for default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});


interface StopToStopMapProps {
  previousStop: TimetableEntry; // The "from" stop
  currentStop: TimetableEntry;    // The "to" stop, which contains the geometry
}

export default function StopToStopMap({ previousStop, currentStop }: StopToStopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const defaultCenter: LatLngTuple = (currentStop.coords as LatLngTuple) || [55.7333, 26.2500];
      const map = L.map(mapRef.current).setView(defaultCenter, 14);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
    }
  }, [currentStop.coords]);

  // Update markers, polyline and bounds when stops change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentStop || !previousStop || !currentStop.coords || !previousStop.coords) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    
    setIsLoading(true);

    const previousCoords = previousStop.coords as LatLngTuple;
    const currentCoords = currentStop.coords as LatLngTuple;
    
    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const previousMarker = L.marker(previousCoords, { icon: redIcon }).addTo(map);
    previousMarker.bindPopup(`<b>Išvykimas: ${previousStop.stop}</b><br/>Laikai: ${previousStop.times.join(', ')}`).openPopup();
    layersRef.current.push(previousMarker);

    const currentMarker = L.marker(currentCoords, { icon: redIcon }).addTo(map);
    currentMarker.bindPopup(`<b>Atvykimas: ${currentStop.stop}</b><br/>Laikai: ${currentStop.times.join(', ')}`);
    layersRef.current.push(currentMarker);
    
    let bounds = L.latLngBounds([previousCoords, currentCoords]);

    // The route geometry FROM the previous stop TO the current stop is stored on the CURRENT stop object.
    if (currentStop.routeGeometry && currentStop.routeGeometry.length > 0) {
      const leafletPath = currentStop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple);
      const routePolyline = L.polyline(leafletPath, { color: 'blue', weight: 5 }).addTo(map);
      layersRef.current.push(routePolyline);
      if (routePolyline.getBounds().isValid()) {
        bounds.extend(routePolyline.getBounds());
      }
    }

    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    setIsLoading(false);

  }, [currentStop, previousStop]);

  return (
    <div className="relative h-full w-full">
        {isLoading && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
                 <div className="flex items-center gap-2 rounded-md bg-background p-3 shadow-md">
                     <Loader2 className="h-5 w-5 animate-spin text-primary" />
                     <span className="text-muted-foreground">Kraunamas maršrutas...</span>
                 </div>
             </div>
        )}
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
    );
}
