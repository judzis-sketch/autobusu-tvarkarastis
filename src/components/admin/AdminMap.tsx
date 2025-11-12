'use client';

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

interface AdminMapProps {
  coords?: { lat?: number; lng?: number };
  onCoordsChange: (lat: number, lng: number) => void;
}

function MapEvents({ onCoordsChange }: { onCoordsChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCoordsChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AdminMap({ coords, onCoordsChange }: AdminMapProps) {
  const position: [number, number] = coords && coords.lat && coords.lng ? [coords.lat, coords.lng] : [54.6872, 25.2797]; // Default to Vilnius

  return (
    <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {coords && coords.lat && coords.lng && (
        <Marker position={[coords.lat, coords.lng]} />
      )}
      <MapEvents onCoordsChange={onCoordsChange} />
    </MapContainer>
  );
}
