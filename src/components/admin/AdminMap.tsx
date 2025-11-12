'use client';

import { memo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import type { Icon as LeafletIconType, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

let DefaultIcon: LeafletIconType;
// This needs to be in a try/catch for Next.js server-side rendering
try {
  const L = require('leaflet');
  DefaultIcon = new L.Icon({
      iconUrl: '/marker-icon.png',
      iconRetinaUrl: '/marker-icon-2x.png',
      shadowUrl: '/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  });
} catch (error) {
  // On the server, DefaultIcon will be undefined, but it's not used there.
}


function LocationMarker({ onCoordsChange, coords }: { onCoordsChange: (coords: [number, number]) => void; coords: [number, number] | null }) {
    const [position, setPosition] = useState<[number, number] | null>(coords);
    const map = useMap();

    useEffect(() => {
        // This effect updates the internal position and flies to it ONLY when the initial coords prop changes
        setPosition(coords);
        if (coords) {
          map.flyTo(coords, map.getZoom());
        }
    }, [coords]); // Intentionally dependent only on initial coords

    useMapEvents({
        click(e) {
            const newCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
            setPosition(newCoords);
            onCoordsChange(newCoords);
        },
    });

    return position === null ? null : (
        <Marker position={position} icon={DefaultIcon} />
    );
}

// Keep the component wrapped in memo for performance, but the internal logic is what matters.
const AdminMapComponent = ({ onCoordsChange, coords }: { onCoordsChange: (coords: [number, number]) => void, coords: [number, number] | null }) => {
  return (
    <MapContainer
      center={coords || [54.6872, 25.2797]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LocationMarker onCoordsChange={onCoordsChange} coords={coords} />
    </MapContainer>
  );
};

export const AdminMap = memo(AdminMapComponent);
