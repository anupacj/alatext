import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";

export interface RadarLocation {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export const RADAR_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes periodic check
export const RADAR_EXPIRY_TTL_MS = Infinity; // NEVER expire - keep last known coordinates indefinitely

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    typeof lat1 !== "number" || isNaN(lat1) ||
    typeof lon1 !== "number" || isNaN(lon1) ||
    typeof lat2 !== "number" || isNaN(lat2) ||
    typeof lon2 !== "number" || isNaN(lon2)
  ) {
    return null as any;
  }
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
    return "";
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
  return `${Math.round(distKm).toLocaleString()} km away`;
}

/**
 * Formats data age for transparency
 */
export function formatDataAge(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return "";
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 60) return "just now";
  const mins = Math.floor(elapsedSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Storage helpers with persistent caching (no auto-purge on age)
 */
export async function getStoredPartnerLocation(chatId: string): Promise<RadarLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_partner_loc_${chatId}`);
    if (!raw) return null;
    const parsed: RadarLocation = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
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
    if (!parsed || !parsed.timestamp || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
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
 * Cloud persistence via Supabase app_settings:
 * Saves the user's location asynchronously so the partner can read it whenever they come online.
 */
export async function syncLocationToCloud(userId: string, loc: RadarLocation): Promise<void> {
  if (!userId || !loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
  try {
    await supabase.from("app_settings").upsert({
      key: `radar_user_${userId}`,
      value: {
        user_id: userId,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.timestamp || Date.now(),
        accuracy: loc.accuracy,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[coupleRadar] Error syncing location to cloud:", e);
  }
}

/**
 * Cloud retrieval via Supabase app_settings:
 * Fetches the partner's last recorded location from the cloud (persists indefinitely).
 */
export async function fetchPartnerLocationFromCloud(partnerId: string): Promise<RadarLocation | null> {
  if (!partnerId) return null;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", `radar_user_${partnerId}`)
      .maybeSingle();

    if (error || !data?.value) return null;
    const val = data.value;
    if (typeof val.lat === "number" && typeof val.lng === "number") {
      return {
        lat: val.lat,
        lng: val.lng,
        timestamp: typeof val.timestamp === "number" ? val.timestamp : Date.now(),
        accuracy: val.accuracy,
      };
    }
  } catch (e) {
    console.warn("[coupleRadar] Error fetching partner location from cloud:", e);
  }
  return null;
}

/**
 * Request device location safely with native GPS, browser geolocation & IP fallbacks
 */
export async function getCurrentDeviceLocation(): Promise<RadarLocation | null> {
  // 1. Native Android / iOS via expo-location
  if (Platform.OS !== "web") {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (pos && pos.coords) {
          const loc: RadarLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now(),
            accuracy: pos.coords.accuracy ?? undefined,
          };
          saveMyLocation(loc);
          return loc;
        }
      }
    } catch (e) {
      // Fall through to fallback
    }
  }

  // 2. Web browser navigator.geolocation
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const webLoc = await new Promise<RadarLocation | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: Date.now(),
              accuracy: pos.coords.accuracy,
            });
          },
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 }
        );
      });
      if (webLoc) {
        saveMyLocation(webLoc);
        return webLoc;
      }
    } catch {}
  }

  // 3. Fast lightweight IP geolocation fallbacks for Web
  try {
    const res = await fetch("https://ipwho.is/");
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.latitude === "number" && typeof data.longitude === "number") {
        const ipLoc: RadarLocation = {
          lat: data.latitude,
          lng: data.longitude,
          timestamp: Date.now(),
          accuracy: 5000,
        };
        saveMyLocation(ipLoc);
        return ipLoc;
      }
    }
  } catch {}

  try {
    const res = await fetch("https://freeipapi.com/api/json");
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.latitude === "number" && typeof data.longitude === "number") {
        const ipLoc: RadarLocation = {
          lat: data.latitude,
          lng: data.longitude,
          timestamp: Date.now(),
          accuracy: 5000,
        };
        saveMyLocation(ipLoc);
        return ipLoc;
      }
    }
  } catch {}

  // 4. Return cached location
  return await getStoredMyLocation();
}
