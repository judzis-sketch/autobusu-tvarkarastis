'use server';

export interface AddressResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: number;
  lon: number;
  display_name: string;
  address: {
    road?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
  boundingbox: [string, string, string, string];
}


/**
 * Searches for addresses in Lithuania using the Nominatim API.
 * @param query The search query string.
 * @returns A promise that resolves to an array of address results.
 */
export async function searchAddresses(query: string): Promise<AddressResult[]> {
  if (!query) {
    return [];
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.append('q', query);
  url.searchParams.append('format', 'json');
  url.searchParams.append('countrycodes', 'lt'); // Limit search to Lithuania
  url.searchParams.append('addressdetails', '1');
  url.searchParams.append('limit', '5'); // Limit to 5 results

  try {
    const response = await fetch(url.toString(), {
        headers: {
            'Accept-Language': 'lt,en;q=0.9' // Prefer Lithuanian results
        }
    });

    if (!response.ok) {
      console.error(`Nominatim API request failed with status: ${response.status}`);
      return [];
    }

    const data: AddressResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching addresses from Nominatim:', error);
    return [];
  }
}
