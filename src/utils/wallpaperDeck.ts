import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

export type MoodTriggerType = "none" | "love" | "night" | "day";

export interface WallpaperSlot {
  id: string;
  name: string;
  url: string | null;
  dim: number; // 0 to 0.85
  blur: number; // 0 to 1
  zoom: number; // 1 to 2
  mood: MoodTriggerType;
  groupId?: string;
  // Theme-aware smart bubble colors for this wallpaper
  bubbleColorSent?: string;
  bubbleColorReceived?: string;
  isCustom?: boolean;
}

export interface WallpaperGroup {
  id: string;
  name: string;
  icon: string; // Emoji icon
  description?: string;
  slots: WallpaperSlot[];
}

export interface WallpaperDeckConfig {
  version: 2;
  activeGroupId: string;
  activeSlotId: string;
  autoMoodEnabled: boolean;
  autoRotateEnabled: boolean;
  autoMatchBubbles: boolean; // default true: auto apply smart bubble colors when wallpaper changes
  groups: WallpaperGroup[];
  slots: WallpaperSlot[]; // flat list maintained for 100% backward compatibility
  updatedAt: number;
  updatedBy: string;
}

// Resolve mountain red sun asset if available
let mountainAssetUri = "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop";
try {
  const { Image } = require("react-native");
  const asset = Image.resolveAssetSource(require("../../assets/wallpapers/mountain_red_sun.png"));
  if (asset?.uri) mountainAssetUri = asset.uri;
} catch (e) {}

export const DEFAULT_GROUPS: WallpaperGroup[] = [
  {
    id: "group_art",
    name: "Minimal & Art",
    icon: "🏔️",
    description: "Serene artistic landscapes & mountain aesthetics",
    slots: [
      {
        id: "slot_mountain_red_sun",
        name: "Red Sun Mountain",
        url: mountainAssetUri,
        dim: 0.05,
        blur: 0,
        zoom: 1,
        mood: "day",
        groupId: "group_art",
        bubbleColorSent: "#2e6f40", // Sage mountain pine green
        bubbleColorReceived: "#272e39", // Cool frost granite slate
      },
      {
        id: "slot_zenith_peaks",
        name: "Zenith Peaks",
        url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1600&auto=format&fit=crop",
        dim: 0.1,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId: "group_art",
        bubbleColorSent: "#475569",
        bubbleColorReceived: "#1e293b",
      },
      {
        id: "slot_crimson_eclipse",
        name: "Crimson Eclipse",
        url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1600&auto=format&fit=crop",
        dim: 0.15,
        blur: 0,
        zoom: 1,
        mood: "night",
        groupId: "group_art",
        bubbleColorSent: "#b91c1c",
        bubbleColorReceived: "#351a21",
      },
      {
        id: "slot_golden_dunes",
        name: "Zen Sand Dunes",
        url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1600&auto=format&fit=crop",
        dim: 0.05,
        blur: 0,
        zoom: 1,
        mood: "day",
        groupId: "group_art",
        bubbleColorSent: "#b45309",
        bubbleColorReceived: "#29211a",
      },
    ],
  },
  {
    id: "group_nature",
    name: "Anime & Nature",
    icon: "🌿",
    description: "Ghibli inspired scenery, meadows and rainy days",
    slots: [
      {
        id: "slot_daylight_glow",
        name: "Daylight Glow",
        url: null, // User's primary slot fallback
        dim: 0,
        blur: 0,
        zoom: 1,
        mood: "day",
        groupId: "group_nature",
        bubbleColorSent: "#2e7d32",
        bubbleColorReceived: "#1e2f24",
      },
      {
        id: "slot_forest_canopy",
        name: "Forest Mist",
        url: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1600&auto=format&fit=crop",
        dim: 0.1,
        blur: 0,
        zoom: 1,
        mood: "day",
        groupId: "group_nature",
        bubbleColorSent: "#15803d",
        bubbleColorReceived: "#1a2d21",
      },
      {
        id: "slot_ocean_rain",
        name: "Rainy Afternoon",
        url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1600&auto=format&fit=crop",
        dim: 0.15,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId: "group_nature",
        bubbleColorSent: "#0284c7",
        bubbleColorReceived: "#162738",
      },
      {
        id: "slot_sakura_breeze",
        name: "Sakura Blossom",
        url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1600&auto=format&fit=crop",
        dim: 0.05,
        blur: 0,
        zoom: 1,
        mood: "love",
        groupId: "group_nature",
        bubbleColorSent: "#ec4899",
        bubbleColorReceived: "#381c29",
      },
    ],
  },
  {
    id: "group_night",
    name: "Cozy & Night",
    icon: "🌙",
    description: "Midnight lo-fi vibes, stars and glowing cityscapes",
    slots: [
      {
        id: "slot_midnight_whispers",
        name: "Midnight Whispers",
        url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop",
        dim: 0.25,
        blur: 0,
        zoom: 1,
        mood: "night",
        groupId: "group_night",
        bubbleColorSent: "#6366f1",
        bubbleColorReceived: "#1e1b4b",
      },
      {
        id: "slot_lofi_glow",
        name: "Lo-Fi Room",
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop",
        dim: 0.2,
        blur: 0,
        zoom: 1,
        mood: "night",
        groupId: "group_night",
        bubbleColorSent: "#8b5cf6",
        bubbleColorReceived: "#2b1d42",
      },
      {
        id: "slot_cyber_neon",
        name: "Cyber Alley",
        url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1600&auto=format&fit=crop",
        dim: 0.2,
        blur: 0,
        zoom: 1,
        mood: "night",
        groupId: "group_night",
        bubbleColorSent: "#06b6d4",
        bubbleColorReceived: "#133845",
      },
    ],
  },
  {
    id: "group_romance",
    name: "Heart & Warmth",
    icon: "💖",
    description: "Warm sunsets, golden hours & romantic moods",
    slots: [
      {
        id: "slot_heart_soul",
        name: "Heart & Soul",
        url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=1600&auto=format&fit=crop",
        dim: 0.1,
        blur: 0,
        zoom: 1,
        mood: "love",
        groupId: "group_romance",
        bubbleColorSent: "#f43f5e",
        bubbleColorReceived: "#3d1421",
      },
      {
        id: "slot_golden_hour",
        name: "Golden Horizon",
        url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?q=80&w=1600&auto=format&fit=crop",
        dim: 0.05,
        blur: 0,
        zoom: 1,
        mood: "love",
        groupId: "group_romance",
        bubbleColorSent: "#f59e0b",
        bubbleColorReceived: "#361e0b",
      },
    ],
  },
  {
    id: "group_custom",
    name: "Custom Uploads",
    icon: "⭐",
    description: "Your own personalized uploaded photos",
    slots: [
      {
        id: "slot_custom_1",
        name: "Custom Wallpaper 1",
        url: null,
        dim: 0,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId: "group_custom",
        isCustom: true,
      },
      {
        id: "slot_custom_2",
        name: "Custom Wallpaper 2",
        url: null,
        dim: 0,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId: "group_custom",
        isCustom: true,
      },
      {
        id: "slot_custom_3",
        name: "Custom Wallpaper 3",
        url: null,
        dim: 0,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId: "group_custom",
        isCustom: true,
      },
    ],
  },
];

