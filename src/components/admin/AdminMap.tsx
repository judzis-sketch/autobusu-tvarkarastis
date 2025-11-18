'use client';

import { useEffect, useRef, useMemo } from 'react';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default icon paths using online URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


interface AdminMapProps {
  coords?: { lat?: number; lng?: number };
  onCoordsChange: (lat: number, lng: number) => void;
  stopPositions: [number, number][];
  lastStopPosition: [number, number] | null;
  alternativeRoutes?: { distance: number; geometry: LatLngTuple[] }[];
  onRouteSelect?: (routeIndex: number) => void;
  waypoints: LatLngTuple[];
}

// Custom hook to avoid re-initialization issues.
function useLeafletMap(mapRef: React.RefObject<HTMLDivElement>, props: AdminMapProps) {
    const mapInstanceRef = useRef<L.Map | null>(null);
    const newStopMarkerRef = useRef<L.Marker | null>(null);
    const lastStopMarkerRef = useRef<L.Marker | null>(null);
    const existingStopMarkersRef = useRef<L.Marker[]>([]);
    const waypointMarkersRef = useRef<L.Marker[]>([]);
    const alternativePolylinesRef = useRef<L.Polyline[]>([]);

    const redIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);

    const blueIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);

    const greyIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);
    
    const defaultIcon = useMemo(() => new L.Icon.Default(), []);

    useEffect(() => {
        if (mapRef.current && !mapInstanceRef.current) {
            const map = L.map(mapRef.current).setView([55.7333, 26.2500], 13);
            mapInstanceRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

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
            if (newStopMarkerRef.current) {
                newStopMarkerRef.current.setLatLng(latLng);
            } else {
                newStopMarkerRef.current = L.marker(latLng, { icon: redIcon }).addTo(map);
            }
        } else {
            if (newStopMarkerRef.current) {
                newStopMarkerRef.current.remove();
                newStopMarkerRef.current = null;
            }
        }
    }, [props.coords, redIcon]);
    
    // Effect to update existing stops (grey)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        existingStopMarkersRef.current.forEach(marker => marker.remove());
        existingStopMarkersRef.current = [];

        const stopCoords = props.stopPositions.filter(Boolean) as LatLngTuple[];

        stopCoords.forEach(pos => {
            const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
            existingStopMarkersRef.current.push(stopMarker);
        });

    }, [props.stopPositions, greyIcon]);

     // Effect to update the last stop marker (blue icon from default leaflet)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (lastStopMarkerRef.current) {
            lastStopMarkerRef.current.remove();
            lastStopMarkerRef.current = null;
        }

        if (props.lastStopPosition) {
             lastStopMarkerRef.current = L.marker(props.lastStopPosition, { icon: defaultIcon }).addTo(map);
        }

    }, [props.lastStopPosition, defaultIcon]);

    // Effect for waypoints (blue markers)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        waypointMarkersRef.current.forEach(marker => marker.remove());
        waypointMarkersRef.current = [];

        props.waypoints.forEach(pos => {
            const waypointMarker = L.marker(pos, { icon: blueIcon }).addTo(map);
            waypointMarkersRef.current.push(waypointMarker);
        });
    }, [props.waypoints, blueIcon])
    
    // Effect to draw alternative routes
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
    
      alternativePolylinesRef.current.forEach(p => p.remove());
      alternativePolylinesRef.current = [];
    
      if (props.alternativeRoutes && props.alternativeRoutes.length > 0) {
        props.alternativeRoutes.forEach((route, index) => {
          const isPrimary = index === 0;
          const polyline = L.polyline(route.geometry, {
            color: isPrimary ? 'blue' : 'gray',
            weight: isPrimary ? 6 : 5,
            opacity: isPrimary ? 0.8 : 0.7,
          }).addTo(map);
    
          if (props.onRouteSelect) {
            polyline.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              props.onRouteSelect?.(index);
            });
            polyline.bindTooltip(`Pasirinkti šį maršrutą (${(route.distance / 1000).toFixed(2)} km)`);
          }
    
          alternativePolylinesRef.current.push(polyline);
        });
        
        const primaryRoute = alternativePolylinesRef.current[0];
        if (primaryRoute) {
            const bounds = primaryRoute.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, {padding: [50, 50]});
            }
        }

      } else if (props.lastStopPosition && props.coords?.lat && props.coords.lng) {
        // Fallback for when OSRM fails but we have start/end points
        const fallbackLine = L.polyline([props.lastStopPosition, [props.coords.lat, props.coords.lng]], {
            color: 'red',
            weight: 3,
            dashArray: '5, 10'
        }).addTo(map);
        alternativePolylinesRef.current.push(fallbackLine);
      }
    }, [props.alternativeRoutes, props.onRouteSelect, props.lastStopPosition, props.coords]);

    return null;
}


export default function AdminMap(props: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  useLeafletMap(mapRef, props);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
