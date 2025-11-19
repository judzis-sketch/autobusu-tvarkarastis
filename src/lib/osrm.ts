'use server';

import type { LatLngTuple } from 'leaflet';

/**
 * Decodes a polyline string into an array of [latitude, longitude] coordinates.
 * @param str - The encoded polyline string from OSRM.
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
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        byte = null;
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
 * Fetches a driving route from OSRM by connecting a series of waypoints.
 * @param coordinates - An array of coordinates (waypoints) to connect.
 * @param alternatives - Whether to fetch alternative routes.
 * @returns An array of route objects, each with distance and decoded geometry, or an empty array on failure.
 */
export async function getRoute(
  coordinates: LatLngTuple[],
  alternatives = false
): Promise<{ distance: number; geometry: LatLngTuple[] }[]> {
  
  if (coordinates.length < 2) {
    console.error("At least two coordinates are required to calculate a route.");
    return [];
  }
  
  const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  const radiuses = coordinates.map(() => 50).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=polyline&alternatives=${alternatives}&radiuses=${radiuses}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OSRM API request failed with status: ${response.status}`, errorData);
      return []; // Return empty array on HTTP error
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM API did not return a valid route. Response:', data);
      return []; // Return empty array if OSRM response is not 'Ok'
    }

    // Map the received routes to the expected format
    return data.routes.map((route: any) => ({
      distance: route.distance, // in meters
      geometry: decodePolyline(route.geometry),
    }));

  } catch (error) {
    console.error('An error occurred while fetching the route from OSRM:', error);
    return []; // Return empty array on network or other exceptions
  }
}
