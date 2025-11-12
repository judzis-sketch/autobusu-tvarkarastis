'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
  iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
  shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
});


interface AdminMapProps {
  coords?: { lat?: number; lng?: number };
  onCoordsChange: (lat: number, lng: number) => void;
  stopPositions: [number, number][];
  lastStopPosition: [number, number] | null;
}

// Custom hook to avoid re-initialization issues.
function useLeafletMap(mapRef: React.RefObject<HTMLDivElement>, props: AdminMapProps) {
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const lastStopMarkerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const stopMarkersRef = useRef<L.Marker[]>([]);

    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const greyIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    const defaultIcon = new L.Icon.Default();

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
    }, [mapRef, props.onCoordsChange]);

    // Effect to update the new stop marker (red)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const { coords } = props;
        if (coords && coords.lat && coords.lng) {
            const latLng: [number, number] = [coords.lat, coords.lng];
            if (markerRef.current) {
                markerRef.current.setLatLng(latLng);
            } else {
                markerRef.current = L.marker(latLng, { icon: redIcon }).addTo(map);
            }
            map.setView(latLng);
        } else {
            // If coords are cleared, remove the marker
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        }
    }, [props.coords, redIcon]);
    
    // Effect to update existing stops (grey) and polyline
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear previous stop markers
        stopMarkersRef.current.forEach(marker => marker.remove());
        stopMarkersRef.current = [];

        // Add new stop markers
        props.stopPositions.forEach(pos => {
            const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
            stopMarkersRef.current.push(stopMarker);
        });

        // Update polyline
        if (polylineRef.current) {
            polylineRef.current.setLatLngs(props.stopPositions);
        } else if (props.stopPositions.length > 1) {
            polylineRef.current = L.polyline(props.stopPositions, { color: 'grey' }).addTo(map);
        } else if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }

    }, [props.stopPositions, greyIcon]);

     // Effect to update the last stop marker (blue)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (lastStopMarkerRef.current) {
            lastStopMarkerRef.current.remove();
            lastStopMarkerRef.current = null;
        }

        if (props.lastStopPosition) {
             // Use default blue icon for the last stop
             lastStopMarkerRef.current = L.marker(props.lastStopPosition, { icon: defaultIcon }).addTo(map);
        }

    }, [props.lastStopPosition, defaultIcon]);

    return null;
}


export default function AdminMap(props: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  useLeafletMap(mapRef, props);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
