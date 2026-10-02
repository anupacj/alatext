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

export const RADAR_UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes background check
export const RADAR_EXPIRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL for couple location

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
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Storage helpers with 24-hour TTL caching
 */
export async function getStoredPartnerLocation(chatId: string): Promise<RadarLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_partner_loc_${chatId}`);
    if (!raw) return null;
    const parsed: RadarLocation = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;

    // Discard if older than 24h
    if (Date.now() - parsed.timestamp > RADAR_EXPIRY_TTL_MS) {
      await AsyncStorage.removeItem(`@couple_partner_loc_${chatId}`).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePartnerLocation(chatId: string, loc: RadarLocation): Promise<void> {
  try {
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
    await AsyncStorage.setItem(`@couple_partner_loc_${chatId}`, JSON.stringify(loc));
  } catch {}
}

export async function getStoredMyLocation(): Promise<RadarLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_my_loc`);
    if (!raw) return null;
    const parsed: RadarLocation = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
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
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
    await AsyncStorage.setItem(`@couple_my_loc`, JSON.stringify(loc));
  } catch {}
}

/**
 * Request device location safely with fallback retry
 */
export async function getCurrentDeviceLocation(requestIfMissing: boolean = false): Promise<RadarLocation | null> {
  // If running natively on Android / iOS, use expo-location
  if (Platform.OS !== "web") {
    try {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm || perm.status !== "granted") {
        if (!requestIfMissing) {
          return null;
        }
        const req = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (!req || req.status !== "granted") {
          console.warn("Location permission not granted on native device");
          return null;
        }
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!servicesEnabled) {
        const lastPos = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastPos) {
          return {
            lat: lastPos.coords.latitude,
            lng: lastPos.coords.longitude,
            timestamp: lastPos.timestamp || Date.now(),
            accuracy: lastPos.coords.accuracy || undefined,
          };
        }
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync().catch(() => null);
      });

      if (!pos) return null;

      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: pos.timestamp || Date.now(),
        accuracy: pos.coords.accuracy || undefined,
      };
    } catch (e) {
      console.warn("Native expo-location error:", e);
      return null;
    }
  }

  // Web fallback using navigator.geolocation
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
      (err) => {
        // Fallback retry with highAccuracy and longer timeout
        console.warn("Geolocation standard lock failed, attempting fallback:", err?.message || err);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: Date.now(),
              accuracy: pos.coords.accuracy,
            });
          },
          (err2) => {
            console.warn("Geolocation fallback attempt also failed:", err2?.message || err2);
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30 * 60 * 1000, // Accept up to 30 mins cached position
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 15 * 60 * 1000, // Accept up to 15 mins cached position
      }
    );
  });
}

/**
 * Persists user's location to Supabase with dual-layer fallback:
 * 1. chat_participants.radar_location
 * 2. messages table with type "radar_ping" (0 SQL migration requirement)
 */
export async function persistRadarLocationToCloud(chatId: string, userId: string, loc: RadarLocation): Promise<void> {
  try {
    if (!chatId || !userId || !loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

    // 1. Try updating chat_participants directly
    try {
      await supabase
        .from("chat_participants")
        .update({ radar_location: loc })
        .eq("chat_id", chatId)
        .eq("user_id", userId);
    } catch (e) {}

    // 2. Clean up previous radar_pings from this user in this chat to prevent DB clutter
    try {
      await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId)
        .eq("sender_id", userId)
        .eq("type", "radar_ping");
    } catch (e) {}

    // 3. Insert fallback message with type "radar_ping"
    try {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify(loc),
        type: "radar_ping",
      });
    } catch (e) {
      console.warn("Failed to insert fallback radar_ping message:", e);
    }
  } catch (e) {
    console.error("Failed to persist radar location to cloud:", e);
  }
}

/**
 * Fetches the partner's latest radar location from Supabase:
 * 1. Checks chat_participants table
 * 2. Checks messages table fallback
 */
export async function fetchPartnerRadarLocationFromCloud(chatId: string, currentUserId: string): Promise<RadarLocation | null> {
  try {
    if (!chatId || !currentUserId) return null;

    // 1. Check chat_participants
    try {
      const { data: partData, error: partErr } = await supabase
        .from("chat_participants")
        .select("radar_location, user_id")
        .eq("chat_id", chatId)
        .neq("user_id", currentUserId)
        .limit(1)
        .maybeSingle();

      if (!partErr && partData?.radar_location) {
        const parsed = typeof partData.radar_location === "string" 
          ? JSON.parse(partData.radar_location) 
          : partData.radar_location;
        if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number" && parsed.timestamp) {
          if (Date.now() - parsed.timestamp <= RADAR_EXPIRY_TTL_MS) {
            return parsed;
          }
        }
      }
    } catch (e) {}

    // 2. Fallback check from messages table
    try {
      const { data: msgData, error: msgErr } = await supabase
        .from("messages")
        .select("content, created_at, sender_id")
        .eq("chat_id", chatId)
        .eq("type", "radar_ping")
        .neq("sender_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!msgErr && msgData?.content) {
        const parsed = typeof msgData.content === "string" ? JSON.parse(msgData.content) : msgData.content;
        if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          const timestamp = parsed.timestamp || new Date(msgData.created_at).getTime();
          if (Date.now() - timestamp <= RADAR_EXPIRY_TTL_MS) {
            return {
              lat: parsed.lat,
              lng: parsed.lng,
              timestamp,
              accuracy: parsed.accuracy,
            };
          }
        }
      }
    } catch (e) {}

    return null;
  } catch (e) {
    console.warn("Failed to fetch partner radar location from cloud:", e);
    return null;
  }
}
