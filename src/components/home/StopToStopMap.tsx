'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRoute } from '@/lib/osrm';
import { Loader2 } from 'lucide-react';

interface StopToStopMapProps {
  currentStop: TimetableEntry;
  nextStop: TimetableEntry;
}

export default function StopToStopMap({ currentStop, nextStop }: StopToStopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const defaultCenter: [number, number] = currentStop.coords || [54.6872, 25.2797];
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
    if (!map) return;

    // Clear existing layers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    
    setIsLoadingRoute(true);

    const stopPositions = [currentStop.coords, nextStop.coords].filter(Boolean) as [number, number][];

    if (stopPositions.length < 2) {
        setIsLoadingRoute(false);
        return;
    }

    // Add markers
    const currentMarker = L.marker(stopPositions[0]).addTo(map);
    currentMarker.bindPopup(`<b>Išvykimas:</b><br/>${currentStop.stop}`).openPopup();
    markersRef.current.push(currentMarker);

    const nextMarker = L.marker(stopPositions[1]).addTo(map);
    nextMarker.bindPopup(`<b>Atvykimas:</b><br/>${nextStop.stop}`);
    markersRef.current.push(nextMarker);
    
    // Fit bounds to markers initially
    const bounds = L.latLngBounds(stopPositions);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Fetch and draw route geometry
    const fetchAndDrawRoute = async () => {
        try {
            const route = await getRoute(stopPositions[0], stopPositions[1]);
            if (route && route.geometry && route.geometry.length > 0) {
                 if (polylineRef.current) {
                    polylineRef.current.remove();
                }
                polylineRef.current = L.polyline(route.geometry, { color: 'red' }).addTo(map);
                
                // Fit bounds to the route geometry
                const routeBounds = polylineRef.current.getBounds();
                map.fitBounds(routeBounds, { padding: [50, 50] });
            }
        } catch (error) {
            console.error("Failed to fetch route geometry:", error);
            // Fallback to a straight line on error
            if (polylineRef.current) {
                polylineRef.current.remove();
            }
            polylineRef.current = L.polyline(stopPositions, { color: 'red', dashArray: '5, 5' }).addTo(map);
        } finally {
            setIsLoadingRoute(false);
        }
    };

    fetchAndDrawRoute();

  }, [currentStop, nextStop]);

  return (
    <div className="relative h-full w-full">
        {isLoadingRoute && (
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