export const DEFAULT_SLOTS: WallpaperSlot[] = DEFAULT_GROUPS[1].slots;

export function getAllSlots(groups: WallpaperGroup[]): WallpaperSlot[] {
  const result: WallpaperSlot[] = [];
  for (const g of groups) {
    if (Array.isArray(g.slots)) {
      result.push(...g.slots);
    }
  }
  return result;
}

export function normalizeDeck(raw: any, fallbackUrl?: string | null, userId = "default"): WallpaperDeckConfig {
  if (!raw || typeof raw !== "object") {
    return createDefaultDeck(fallbackUrl, userId);
  }

  let groups: WallpaperGroup[] = [];
  if (Array.isArray(raw.groups) && raw.groups.length > 0) {
    groups = raw.groups.map((g: any, gIdx: number) => ({
      id: g.id || `group_${gIdx}`,
      name: g.name || "Group",
      icon: g.icon || "🖼️",
      description: g.description || "",
      slots: Array.isArray(g.slots) ? g.slots.map((s: any, sIdx: number) => ({
        id: s.id || `slot_${gIdx}_${sIdx}`,
        name: s.name || `Wallpaper ${sIdx + 1}`,
        url: s.url || null,
        dim: typeof s.dim === "number" ? s.dim : 0,
        blur: typeof s.blur === "number" ? s.blur : 0,
        zoom: typeof s.zoom === "number" ? s.zoom : 1,
        mood: s.mood || "none",
        groupId: g.id || `group_${gIdx}`,
        bubbleColorSent: s.bubbleColorSent || undefined,
        bubbleColorReceived: s.bubbleColorReceived || undefined,
        isCustom: !!s.isCustom,
      })) : [],
    }));
  } else {
    // Migration from version 1 slots to version 2 groups
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_GROUPS)) as WallpaperGroup[];
    if (Array.isArray(raw.slots) && raw.slots.length > 0) {
      // Put existing v1 slots into the custom group or nature group
      const customGroup = defaultCopy.find(g => g.id === "group_custom") || defaultCopy[0];
      const customSlots: WallpaperSlot[] = raw.slots.map((s: any, sIdx: number) => ({
        id: s.id || `migrated_slot_${sIdx}`,
        name: s.name || `Photo ${sIdx + 1}`,
        url: s.url || null,
        dim: typeof s.dim === "number" ? s.dim : 0,
        blur: typeof s.blur === "number" ? s.blur : 0,
        zoom: typeof s.zoom === "number" ? s.zoom : 1,
        mood: s.mood || "none",
        groupId: customGroup.id,
        bubbleColorSent: s.bubbleColorSent,
        bubbleColorReceived: s.bubbleColorReceived,
        isCustom: true,
      }));
      customGroup.slots = customSlots;
    }
    groups = defaultCopy;
  }

  // Ensure daylight glow has fallbackUrl if needed
  if (fallbackUrl) {
    const daylight = getAllSlots(groups).find(s => s.id === "slot_daylight_glow" || s.id === "slot_1");
    if (daylight && !daylight.url) {
      daylight.url = fallbackUrl;
    }
  }

  const allSlots = getAllSlots(groups);
  const activeSlotId = raw.activeSlotId && allSlots.some(s => s.id === raw.activeSlotId)
    ? raw.activeSlotId
    : (allSlots.find(s => !!s.url)?.id || allSlots[0]?.id || "slot_mountain_red_sun");

  const activeSlot = allSlots.find(s => s.id === activeSlotId);
  const activeGroupId = activeSlot?.groupId || raw.activeGroupId || groups[0]?.id || "group_art";

  return {
    version: 2,
    activeGroupId,
    activeSlotId,
    autoMoodEnabled: raw.autoMoodEnabled ?? false,
    autoRotateEnabled: raw.autoRotateEnabled ?? false,
    autoMatchBubbles: raw.autoMatchBubbles ?? true,
    groups,
    slots: allSlots,
    updatedAt: raw.updatedAt || Date.now(),
    updatedBy: raw.updatedBy || userId,
  };
}

