// address.ts
// Two lookups that connect addresses and map coordinates:
//   findAddress:  typed address -> map spot (used for uploaded photos)
//   addressNear:  map spot -> nearest address (used for camera photos)
// Phones use their built-in lookup (Apple's or Google's) first. The browser
// doesn't have one, so it uses OpenStreetMap's free service, which is also the
// backup if the phone's lookup fails.

import { Platform } from 'react-native';
import * as Location from 'expo-location';

type Coords = { latitude: number; longitude: number };
const OSM = 'https://nominatim.openstreetmap.org';

// Runs the phone lookup first (not in the browser), then OpenStreetMap.
// Returns null if both fail, for example with no internet.
async function tryBoth<T>(phone: () => Promise<T | null>, osm: () => Promise<T | null>): Promise<T | null> {
  if (Platform.OS !== 'web') {
    try {
      const result = await phone();
      if (result) return result;
    } catch {
      // fall through to the backup
    }
  }
  try {
    return await osm();
  } catch {
    return null;
  }
}

// Finds a typed address on the map so the report gets a pin.
// countrycodes=us keeps results inside the United States.
export function findAddress(address: string): Promise<Coords | null> {
  if (!address) return Promise.resolve(null);
  return tryBoth(
    async () => {
      const [hit] = await Location.geocodeAsync(address);
      return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
    },
    async () => {
      const res = await fetch(`${OSM}/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`);
      const [hit] = res.ok ? await res.json() : [];
      return hit ? { latitude: Number(hit.lat), longitude: Number(hit.lon) } : null;
    }
  );
}

// Builds "Near 120 Main St, Springfield". "Near" is on purpose: GPS is only
// accurate to a few meters, so it's the closest address, not the exact spot.
function format(number?: string | null, street?: string | null, city?: string | null) {
  const line = [number, street].filter(Boolean).join(' ');
  if (!line && !city) return null;
  return 'Near ' + [line, city].filter(Boolean).join(', ');
}

// Finds the closest street address to a spot, so a camera report says
// "Near 120 Main St" instead of just "Your location".
export function addressNear({ latitude, longitude }: Coords): Promise<string | null> {
  return tryBoth(
    async () => {
      const [p] = await Location.reverseGeocodeAsync({ latitude, longitude });
      return p ? format(p.streetNumber, p.street ?? p.name, p.city ?? p.subregion) : null;
    },
    async () => {
      const res = await fetch(`${OSM}/reverse?format=jsonv2&zoom=18&lat=${latitude}&lon=${longitude}`);
      const a = res.ok ? (await res.json()).address ?? {} : {};
      return format(a.house_number, a.road, a.city ?? a.town ?? a.village ?? a.hamlet);
    }
  );
}