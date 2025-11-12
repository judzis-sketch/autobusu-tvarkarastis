'use client';

import { memo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import type { Icon as LeafletIconType } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// This needs to be in a try/catch for Next.js server-side rendering
try {
  const L = require('leaflet');
  L.Icon.Default.mergeOptions({
      iconUrl: '/marker-icon.png',
      iconRetinaUrl: '/marker-icon-2x.png',
      shadowUrl: '/marker-shadow.png',
  });
} catch (error) {
  // On the server, this will fail, but it's not needed there.
}


function LocationMarker({ onCoordsChange, coords }: { onCoordsChange: (coords: [number, number]) => void; coords: [number, number] | null }) {
    const [position, setPosition] = useState<[number, number] | null>(coords);
    const map = useMap();

    useEffect(() => {
        // This effect updates the internal position and flies to it ONLY when the coords prop changes
        // It also handles resetting the marker
        if (coords && (coords[0] !== position?.[0] || coords[1] !== position?.[1])) {
            setPosition(coords);
            map.flyTo(coords, map.getZoom());
        } else if (coords === null && position !== null) {
            setPosition(null);
        }
    }, [coords, map, position]);

    useMapEvents({
        click(e) {
            const newCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
            setPosition(newCoords);
            onCoordsChange(newCoords);
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
}

export default function AdminMap({ onCoordsChange, coords }: { onCoordsChange: (coords: [number, number]) => void, coords: [number, number] | null }) {
  // We use a key to force a full re-render of the map when coords are reset to null, avoiding initialization issues
  const mapKey = useMemo(() => coords ? 'map-active' : `map-reset-${Date.now()}`, [coords]);

  return (
    <MapContainer
      key={mapKey}
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
