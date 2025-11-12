'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { TimetableEntry } from '@/lib/types';
import { useEffect } from 'react';

type StopWithCoords = TimetableEntry & { coords: [number, number] };

interface MapProps {
  stops: StopWithCoords[];
}

const defaultCenter: [number, number] = [54.6872, 25.2797]; // Vilnius center
const defaultZoom = 12;

// A component to automatically adjust map bounds
function ChangeView({ stops }: { stops: StopWithCoords[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length > 0) {
      map.fitBounds(stops.map(s => s.coords) as [number, number][], { padding: [50, 50] });
    } else {
      map.setView(defaultCenter, defaultZoom);
    }
  }, [stops, map]);
  return null;
}

export default function Map({ stops }: MapProps) {
  const latLngs = stops.map(s => s.coords);

  return (
    <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stops.map((stop, index) => (
        <Marker key={index} position={stop.coords}>
          <Popup>
            <div className="font-bold font-headline">{stop.stop}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              {(stop.times || []).join(', ')}
            </div>
          </Popup>
        </Marker>
      ))}
      {latLngs.length > 1 && <Polyline pathOptions={{ color: 'hsl(var(--primary))', weight: 4 }} positions={latLngs} />}
      <ChangeView stops={stops} />
    </MapContainer>
  );
}