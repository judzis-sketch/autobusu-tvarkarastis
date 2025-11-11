'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { TimetableEntry } from '@/lib/types';
import { useEffect } from 'react';

// This is to fix the missing icon issue with react-leaflet
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


type StopsWithCoords = (TimetableEntry & { coords: [number, number] })[];

type MapProps = {
  stops: StopsWithCoords;
};

function Markers({ stops }: { stops: StopsWithCoords }) {
  const map = useMap();

  useEffect(() => {
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add new markers
    stops.forEach((s) => {
      const popupContent = `
        <div class="font-bold font-headline">${s.stop}</div>
        <div class="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          ${(s.times || []).join(', ')}
        </div>
      `;
      L.marker(s.coords).addTo(map).bindPopup(popupContent);
    });

    if (stops.length > 0) {
      const bounds = new L.LatLngBounds(stops.map(s => s.coords));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      map.setView([54.6872, 25.2797], 12); // Reset to default view if no stops
    }
  }, [stops, map]);

  return null; // This component only handles logic, not rendering
}

export default function Map({ stops }: MapProps) {
  const center: [number, number] = [54.6872, 25.2797]; // Vilnius center

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} className="rounded-lg z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Markers stops={stops} />
    </MapContainer>
  );
}