export function createDefaultDeck(fallbackUrl?: string | null, userId = "default"): WallpaperDeckConfig {
  const groups: WallpaperGroup[] = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
  let activeSlotId = "slot_mountain_red_sun";
  let activeGroupId = "group_art";

  if (fallbackUrl) {
    const all = getAllSlots(groups);
    const matched = all.find(s => s.url === fallbackUrl);
    if (matched) {
      activeSlotId = matched.id;
      activeGroupId = matched.groupId || "group_art";
    } else {
      // Custom uploaded photo fallback
      const customSlot = groups.find(g => g.id === "group_custom")?.slots[0] ||
                         groups.find(g => g.id === "group_nature")?.slots.find(s => s.id === "slot_daylight_glow");
      if (customSlot) {
        customSlot.url = fallbackUrl;
        activeSlotId = customSlot.id;
        activeGroupId = customSlot.groupId || "group_custom";
      }
    }
  }

  const allSlots = getAllSlots(groups);

  return {
    version: 2,
    activeGroupId,
    activeSlotId,
    autoMoodEnabled: false,
    autoRotateEnabled: false,
    autoMatchBubbles: true,
    groups,
    slots: allSlots,
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
    const parsed = JSON.parse(raw);
    return normalizeDeck(parsed);
  } catch (e) {
    return null;
  }
}

export async function saveDeckToLocal(chatId: string, deck: WallpaperDeckConfig): Promise<void> {
  try {
    const normalized = normalizeDeck(deck);
    await AsyncStorage.setItem(getLocalDeckKey(chatId), JSON.stringify(normalized));
  } catch (e) {}
}

