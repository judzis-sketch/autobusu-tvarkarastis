'use client';

import { useEffect, useRef } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  stops: TimetableEntry[];
}

export default function Map({ stops }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

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
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const stopPositions = stops.map(s => s.coords).filter(Boolean) as [number, number][];

    // Add markers
    stops.forEach((stop) => {
      if (stop.coords) {
        const marker = L.marker(stop.coords).addTo(map);
        marker.bindPopup(`<b>${stop.stop}</b><br/>Laikai: ${stop.times.join(', ')}`);
        markersRef.current.push(marker);
      }
    });

    // Add polyline
    if (stopPositions.length > 1) {
      polylineRef.current = L.polyline(stopPositions, { color: 'blue' }).addTo(map);
    }
    
    // Fit bounds
    if (stopPositions.length > 0) {
      const bounds = L.latLngBounds(stopPositions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [stops]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
