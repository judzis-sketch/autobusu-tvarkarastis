'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AdminMapProps {
  coords?: { lat?: number; lng?: number };
  onCoordsChange: (lat: number, lng: number) => void;
  stopPositions: [number, number][];
}

// Custom hook to avoid re-initialization issues.
function useLeafletMap(mapRef: React.RefObject<HTMLDivElement>, props: AdminMapProps) {
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const stopMarkersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        if (mapRef.current && !mapInstanceRef.current) {
            // Create map instance ONLY if it doesn't exist
            const map = L.map(mapRef.current).setView([54.6872, 25.2797], 13);
            mapInstanceRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

            // Add click event handler
            map.on('click', (e) => {
                props.onCoordsChange(e.latlng.lat, e.latlng.lng);
            });
        }
    }, [mapRef, props.onCoordsChange]); // Only run when mapRef changes

    // Effect to update the new stop marker
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const { coords } = props;
        if (coords && coords.lat && coords.lng) {
            const latLng: [number, number] = [coords.lat, coords.lng];
            if (markerRef.current) {
                markerRef.current.setLatLng(latLng);
            } else {
                markerRef.current = L.marker(latLng).addTo(map);
            }
            map.setView(latLng);
        } else {
            // If coords are cleared, remove the marker
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        }
    }, [props.coords]);
    
    // Effect to update existing stops and polyline
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear previous stop markers
        stopMarkersRef.current.forEach(marker => marker.remove());
        stopMarkersRef.current = [];

        // Add new stop markers
        props.stopPositions.forEach(pos => {
            const stopMarker = L.marker(pos).addTo(map);
            stopMarkersRef.current.push(stopMarker);
        });

        // Update polyline
        if (polylineRef.current) {
            polylineRef.current.setLatLngs(props.stopPositions);
        } else if (props.stopPositions.length > 1) {
            polylineRef.current = L.polyline(props.stopPositions, { color: 'blue' }).addTo(map);
        } else if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }

    }, [props.stopPositions]);

    return null;
}


export default function AdminMap(props: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  useLeafletMap(mapRef, props);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
