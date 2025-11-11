'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { TimetableEntry } from '@/lib/types';

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
  const center: [number, number] = [54.6872, 25.2797]; // Vilnius center
  const stopsWithCoords = timetable.filter(s => s.coords && s.coords.length === 2);

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} className="rounded-lg z-0">
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
  );
}