export async function fetchDeckFromCloud(chatId: string, userId?: string): Promise<WallpaperDeckConfig | null> {
  try {
    // 1. Try chat_participants table (first-class database column)
    try {
      let query = supabase.from("chat_participants").select("wallpaper_deck, user_id").eq("chat_id", chatId);
      if (userId) query = query.eq("user_id", userId);
      const { data: parts, error: partErr } = await query;
      if (!partErr && Array.isArray(parts)) {
        for (const p of parts) {
          if (p.wallpaper_deck) {
            const parsed = typeof p.wallpaper_deck === "string" ? JSON.parse(p.wallpaper_deck) : p.wallpaper_deck;
            if (parsed) return normalizeDeck(parsed);
          }
        }
      }
    } catch (e) {}

    // 2. Fallback to messages table
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
    if (parsed) {
      return normalizeDeck(parsed);
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function persistDeckToCloud(chatId: string, userId: string, deck: WallpaperDeckConfig): Promise<void> {
  try {
    const normalized = normalizeDeck(deck, undefined, userId);
    const activeSlot = getActiveSlot(normalized);

    // 1. Update chat_participants directly with wallpaper_deck and active wallpaper columns
    const updates: any = {
      wallpaper_deck: normalized,
      wallpaper_url: activeSlot?.url || null,
      wallpaper_dim: activeSlot?.dim || 0,
      wallpaper_blur: activeSlot?.blur || 0,
      wallpaper_zoom: activeSlot?.zoom || 1,
    };

    try {
      const { error: partErr } = await supabase
        .from("chat_participants")
        .update(updates)
        .eq("chat_id", chatId)
        .eq("user_id", userId);

      if (partErr) {
        // If wallpaper_deck column is not in DB yet, update standard wallpaper columns
        const { wallpaper_deck, ...baseUpdates } = updates;
        await supabase
          .from("chat_participants")
          .update(baseUpdates)
          .eq("chat_id", chatId)
          .eq("user_id", userId);
      }
    } catch (e) {}

    // 2. Also try messages table for fallback
    try {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify(normalized),
        type: "wallpaper_deck",
      });
    } catch (e) {}
  } catch (e) {
    console.error("Failed to persist wallpaper deck to cloud:", e);
  }
}

export function broadcastDeckUpdate(chatId: string, userId: string, deck: WallpaperDeckConfig, channelOverride?: any): void {
  try {
    const normalized = normalizeDeck(deck, undefined, userId);
    const broadcastTopic = `chat_broadcast_${chatId}`;

    const payload = {
      type: "broadcast" as const,
      event: "wallpaper_sync",
      payload: {
        deck: normalized,
        sender_id: userId,
      },
    };

    // 1. Prefer explicitly passed channel if already joined
    let channel = channelOverride;

    // 2. Otherwise search existing Supabase channels for active joined broadcast channel
    if (!channel) {
      const existing = supabase.getChannels().find(c => 
        c.topic === `realtime:${broadcastTopic}` || c.topic === broadcastTopic
      );
      if (existing) {
        channel = existing;
      }
    }

    if (channel && ((channel as any).state === "joined" || (channel as any).isJoined?.())) {
      channel.send(payload);
    } else {
      // Subscribes before sending if no channel is currently joined
      const newChan = supabase.channel(broadcastTopic, { config: { broadcast: { self: false } } });
      newChan.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          newChan.send(payload);
        }
      });
    }
  } catch (e) {
    console.error("Failed to broadcast wallpaper deck update:", e);
  }
}

export function getActiveSlot(deck: WallpaperDeckConfig): WallpaperSlot {
  if (deck.groups && deck.groups.length > 0) {
    for (const g of deck.groups) {
      const found = g.slots?.find(s => s.id === deck.activeSlotId);
      if (found) return found;
    }
  }
  const found = deck.slots?.find(s => s.id === deck.activeSlotId);
  return found || deck.groups?.[0]?.slots?.[0] || DEFAULT_GROUPS[0].slots[0];
}

export function getActiveGroup(deck: WallpaperDeckConfig): WallpaperGroup {
  const activeSlot = getActiveSlot(deck);
  const found = deck.groups.find(g => g.id === deck.activeGroupId || g.id === activeSlot.groupId);
  return found || deck.groups[0] || DEFAULT_GROUPS[0];
}

export function getSmartBubbleColors(slot: WallpaperSlot): { sent: string; received: string } {
  if (slot.bubbleColorSent && slot.bubbleColorReceived) {
    return { sent: slot.bubbleColorSent, received: slot.bubbleColorReceived };
  }

  // Fallback smart complementary matching based on mood or hash
  if (slot.mood === "love") {
    return { sent: "#f43f5e", received: "#3d1421" };
  }
  if (slot.mood === "night") {
    return { sent: "#6366f1", received: "#1e1b4b" };
  }
  if (slot.mood === "day") {
    return { sent: "#2e7d32", received: "#1e2f24" };
  }

  return { sent: "#5865F2", received: "#2b2d31" };
}

export function getNextRotatedSlot(deck: WallpaperDeckConfig): WallpaperSlot | null {
  const allSlots = getAllSlots(deck.groups);
  const validSlots = allSlots.filter(s => !!s.url);
  if (validSlots.length <= 1) return null;

  const currentIdx = validSlots.findIndex(s => s.id === deck.activeSlotId);
  const nextIdx = (currentIdx + 1) % validSlots.length;
  return validSlots[nextIdx];
}

export function getSlotByMood(deck: WallpaperDeckConfig, mood: MoodTriggerType): WallpaperSlot | null {
  const allSlots = getAllSlots(deck.groups);
  const matched = allSlots.find(s => s.mood === mood && !!s.url);
  if (matched) return matched;

  // Fallbacks
  if (mood === "love") {
    const s = allSlots.find(slot => slot.id === "slot_heart_soul" && !!slot.url);
    if (s) return s;
  }
  if (mood === "night") {
    const s = allSlots.find(slot => slot.id === "slot_midnight_whispers" && !!slot.url);
    if (s) return s;
  }
  if (mood === "day") {
    const s = allSlots.find(slot => (slot.id === "slot_mountain_red_sun" || slot.id === "slot_daylight_glow") && !!slot.url);
    if (s) return s;
  }
  return null;
}
