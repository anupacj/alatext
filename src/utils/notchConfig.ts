import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type NotchMode = "dynamic_island" | "floating_breathe" | "edge_dot" | "classic";

export interface NotchConfig {
  mode: NotchMode;
  dynamicAnimationsEnabled: boolean; // Opt-out from dynamic morphing animations
  topOffset: number; // Pixels offset (-15 to +35)
  islandHeight: number; // 38 to 54
  islandWidthRatio: number; // 0.85 to 1.0
  cameraTargetGuide: boolean; // Alignment guide overlay
}

export const NOTCH_PROFILES = [
  {
    id: "dynamic_island" as NotchMode,
    name: "Dynamic Island",
    badge: "Centered Notch",
    icon: "🏝️",
    description: "Anchors to the top around your camera cutout with live morphing animations (typing, audio & pings).",
  },
  {
    id: "floating_breathe" as NotchMode,
    name: "Camera Breathe",
    badge: "Clean Clearance",
    icon: "🍃",
    description: "Drops the header down ~8-12px so your camera rests in clean open space with zero text collision.",
  },
  {
    id: "edge_dot" as NotchMode,
    name: "Corner / Edge Dot",
    badge: "Left/Right Notch",
    icon: "📐",
    description: "For phones with a camera in the far corner. Disables center island and applies safe margin clearance.",
  },
  {
    id: "classic" as NotchMode,
    name: "Classic Floating",
    badge: "Default",
    icon: "💎",
    description: "Traditional 3-pill floating layout. Standard for desktop PC and default screens.",
  },
];

export const DEFAULT_NOTCH_CONFIG: NotchConfig = {
  mode: "dynamic_island",
  dynamicAnimationsEnabled: true,
  topOffset: 0,
  islandHeight: 46,
  islandWidthRatio: 1.0,
  cameraTargetGuide: false,
};

const STORAGE_KEY = "@user_notch_config";
const listeners: Set<(cfg: NotchConfig) => void> = new Set();

let cachedConfig: NotchConfig | null = null;

export async function getNotchConfig(): Promise<NotchConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedConfig = { ...DEFAULT_NOTCH_CONFIG, ...parsed };
      return cachedConfig!;
    }
  } catch (e) {}

  cachedConfig = { ...DEFAULT_NOTCH_CONFIG };
  return cachedConfig;
}

export async function saveNotchConfig(config: NotchConfig): Promise<void> {
  cachedConfig = config;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {}
  listeners.forEach(cb => {
    try { cb(config); } catch (e) {}
  });
}

export function subscribeNotchConfig(callback: (cfg: NotchConfig) => void): () => void {
  listeners.add(callback);
  if (cachedConfig) {
    callback(cachedConfig);
  } else {
    getNotchConfig().then(callback);
  }
  return () => {
    listeners.delete(callback);
  };
}

// Global audio playback event broadcaster for Dynamic Island wave animations
export type DynamicIslandAudioEvent = { isPlaying: boolean; title?: string; progress?: number };
const audioListeners: Set<(event: DynamicIslandAudioEvent) => void> = new Set();

export function broadcastAudioState(event: DynamicIslandAudioEvent): void {
  audioListeners.forEach(cb => {
    try { cb(event); } catch (e) {}
  });
}

export function subscribeAudioState(callback: (event: DynamicIslandAudioEvent) => void): () => void {
  audioListeners.add(callback);
  return () => {
    audioListeners.delete(callback);
  };
}
