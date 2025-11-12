'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { TimetableEntry } from '@/lib/types';

interface MapProps {
  stops: TimetableEntry[];
}

export default function Map({ stops }: MapProps) {
  // Calculate center of the map
  const bounds = stops.reduce((acc, stop) => {
    if (stop.coords) {
      acc.push(stop.coords);
    }
    return acc;
  }, [] as [number, number][]);

  const defaultCenter: [number, number] = [54.6872, 25.2797]; // Vilnius

  return (
    <MapContainer
      center={defaultCenter}
      bounds={bounds.length > 0 ? bounds : undefined}
      zoom={bounds.length > 0 ? undefined : 12}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {stops.map((stop) =>
        stop.coords ? (
          <Marker key={stop.id} position={stop.coords}>
            <Popup>
              <b>{stop.stop}</b>
              <br />
              Laikai: {stop.times.join(', ')}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
