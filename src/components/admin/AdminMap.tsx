'use client';

import { useEffect, useRef, useMemo } from 'react';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TimetableEntry } from '@/lib/types';

// Fix for default icon paths using online URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface AdminMapProps {
  newStopCoords: LatLngTuple | null;
  onMapClick: (lat: number, lng: number) => void;
  existingStops: TimetableEntry[]; // Changed from stopPositions to pass full stop data
  lastStopPosition: LatLngTuple | null;
  manualRoutePoints: LatLngTuple[];
  calculatedRoute: { distance: number; geometry: LatLngTuple[] } | null;
}

export default function AdminMap({
    newStopCoords,
    onMapClick,
    existingStops,
    lastStopPosition,
    manualRoutePoints,
    calculatedRoute,
}: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const newStopMarkerRef = useRef<L.Marker | null>(null);
  const lastStopMarkerRef = useRef<L.Marker | null>(null);
  const existingStopMarkersRef = useRef<L.Marker[]>([]);
  const manualPointMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const existingRoutePolylinesRef = useRef<L.Polyline[]>([]);

  const redIcon = useMemo(() => new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  }), []);

  const greyIcon = useMemo(() => new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  }), []);

  const blueIcon = useMemo(() => new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  }), []);
  
  const orangeIcon = useMemo(() => new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  }), []);


  const defaultIcon = useMemo(() => new L.Icon.Default(), []);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([55.7333, 26.2500], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [onMapClick]);

  // Update new stop marker (red)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (newStopCoords) {
      if (newStopMarkerRef.current) {
        newStopMarkerRef.current.setLatLng(newStopCoords);
      } else {
        newStopMarkerRef.current = L.marker(newStopCoords, { icon: redIcon }).addTo(map);
      }
    } else {
      if (newStopMarkerRef.current) {
        newStopMarkerRef.current.remove();
        newStopMarkerRef.current = null;
      }
    }
  }, [newStopCoords, redIcon]);

  // Update existing stops (grey) and their route geometries (orange)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous layers
    existingStopMarkersRef.current.forEach(marker => marker.remove());
    existingStopMarkersRef.current = [];
    existingRoutePolylinesRef.current.forEach(polyline => polyline.remove());
    existingRoutePolylinesRef.current = [];

    const stopPositions = existingStops.map(s => s.coords).filter(Boolean) as LatLngTuple[];

    stopPositions.forEach(pos => {
      const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
      existingStopMarkersRef.current.push(stopMarker);
    });

    // Draw existing route geometries
    existingStops.forEach(stop => {
      if (stop.routeGeometry && stop.routeGeometry.length > 0) {
        const path = stop.routeGeometry.map(p => [p.lat, p.lng] as LatLngTuple);
        const polyline = L.polyline(path, { color: 'orange', weight: 3, opacity: 0.7 }).addTo(map);
        existingRoutePolylinesRef.current.push(polyline);
      }
    });

  }, [existingStops, greyIcon]);

  // Update last stop marker (default/black)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (lastStopMarkerRef.current) {
      lastStopMarkerRef.current.remove();
      lastStopMarkerRef.current = null;
    }

    if (lastStopPosition) {
      // Use orange icon for last stop for better visibility among other grey ones
      lastStopMarkerRef.current = L.marker(lastStopPosition, { icon: orangeIcon }).addTo(map);
    }
  }, [lastStopPosition, orangeIcon]);

  // Update manual waypoint markers (blue)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    manualPointMarkersRef.current.forEach(marker => marker.remove());
    manualPointMarkersRef.current = [];

    manualRoutePoints.forEach(pos => {
      const manualMarker = L.marker(pos, { icon: blueIcon }).addTo(map);
      manualPointMarkersRef.current.push(manualMarker);
    });
  }, [manualRoutePoints, blueIcon]);

  // Draw calculated route for the new segment (blue)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (calculatedRoute) {
      routePolylineRef.current = L.polyline(calculatedRoute.geometry, {
        color: 'blue',
        weight: 5,
        opacity: 0.8,
      }).addTo(map);
      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [calculatedRoute]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
