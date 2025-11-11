'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { TimetableEntry } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';

// Fix for default marker icon not appearing in Next.js
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

type MapProps = {
  timetable: TimetableEntry[];
};

export default function Map({ timetable }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // When the component mounts, we set the map to be ready.
    // The key on MapContainer will ensure it re-mounts if the ref changes,
    // which shouldn't happen, but this is a safeguard.
    if (mapRef.current && !mapReady) {
      setMapReady(true);
    }
  }, [mapReady]);


  const center: [number, number] = [54.6872, 25.2797]; // Vilnius center
  const stopsWithCoords = timetable.filter(s => s.coords && s.coords.length === 2);

  // We use a placeholder div that will be replaced by the map once it's ready.
  // This helps prevent Leaflet from trying to initialize a container that's already in use.
  return (
    <div ref={mapRef} className="h-full w-full rounded-lg z-0" key={mapRef.current ? 'map-ready' : 'map-loading'}>
      {mapReady && (
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stopsWithCoords.map((s, i) => (
            <Marker key={i} position={s.coords as [number, number]}>
              <Popup>
                <div className="font-bold font-headline">{s.stop}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  {(s.times || []).join(', ')}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
