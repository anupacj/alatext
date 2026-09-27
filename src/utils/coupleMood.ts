import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CoupleMood {
  emoji: string;
  text: string;
  timestamp: number; // ms
  userId: string;
  userName?: string;
}

export const MOOD_EXPIRY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export const MOOD_PRESETS = [
  { emoji: "😴", label: "Sleeping" },
  { emoji: "📚", label: "Studying" },
  { emoji: "🎧", label: "Vibing" },
  { emoji: "💼", label: "Working" },
  { emoji: "☕", label: "Coffee break" },
  { emoji: "🏋️", label: "Gym" },
  { emoji: "💕", label: "Missing you" },
  { emoji: "🍕", label: "Eating" },
  { emoji: "🚗", label: "Driving" },
  { emoji: "🎮", label: "Gaming" },
];

/**
 * Checks if a mood is still active (< 6 hours old)
 */
export function isMoodActive(mood: CoupleMood | null | undefined): boolean {
  if (!mood || !mood.timestamp) return false;
  return Date.now() - mood.timestamp < MOOD_EXPIRY_TTL_MS;
}

/**
 * Formats time remaining for a 6h mood
 */
export function formatMoodRemaining(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  const remainingMs = Math.max(0, MOOD_EXPIRY_TTL_MS - elapsed);
  const remainingMin = Math.floor(remainingMs / (60 * 1000));
  if (remainingMin <= 0) return "expired";
  if (remainingMin < 60) return `${remainingMin}m left`;
  const hours = Math.floor(remainingMin / 60);
  return `${hours}h left`;
}

/**
 * Local storage with automatic 6-hour purge
 */
export async function getStoredPartnerMood(chatId: string): Promise<CoupleMood | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_partner_mood_${chatId}`);
    if (!raw) return null;
    const parsed: CoupleMood = JSON.parse(raw);
    if (!isMoodActive(parsed)) {
      await AsyncStorage.removeItem(`@couple_partner_mood_${chatId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePartnerMood(chatId: string, mood: CoupleMood): Promise<void> {
  try {
    await AsyncStorage.setItem(`@couple_partner_mood_${chatId}`, JSON.stringify(mood));
  } catch {}
}

export async function clearPartnerMood(chatId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`@couple_partner_mood_${chatId}`);
  } catch {}
}

export async function getStoredMyMood(chatId: string): Promise<CoupleMood | null> {
  try {
    const raw = await AsyncStorage.getItem(`@couple_my_mood_${chatId}`);
    if (!raw) return null;
    const parsed: CoupleMood = JSON.parse(raw);
    if (!isMoodActive(parsed)) {
      await AsyncStorage.removeItem(`@couple_my_mood_${chatId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveMyMood(chatId: string, mood: CoupleMood): Promise<void> {
  try {
    await AsyncStorage.setItem(`@couple_my_mood_${chatId}`, JSON.stringify(mood));
  } catch {}
}

export async function clearMyMood(chatId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`@couple_my_mood_${chatId}`);
  } catch {}
}
