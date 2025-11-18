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
 * Fetches driving routes (distance and geometry) between multiple coordinates using the OSRM API.
 * @param coordinates - An array of coordinates [[lat, lng], [lat, lng], ...].
 * @param alternatives - Whether to fetch alternative routes.
 * @returns An array of route objects, each with distance and decoded geometry, or null if fails.
 */
export async function getRoute(
  coordinates: LatLngTuple[],
  alternatives = false
): Promise<{ distance: number; geometry: LatLngTuple[] }[] | null> {

  if (coordinates.length < 2) {
    console.error("At least two coordinates are required to calculate a route.");
    return null;
  }
  
  const coordsString = coordinates.map(coord => `${coord[1]},${coord[0]}`).join(';');
  // Increased snap-to-road radius to 50m to be more tolerant of inexact clicks
  const radiuses = coordinates.map(() => 50).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=polyline&alternatives=${alternatives}&radiuses=${radiuses}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`OSRM API request failed with status: ${response.status}`, data);
      return null;
    }

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes.map((route: any) => ({
        distance: route.distance, // in meters
        geometry: decodePolyline(route.geometry),
      }));
    } else {
      console.error('OSRM API did not return a valid route. Response:', data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching route from OSRM:', error);
    return null;
  }
}
