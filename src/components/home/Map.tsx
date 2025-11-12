'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { TimetableEntry } from '@/lib/types';
import { useEffect } from 'react';
import L from 'leaflet';

// Leaflet's default icon path issue with bundlers like Webpack/Vite/Turbopack
// This is a workaround to manually set the paths for the marker icons
// It can cause issues with some bundlers, but it's a common fix.
// If issues persist, consider hosting icons publicly or using a different icon solution.
try {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/marker-icon-2x.png',
    iconUrl: '/marker-icon.png',
    shadowUrl: '/marker-shadow.png',
  });
} catch (e) {
  console.error("Could not apply Leaflet icon fix", e);
}


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
      const bounds = new L.LatLngBounds(stops.map(s => s.coords));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
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
