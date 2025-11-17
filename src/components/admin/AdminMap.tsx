'use client';

import { useEffect, useRef, useState } from 'react';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRoute } from '@/lib/osrm';

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
    const markerRef = useRef<L.Marker | null>(null);
    const lastStopMarkerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const stopMarkersRef = useRef<L.Marker[]>([]);
    const waypointMarkersRef = useRef<L.Marker[]>([]);
    const alternativePolylinesRef = useRef<L.Polyline[]>([]);
    const [isRouteLoading, setIsRouteLoading] = useState(false);

    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const blueIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
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
            const map = L.map(mapRef.current).setView([55.7333, 26.2500], 13);
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

        // Clear previous stop markers and polyline
        stopMarkersRef.current.forEach(marker => marker.remove());
        stopMarkersRef.current = [];
        if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }

        const stopCoords = props.stopPositions.filter(Boolean) as LatLngTuple[];

        if (stopCoords.length === 0) {
            setIsRouteLoading(false);
            return;
        }

        // Add new stop markers
        stopCoords.forEach(pos => {
            const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
            stopMarkersRef.current.push(stopMarker);
        });

        // Fetch and draw route geometry for all stops
        const fetchFullRoute = async () => {
            setIsRouteLoading(true);
            try {
                if (stopCoords.length < 2) return;
                
                const routes = await getRoute(stopCoords, false);

                if (routes && routes.length > 0) {
                    const allGeometries = routes[0].geometry;
                     if (allGeometries.length > 0) {
                        polylineRef.current = L.polyline(allGeometries, { color: 'grey', weight: 5, opacity: 0.7 }).addTo(map);
                    }
                }

            } catch (error) {
                console.error("Failed to fetch full route:", error);
            } finally {
                setIsRouteLoading(false);
            }
        };
        
        fetchFullRoute();

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

        // Clear previous waypoint markers
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
    
      // Clear previous alternative routes
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
              L.DomEvent.stopPropagation(e); // Prevent map click event
              props.onRouteSelect?.(index);
            });
            polyline.bindTooltip(`Pasirinkti šį maršrutą (${(route.distance / 1000).toFixed(2)} km)`);
          }
    
          alternativePolylinesRef.current.push(polyline);
        });
      }
    }, [props.alternativeRoutes, props.onRouteSelect]);


    return null;
}


export default function AdminMap(props: AdminMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  useLeafletMap(mapRef, props);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
