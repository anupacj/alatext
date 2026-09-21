import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

export type MoodTriggerType = "none" | "love" | "night" | "day";

export interface WallpaperSlot {
  id: string; // 'slot_1' | 'slot_2' | 'slot_3' | 'slot_4' | 'slot_5'
  name: string;
  url: string | null;
  dim: number; // 0 to 0.85
  blur: number; // 0 to 1
  zoom: number; // 1 to 2
  mood: MoodTriggerType;
}

export interface WallpaperDeckConfig {
  version: 1;
  activeSlotId: string;
  autoMoodEnabled: boolean;
  autoRotateEnabled: boolean;
  slots: WallpaperSlot[];
  updatedAt: number;
  updatedBy: string;
}

export const DEFAULT_SLOTS: WallpaperSlot[] = [
  { id: "slot_1", name: "Daylight Glow", url: null, dim: 0, blur: 0, zoom: 1, mood: "day" },
  { id: "slot_2", name: "Heart & Soul", url: null, dim: 0.1, blur: 0, zoom: 1, mood: "love" },
  { id: "slot_3", name: "Midnight Whispers", url: null, dim: 0.25, blur: 0, zoom: 1, mood: "night" },
  { id: "slot_4", name: "Chill & Cozy", url: null, dim: 0, blur: 0, zoom: 1, mood: "none" },
  { id: "slot_5", name: "Our Memory", url: null, dim: 0, blur: 0, zoom: 1, mood: "none" },
];

export function createDefaultDeck(fallbackUrl?: string | null, userId: string = "default"): WallpaperDeckConfig {
  const slots: WallpaperSlot[] = DEFAULT_SLOTS.map((s, idx) => {
    if (idx === 0 && fallbackUrl) {
      return { ...s, url: fallbackUrl };
    }
    return { ...s };
  });

  return {
    version: 1,
    activeSlotId: "slot_1",
    autoMoodEnabled: true,
    autoRotateEnabled: false,
    slots,
    updatedAt: Date.now(),
    updatedBy: userId,
  };
}

export function getLocalDeckKey(chatId: string): string {
  return `@chat_${chatId}_wallpaper_deck`;
}

export async function loadDeckFromLocal(chatId: string): Promise<WallpaperDeckConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(getLocalDeckKey(chatId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function saveDeckToLocal(chatId: string, deck: WallpaperDeckConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(getLocalDeckKey(chatId), JSON.stringify(deck));
  } catch (e) {}
}

export async function fetchDeckFromCloud(chatId: string): Promise<WallpaperDeckConfig | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("content, created_at")
      .eq("chat_id", chatId)
      .eq("type", "wallpaper_deck")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.content) return null;
    const parsed = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
    if (parsed && Array.isArray(parsed.slots)) {
      return parsed as WallpaperDeckConfig;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function persistDeckToCloud(chatId: string, userId: string, deck: WallpaperDeckConfig): Promise<void> {
  try {
    // 1. Save durable record into messages table
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: userId,
      content: JSON.stringify(deck),
      type: "wallpaper_deck",
    });

    // 2. Update current participant's active wallpaper columns for standard compatibility
    const activeSlot = deck.slots.find(s => s.id === deck.activeSlotId) || deck.slots[0];
    if (activeSlot) {
      await supabase.from("chat_participants").update({
        wallpaper_url: activeSlot.url || null,
        wallpaper_dim: activeSlot.dim || 0,
        wallpaper_blur: activeSlot.blur || 0,
        wallpaper_zoom: activeSlot.zoom || 1,
      }).eq("chat_id", chatId).eq("user_id", userId);
    }
  } catch (e) {
    console.error("Failed to persist wallpaper deck to cloud:", e);
  }
}

export function broadcastDeckUpdate(chatId: string, userId: string, deck: WallpaperDeckConfig): void {
  try {
    const broadcastTopic = `chat_broadcast_${chatId}`;
    const channel = supabase.channel(broadcastTopic, { config: { broadcast: { self: false } } });
    channel.send({
      type: "broadcast",
      event: "wallpaper_sync",
      payload: {
        deck,
        sender_id: userId,
      },
    });
  } catch (e) {
    console.error("Failed to broadcast wallpaper deck update:", e);
  }
}

export function getActiveSlot(deck: WallpaperDeckConfig): WallpaperSlot {
  const found = deck.slots.find(s => s.id === deck.activeSlotId);
  return found || deck.slots[0];
}

export function getNextRotatedSlot(deck: WallpaperDeckConfig): WallpaperSlot | null {
  const validSlots = deck.slots.filter(s => !!s.url);
  if (validSlots.length <= 1) return null;

  const currentIdx = validSlots.findIndex(s => s.id === deck.activeSlotId);
  const nextIdx = (currentIdx + 1) % validSlots.length;
  return validSlots[nextIdx];
}

export function getSlotByMood(deck: WallpaperDeckConfig, mood: MoodTriggerType): WallpaperSlot | null {
  const matched = deck.slots.find(s => s.mood === mood && !!s.url);
  if (matched) return matched;

  // Fallback defaults if not explicitly tagged
  if (mood === "love") {
    const slot2 = deck.slots.find(s => s.id === "slot_2" && !!s.url);
    if (slot2) return slot2;
  }
  if (mood === "night") {
    const slot3 = deck.slots.find(s => s.id === "slot_3" && !!s.url);
    if (slot3) return slot3;
  }
  if (mood === "day") {
    const slot1 = deck.slots.find(s => s.id === "slot_1" && !!s.url);
    if (slot1) return slot1;
  }
  return null;
}
