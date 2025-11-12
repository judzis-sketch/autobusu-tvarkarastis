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
        // Reset shift and result for each coordinate part
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
 * Calculates the driving distance between two coordinates using the OSRM API.
 * @param startCoords - The starting coordinates [latitude, longitude].
 * @param endCoords - The ending coordinates [latitude, longitude].
 * @returns The distance in meters, or null if the request fails.
 */
export async function getRouteDistance(
  startCoords: [number, number],
  endCoords: [number, number]
): Promise<number | null> {
  const [startLat, startLng] = startCoords;
  const [endLat, endLng] = endCoords;

  // OSRM expects coordinates in {longitude},{latitude} format
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`OSRM API request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // The distance is provided in meters
      return data.routes[0].distance;
    } else {
      console.error('OSRM API did not return a valid route.', data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching route distance from OSRM:', error);
    return null;
  }
}

/**
 * Fetches the driving route (distance and geometry) between two coordinates using the OSRM API.
 * @param startCoords - The starting coordinates [latitude, longitude].
 * @param endCoords - The ending coordinates [latitude, longitude].
 * @returns An object with distance (meters) and decoded geometry, or null if fails.
 */
export async function getRoute(
  startCoords: [number, number],
  endCoords: [number, number]
): Promise<{ distance: number; geometry: LatLngTuple[] } | null> {
  const [startLat, startLng] = startCoords;
  const [endLat, endLng] = endCoords;

  // Request full overview to get the geometry
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`OSRM API request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const decodedGeometry = decodePolyline(route.geometry);
      return {
        distance: route.distance, // in meters
        geometry: decodedGeometry,
      };
    } else {
      console.error('OSRM API did not return a valid route with geometry.', data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching route from OSRM:', error);
    return null;
  }
}
