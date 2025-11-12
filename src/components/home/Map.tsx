'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { TimetableEntry } from '@/lib/types';
import { useEffect, FC } from 'react';
import { Icon } from 'leaflet';

// This is a workaround for a bug in react-leaflet where the default icon path is not resolved correctly.
const DefaultIcon = new Icon({
    iconUrl: '/marker-icon.png',
    iconRetinaUrl: '/marker-icon-2x.png',
    shadowUrl: '/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapProps {
  stops: TimetableEntry[];
}

// Helper component to recenter the map when stops change
const ChangeView: FC<{ stops: TimetableEntry[] }> = ({ stops }) => {
  const map = useMap();
  useEffect(() => {
    if (stops && stops.length > 0) {
      const bounds = stops.filter(stop => stop.coords).map(stop => stop.coords as [number, number]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [stops, map]);
  return null;
};

export default function Map({ stops }: MapProps) {
  const stopsWithCoords = stops.filter(s => s.coords && Array.isArray(s.coords) && s.coords.length === 2);
  
  if (stopsWithCoords.length === 0) {
    return <div className="h-full w-full bg-muted flex items-center justify-center"><p>Šiam maršrutui nėra stotelių su koordinatėmis.</p></div>;
  }

  const initialCenter = stopsWithCoords[0].coords as [number, number];

  return (
    <MapContainer center={initialCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {stopsWithCoords.map((stop, index) => (
        <Marker key={stop.id || index} position={stop.coords as [number, number]} icon={DefaultIcon}>
          <Popup>
            <b>{stop.stop}</b><br />
            Laikai: {stop.times.join(', ')}
          </Popup>
        </Marker>
      ))}
      <ChangeView stops={stopsWithCoords} />
    </MapContainer>
  );
}
