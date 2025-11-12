'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from 'react-leaflet';

interface AdminMapProps {
  coords?: { lat?: number; lng?: number };
  onCoordsChange: (lat: number, lng: number) => void;
  stopPositions: [number, number][];
}

function MapEvents({ onCoordsChange }: { onCoordsChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCoordsChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AdminMap({ coords, onCoordsChange, stopPositions }: AdminMapProps) {
  const position: [number, number] = coords && coords.lat && coords.lng ? [coords.lat, coords.lng] : [54.6872, 25.2797]; // Default to Vilnius
  
  // Using a key that changes with position will force React to re-create the component
  // instead of re-rendering it, avoiding the "Map container is already initialized" error.
  const mapKey = `${position[0]}-${position[1]}`;


  return (
    <MapContainer key={mapKey} center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {/* Show existing stops */}
      {stopPositions.map((pos, index) => (
          <Marker key={`stop-${index}`} position={pos}></Marker>
      ))}

      {/* Show line between existing stops */}
      {stopPositions.length > 1 && (
        <Polyline positions={stopPositions} color="blue" />
      )}

      {/* Show marker for new stop being added */}
      {coords && coords.lat && coords.lng && (
        <Marker position={[coords.lat, coords.lng]} />
      )}
      
      <MapEvents onCoordsChange={onCoordsChange} />
    </MapContainer>
  );
}
