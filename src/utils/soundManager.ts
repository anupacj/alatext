import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SoundPreset {
  id: string;
  name: string;
  description: string;
  url?: string;
  isSynthesized?: boolean;
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: "universfield",
    name: "Universfield Chime",
    description: "Gentle crystal chime (Default)",
    url: "/sounds/universfield-chime.mp3",
  },
  {
    id: "crystal",
    name: "Crystal Bell",
    description: "Pure harmonic double bell",
    isSynthesized: true,
  },
  {
    id: "marimba",
    name: "Warm Marimba",
    description: "Soft acoustic wooden notes",
    isSynthesized: true,
  },
  {
    id: "bubbly",
    name: "Bubble Pop",
    description: "Playful cheerful water drop",
    isSynthesized: true,
  },
  {
    id: "custom",
    name: "Custom Upload",
    description: "Your own uploaded audio file",
  },
  {
    id: "none",
    name: "Muted / Silent",
    description: "No notification sound",
  },
];

const STORAGE_KEY = "@alatext_notification_sound";

// AudioContext cache for Web Audio API synthesis
let audioCtx: any = null;
let isAudioUnlocked = false;

function getAudioContext() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock audio on first user interaction
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    const unlockAudio = () => {
      if (isAudioUnlocked) return;
      const ctx = getAudioContext();
      if (ctx) {
        ctx.resume().then(() => {
          isAudioUnlocked = true;
        }).catch(() => {});
      }
      // Also warm up an Audio element
      try {
        const dummy = new Audio();
        dummy.play().catch(() => {});
        isAudioUnlocked = true;
      } catch (e) {}

      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };

    window.addEventListener("click", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });
  } catch (e) {}
}

/**
 * Synthesizes pure harmonic tones with zero network latency using Web Audio API.
 */
function playSynthesizedTone(type: "crystal" | "marimba" | "bubbly") {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === "crystal") {
    // Elegant dual harmonic glass bell (C6 ~ 1046.5Hz & G6 ~ 1567.98Hz)
    const freqs = [1046.5, 1567.98, 2093.0];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + idx * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.8);
    });
  } else if (type === "marimba") {
    // Warm gentle marimba triad
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.22, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  } else if (type === "bubbly") {
    // Upbeat bubble pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export interface SoundConfig {
  soundId: string;
  customUrl: string | null;
  volume: number; // 0 to 1
  enabled: boolean;
}

const DEFAULT_CONFIG: SoundConfig = {
  soundId: "universfield",
  customUrl: null,
  volume: 0.85,
  enabled: true,
};

export async function getSoundConfig(): Promise<SoundConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to load sound config:", e);
  }
  return DEFAULT_CONFIG;
}

export async function saveSoundConfig(config: Partial<SoundConfig>): Promise<SoundConfig> {
  try {
    const current = await getSoundConfig();
    const updated = { ...current, ...config };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to save sound config:", e);
    return DEFAULT_CONFIG;
  }
}

/**
 * Play a notification chime according to user preference or explicit parameters.
 */
export async function playNotificationChime(explicitSoundId?: string, explicitCustomUrl?: string): Promise<void> {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const config = await getSoundConfig();
  if (!config.enabled && !explicitSoundId) return;

  const targetSoundId = explicitSoundId || config.soundId;
  const customUrl = explicitCustomUrl || config.customUrl;

  if (targetSoundId === "none") return;

  try {
    if (targetSoundId === "universfield") {
      const audio = new Audio("/sounds/universfield-chime.mp3");
      audio.volume = config.volume ?? 0.85;
      audio.play().catch(err => {
        // Fallback to synthesized crystal tone if browser blocks audio tag
        playSynthesizedTone("crystal");
      });
    } else if (targetSoundId === "custom" && customUrl) {
      const audio = new Audio(customUrl);
      audio.volume = config.volume ?? 0.85;
      audio.play().catch(() => {});
    } else if (targetSoundId === "crystal" || targetSoundId === "marimba" || targetSoundId === "bubbly") {
      playSynthesizedTone(targetSoundId);
    } else {
      // Fallback to default audio
      const audio = new Audio("/sounds/universfield-chime.mp3");
      audio.volume = config.volume ?? 0.85;
      audio.play().catch(() => playSynthesizedTone("crystal"));
    }
  } catch (e) {
    console.error("Error playing notification sound:", e);
  }
}

// ---------------------------------------------------------------------------
// Real-Time Calling Ringtones & Telephony Tones (Web Audio API Synthesized)
// ---------------------------------------------------------------------------

let outgoingRingtoneInterval: any = null;
let incomingRingtoneInterval: any = null;

/**
 * Starts looping telephone ring tone for caller ("tuuut... tuuut...")
 */
export function startOutgoingRingtone(): void {
  stopOutgoingRingtone();
  stopIncomingRingtone();

  const playBurst = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.setValueAtTime(0.12, now + 1.2);
      gain.gain.linearRampToValueAtTime(0, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
    } catch (e) {}
  };

  playBurst();
  outgoingRingtoneInterval = setInterval(playBurst, 3500);
}

export function stopOutgoingRingtone(): void {
  if (outgoingRingtoneInterval) {
    clearInterval(outgoingRingtoneInterval);
    outgoingRingtoneInterval = null;
  }
}

/**
 * Starts melodious incoming call ringtone for callee
 */
export function startIncomingRingtone(): void {
  stopIncomingRingtone();
  stopOutgoingRingtone();

  const playMelody = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Melodious modern chime triad: E5 (659Hz), G#5 (830Hz), B5 (987Hz), E6 (1318Hz)
      const notes = [659.25, 830.61, 987.77, 1318.51, 987.77, 1318.51];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch (e) {}
  };

  playMelody();
  incomingRingtoneInterval = setInterval(playMelody, 2600);
}

export function stopIncomingRingtone(): void {
  if (incomingRingtoneInterval) {
    clearInterval(incomingRingtoneInterval);
    incomingRingtoneInterval = null;
  }
}

/**
 * Plays cheerful ascending connection chime
 */
export function playCallConnectedTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.38);
    });
  } catch (e) {}
}

/**
 * Plays gentle descending hangup tone
 */
export function playCallEndedTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [659.25, 440.0, 329.63]; // E5, A4, E4
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch (e) {}
}
