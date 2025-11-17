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
}

// Custom hook to avoid re-initialization issues.
function useLeafletMap(mapRef: React.RefObject<HTMLDivElement>, props: AdminMapProps) {
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const lastStopMarkerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const stopMarkersRef = useRef<L.Marker[]>([]);
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

        if (props.stopPositions.length === 0) {
            setIsRouteLoading(false);
            return;
        }

        // Add new stop markers
        props.stopPositions.forEach(pos => {
            const stopMarker = L.marker(pos, { icon: greyIcon }).addTo(map);
            stopMarkersRef.current.push(stopMarker);
        });

        // Fetch and draw route geometry for all stops
        const fetchFullRoute = async () => {
            setIsRouteLoading(true);
            try {
                // We create pairs of coordinates for each segment of the route
                const segments = [];
                for (let i = 0; i < props.stopPositions.length - 1; i++) {
                    segments.push([props.stopPositions[i], props.stopPositions[i+1]]);
                }
        
                // We fetch all segments in parallel
                const segmentRoutes = await Promise.all(
                    segments.map(segment => getRoute(segment[0], segment[1], false))
                );

                const allGeometries = segmentRoutes.map((routes, i) => {
                    if (routes && routes.length > 0) {
                        return routes[0].geometry;
                    }
                    // Fallback to straight line if a segment fails
                    return [segments[i][0], segments[i][1]] as LatLngTuple[];
                });

                const fullRoutePolyline = allGeometries.flat();
                if (fullRoutePolyline.length > 0) {
                    polylineRef.current = L.polyline(fullRoutePolyline, { color: 'grey' }).addTo(map);
                }
            } catch (error) {
                console.error("Failed to fetch full route:", error);
            } finally {
                setIsRouteLoading(false);
            }
        };
        
        if (props.stopPositions.length > 1) {
            fetchFullRoute();
        } else {
            setIsRouteLoading(false);
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
             lastStopMarkerRef.current = L.marker(props.lastStopPosition, { icon: defaultIcon }).addTo(map);
        }

    }, [props.lastStopPosition, defaultIcon]);
    
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
            weight: isPrimary ? 6 : 4,
            opacity: isPrimary ? 0.8 : 0.6,
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
