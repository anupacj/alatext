import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RadarLocation {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export const RADAR_UPDATE_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
export const RADAR_EXPIRY_TTL_MS = 40 * 60 * 1000; // 40 minutes (2 pings)

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates compass bearing from point 1 to point 2 in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Formats a distance into a friendly couple-oriented string
 */
export function formatCoupleDistance(distKm: number | null): string {
  if (distKm === null || distKm === undefined || isNaN(distKm)) {
    return "Syncing distance...";
  }
  if (distKm < 0.05) {
    return "Together 💕 (< 50m)";
  }
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)}m away`;
  }
  if (distKm < 10) {
    return `${distKm.toFixed(1)} km away`;
  }
  return `${Math.round(distKm)} km away`;
}

/**
 * Formats data age for transparency
 */
export function formatDataAge(timestamp: number): string {
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 60) return "just now";
  const mins = Math.floor(elapsedSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

/**
 * Storage helpers with 40-minute TTL auto-purge
 */
export async function getStoredPartnerLocation(chatId: string): Promise<RadarLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_partner_loc_${chatId}`);
    if (!raw) return null;
    const parsed: RadarLocation = JSON.parse(raw);
    if (!parsed || !parsed.timestamp) return null;

    // Purge if older than 40 minutes (40m TTL)
    if (Date.now() - parsed.timestamp > RADAR_EXPIRY_TTL_MS) {
      await AsyncStorage.removeItem(`@couple_partner_loc_${chatId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePartnerLocation(chatId: string, loc: RadarLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(`@couple_partner_loc_${chatId}`, JSON.stringify(loc));
  } catch {}
}

export async function getStoredMyLocation(): Promise<RadarLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_my_loc`);
    if (!raw) return null;
    const parsed: RadarLocation = JSON.parse(raw);
    if (!parsed || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > RADAR_EXPIRY_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveMyLocation(loc: RadarLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(`@couple_my_loc`, JSON.stringify(loc));
  } catch {}
}

/**
 * Request device location safely
 */
export function getCurrentDeviceLocation(): Promise<RadarLocation | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000, // Accept cached position up to 10 mins
      }
    );
  });
}
