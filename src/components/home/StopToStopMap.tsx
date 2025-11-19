'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
  currentStop: TimetableEntry;
  nextStop: TimetableEntry;
  remainingStops: TimetableEntry[];
  showFullPath: boolean;
}

export default function StopToStopMap({ currentStop, nextStop, remainingStops, showFullPath }: StopToStopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    if (!map || !currentStop || !currentStop.coords) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    
    setIsLoading(true);

    const fromCoords = currentStop.coords as LatLngTuple;
    
    const fromArrivalTimes = currentStop.arrivalTimes || (currentStop as any).times || [];
    let fromPopupContent = `<b>Išvykimas: ${currentStop.stop}</b><br/>Atvyksta: ${fromArrivalTimes.join(', ')}`;
    if (currentStop.departureTimes && currentStop.departureTimes.length > 0) {
      fromPopupContent += `<br/>Išvyksta: ${currentStop.departureTimes.join(', ')}`;
    }

    const fromMarker = L.marker(fromCoords, { icon: greenIcon }).addTo(map);
    fromMarker.bindPopup(fromPopupContent).openPopup();
    layersRef.current.push(fromMarker);

    let bounds = L.latLngBounds([fromCoords]);
    
    if (showFullPath) {
        const fullPath: LatLngTuple[] = [];
        // Add all remaining stops as markers
        remainingStops.forEach(stop => {
            if (stop.coords) {
                const stopCoords = stop.coords as LatLngTuple;
                const marker = L.marker(stopCoords, { icon: redIcon }).addTo(map);
                const arrival = (stop.arrivalTimes || (stop as any).times || []).join(', ');
                marker.bindPopup(`<b>${stop.stop}</b><br/>Atvyksta: ${arrival}`);
                layersRef.current.push(marker);
                bounds.extend(stopCoords);
            }
        });
        
        // The path from current stop to next one
        if (currentStop.routeGeometry && currentStop.routeGeometry.length > 0) {
            fullPath.push(...currentStop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple));
        }

        // The paths between all subsequent remaining stops
        remainingStops.slice(0, -1).forEach(stop => {
            if (stop.routeGeometry && stop.routeGeometry.length > 0) {
                fullPath.push(...stop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple));
            }
        });

        if (fullPath.length > 0) {
            const routePolyline = L.polyline(fullPath, { color: 'blue', weight: 5 }).addTo(map);
            layersRef.current.push(routePolyline);
            if (routePolyline.getBounds().isValid()) {
                bounds.extend(routePolyline.getBounds());
            }
        }
    } else { // Show path only to the next stop
        if (!nextStop || !nextStop.coords) {
            setIsLoading(false);
            return;
        };

        const toCoords = nextStop.coords as LatLngTuple;

        const toArrivalTimes = nextStop.arrivalTimes || (nextStop as any).times || [];
        let toPopupContent = `<b>Atvykimas: ${nextStop.stop}</b><br/>Atvyksta: ${toArrivalTimes.join(', ')}`;
        if (nextStop.departureTimes && nextStop.departureTimes.length > 0) {
            toPopupContent += `<br/>Išvyksta: ${nextStop.departureTimes.join(', ')}`;
        }

        const toMarker = L.marker(toCoords, { icon: redIcon }).addTo(map);
        toMarker.bindPopup(toPopupContent);
        layersRef.current.push(toMarker);
        bounds.extend(toCoords);

        if (currentStop.routeGeometry && currentStop.routeGeometry.length > 0) {
            const leafletPath = currentStop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple);
            const routePolyline = L.polyline(leafletPath, { color: 'blue', weight: 5 }).addTo(map);
            layersRef.current.push(routePolyline);
            if (routePolyline.getBounds().isValid()) {
                bounds.extend(routePolyline.getBounds());
            }
        }
    }

    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    setIsLoading(false);

  }, [currentStop, nextStop, remainingStops, showFullPath, greenIcon, redIcon]);

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
