'use server';

import { LatLngTuple } from 'leaflet';

/**
 * Decodes a polyline string into an array of [latitude, longitude] coordinates.
 * @param str - The encoded polyline string.
 * @returns An array of coordinate pairs.
 */
function decodePolyline(str: string): LatLngTuple[] {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates: LatLngTuple[] = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change;

    const factor = Math.pow(10, 5); // OSRM uses precision 5

    while (index < str.length) {
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}


/**
 * Calculates the straight-line distance between two geographical coordinates using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in meters.
 */
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of the Earth in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}


/**
 * Fetches driving routes from OSRM. If OSRM fails, it returns a straight-line route as a fallback.
 * @param coordinates - An array of exactly two coordinates: [start, end].
 * @param alternatives - Whether to fetch alternative routes from OSRM.
 * @returns An array of route objects, each with distance and decoded geometry.
 */
export async function getRoute(
  coordinates: LatLngTuple[],
  alternatives = false
): Promise<{ distance: number; geometry: LatLngTuple[]; isFallback: boolean }[] | null> {

  if (coordinates.length < 2) {
    console.error("At least two coordinates are required to calculate a route.");
    return null;
  }
  
  const [start, end] = coordinates;
  const coordsString = `${start[1]},${start[0]};${end[1]},${end[0]}`;
  const radiuses = '50;50'; // Snap-to-road radius
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=polyline&alternatives=${alternatives}&radiuses=${radiuses}`;

  const createFallbackRoute = (): { distance: number; geometry: LatLngTuple[]; isFallback: boolean }[] => {
      const fallbackDistance = getHaversineDistance(start[0], start[1], end[0], end[1]);
      const fallbackGeometry: LatLngTuple[] = [start, end];
      console.warn('OSRM failed. Returning a straight-line fallback route.');
      return [{ distance: fallbackDistance, geometry: fallbackGeometry, isFallback: true }];
  };

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error(`OSRM API request failed or returned no routes. Status: ${response.status}`, data);
      return createFallbackRoute();
    }

    return data.routes.map((route: any) => ({
      distance: route.distance, // in meters
      geometry: decodePolyline(route.geometry),
      isFallback: false,
    }));

  } catch (error) {
    console.error('Error fetching route from OSRM:', error);
    return createFallbackRoute(); // Return fallback on network error etc.
  }
}
