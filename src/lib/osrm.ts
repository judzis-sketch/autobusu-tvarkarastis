'use server';

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
