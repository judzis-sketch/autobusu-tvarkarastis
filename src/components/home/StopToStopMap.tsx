'use client';

import { useEffect, useRef } from 'react';
import type { TimetableEntry } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface StopToStopMapProps {
  currentStop: TimetableEntry;
  nextStop: TimetableEntry;
}

export default function StopToStopMap({ currentStop, nextStop }: StopToStopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

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

    const stopPositions = [currentStop.coords, nextStop.coords].filter(Boolean) as [number, number][];

    if (stopPositions.length === 0) return;

    // Add markers
    const currentMarker = L.marker(stopPositions[0]).addTo(map);
    currentMarker.bindPopup(`<b>Išvykimas:</b><br/>${currentStop.stop}`).openPopup();
    markersRef.current.push(currentMarker);

    if (stopPositions.length > 1) {
        const nextMarker = L.marker(stopPositions[1]).addTo(map);
        nextMarker.bindPopup(`<b>Atvykimas:</b><br/>${nextStop.stop}`);
        markersRef.current.push(nextMarker);
    }
    
    // Add polyline
    if (stopPositions.length > 1) {
      polylineRef.current = L.polyline(stopPositions, { color: 'red' }).addTo(map);
    }
    
    // Fit bounds
    if (stopPositions.length > 0) {
      const bounds = L.latLngBounds(stopPositions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [currentStop, nextStop]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
