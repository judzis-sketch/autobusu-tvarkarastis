'use client';

import { useEffect, useRef, useMemo } from 'react';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default icon paths using online URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type RouteOption = { distance: number; geometry: LatLngTuple[], isFallback?: boolean };

interface AdminMapProps {
  newStopCoords: LatLngTuple | null;
  onNewStopCoordsChange: (lat: number, lng: number) => void;
  stopPositions: LatLngTuple[];
  lastStopPosition: LatLngTuple | null;
  alternativeRoutes: RouteOption[];
  selectedRouteGeometry: LatLngTuple[] | null;
  onRouteSelect: (route: RouteOption) => void;
}

export default function AdminMap({
    newStopCoords,
    onNewStopCoordsChange,
    stopPositions,
    lastStopPosition,
    alternativeRoutes,
    selectedRouteGeometry,
    onRouteSelect,
}: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const newStopMarkerRef = useRef<L.Marker | null>(null);
  const lastStopMarkerRef = useRef<L.Marker | null>(null);
  const existingStopMarkersRef = useRef<L.Marker[]>([]);
  const routePolylinesRef = useRef<L.Polyline[]>([]);

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
        onNewStopCoordsChange(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [onNewStopCoordsChange]);

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

  // Update existing stops (grey)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    existingStopMarkersRef.current.forEach(marker => marker.remove());
    existingStopMarkersRef.current = [];

    stopPositions.forEach(pos => {
      const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
      existingStopMarkersRef.current.push(stopMarker);
    });
  }, [stopPositions, greyIcon]);

  // Update last stop marker (blue/default)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (lastStopMarkerRef.current) {
      lastStopMarkerRef.current.remove();
      lastStopMarkerRef.current = null;
    }

    if (lastStopPosition) {
      lastStopMarkerRef.current = L.marker(lastStopPosition, { icon: defaultIcon }).addTo(map);
    }
  }, [lastStopPosition, defaultIcon]);

  // Draw alternative routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
  
    // Clear previous polylines
    routePolylinesRef.current.forEach(p => p.remove());
    routePolylinesRef.current = [];
  
    if (alternativeRoutes.length > 0) {
      const allPoints = alternativeRoutes.flatMap(r => r.geometry);

      alternativeRoutes.forEach((route) => {
        // Compare geometries as arrays of numbers
        const isSelected = selectedRouteGeometry && 
                           JSON.stringify(selectedRouteGeometry) === JSON.stringify(route.geometry);
        
        const polyline = L.polyline(route.geometry, {
          color: isSelected ? 'blue' : 'gray',
          weight: isSelected ? 6 : 5,
          opacity: isSelected ? 0.9 : 0.7,
          dashArray: route.isFallback ? '5, 10' : undefined,
        }).addTo(map);
  
        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onRouteSelect(route);
        });
  
        polyline.bindTooltip(`Pasirinkti šį maršrutą (${(route.distance / 1000).toFixed(2)} km)`);
        routePolylinesRef.current.push(polyline);
      });
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
      }

    }
  }, [alternativeRoutes, selectedRouteGeometry, onRouteSelect]);
  

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
