import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurRevealShimmerText } from "./BlurRevealShimmerText";
import { ShinyText } from "./ShinyText";
import { getDailyByeQuote } from "../lib/sleepyByeQuotes";

export interface SleepyByeBlockerProps {
  chatId: string;
  visible: boolean;
  targetUsername?: string;
  screenRadius?: number | string;
  onUnlocked?: () => void;
  lockDurationSeconds?: number; // default 120s (2 minutes)
}

const STORAGE_BLOCK_KEY = (chatId: string) => `@sleepy_bye_block_${chatId}`;
const STORAGE_COOLDOWN_KEY = (chatId: string) => `@sleepy_bye_cooldown_${chatId}`;

export const SleepyByeBlocker: React.FC<SleepyByeBlockerProps> = ({
  chatId,
  visible,
  targetUsername = "sleepyhead",
  screenRadius = 0,
  onUnlocked,
  lockDurationSeconds = 120, // 2 minutes
}) => {
  const { width, height } = useWindowDimensions();
  const [isActive, setIsActive] = useState(false);
  const [quote, setQuote] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(lockDurationSeconds);
  const [fadeAnim] = useState(new Animated.Value(0));

  const timerRef = useRef<any>(null);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  // Initialize or resume block from storage to prevent bypass on refresh/exit
  const checkOrInitBlock = useCallback(async () => {
    if (!chatId) return;

    try {
      let storedData: { expiresAt: number; quote: string } | null = null;

      // Check synchronous localStorage on Web for instant zero-flicker check
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const raw = window.localStorage.getItem(STORAGE_BLOCK_KEY(chatId));
        if (raw) {
          try {
            storedData = JSON.parse(raw);
          } catch {}
        }
      }

      // Fallback to AsyncStorage
      if (!storedData) {
        const rawAsync = await AsyncStorage.getItem(STORAGE_BLOCK_KEY(chatId));
        if (rawAsync) {
          try {
            storedData = JSON.parse(rawAsync);
          } catch {}
        }
      }

      const now = Date.now();

      // Case 1: Active persistent block already running
      if (storedData && storedData.expiresAt > now) {
        const leftSec = Math.max(1, Math.ceil((storedData.expiresAt - now) / 1000));
        setQuote(storedData.quote || getDailyByeQuote(targetUsername));
        setRemainingSeconds(leftSec);
        setIsActive(true);
        return;
      }

      // Case 2: New trigger event requested
      if (visible) {
        const expiresAt = now + lockDurationSeconds * 1000;
        const currentQuote = getDailyByeQuote(targetUsername);
        const record = { expiresAt, quote: currentQuote };

        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_BLOCK_KEY(chatId), JSON.stringify(record));
        }
        await AsyncStorage.setItem(STORAGE_BLOCK_KEY(chatId), JSON.stringify(record));

        setQuote(currentQuote);
        setRemainingSeconds(lockDurationSeconds);
        setIsActive(true);
      }
    } catch (e) {
      console.warn("Error handling sleepy bye block state:", e);
    }
  }, [chatId, visible, targetUsername, lockDurationSeconds]);

  useEffect(() => {
    checkOrInitBlock();
  }, [checkOrInitBlock]);

  // Clean unlock handler: sets cooldown and dissolves overlay
  const handleUnlock = useCallback(async () => {
    try {
      // Register 30-minute cooldown
      const cooldownExpiry = Date.now() + 30 * 60 * 1000;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
        window.localStorage.setItem(STORAGE_COOLDOWN_KEY(chatId), String(cooldownExpiry));
      }
      await AsyncStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
      await AsyncStorage.setItem(STORAGE_COOLDOWN_KEY(chatId), String(cooldownExpiry));
    } catch {}

    // Smooth fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 900,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      setIsActive(false);
      onUnlockedRef.current?.();
    });
  }, [chatId, fadeAnim]);

  // Live countdown ticker
  useEffect(() => {
    if (!isActive) return;

    // Smooth silky fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1300,
      useNativeDriver: Platform.OS !== "web",
    }).start();

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleUnlock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, fadeAnim, handleUnlock]);

  // Inject Web keyframes for twilight halo breathing
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "sleepy-twilight-keyframes";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes sleepyHaloPulse {
            0%   { opacity: 0.45; transform: scale(1); }
            50%  { opacity: 0.85; transform: scale(1.003); }
            100% { opacity: 0.45; transform: scale(1); }
          }
          .sleepy-halo {
            position: absolute;
            inset: 0;
            pointer-events: none;
            box-shadow:
              inset 32px 32px 85px -15px #6A40C9,
              inset -32px 32px 85px -15px #C9418F,
              inset 32px -32px 85px -15px #4B2CA8,
              inset -32px -32px 85px -15px #E07AA0,
              inset 0 0 50px -5px #7E50E0;
            animation: sleepyHaloPulse 6s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  if (!isActive && !visible) return null;

  // Format seconds into MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const countdownText = `The block will be lifted in ${timeFormatted}`;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: fadeAnim,
          zIndex: 99999,
          borderRadius: screenRadius as any,
          overflow: "hidden",
          backgroundColor: "#07070a",
          justifyContent: "center",
          alignItems: "center",
        },
      ]}
    >
      {/* Soft starlight radial ambient aura */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            // @ts-ignore Web gradient
            background:
              Platform.OS === "web"
                ? "radial-gradient(ellipse at 50% 48%, rgba(85, 45, 125, 0.28) 0%, rgba(35, 15, 60, 0.18) 45%, rgba(7, 7, 10, 0.95) 75%, #07070a 100%)"
                : undefined,
            backgroundColor: Platform.OS !== "web" ? "rgba(12, 10, 20, 0.95)" : undefined,
          } as any,
        ]}
      />

      {/* Screen edge twilight glow */}
      {Platform.OS === "web" && (
        <div
          className="sleepy-halo"
          style={{
            borderRadius: typeof screenRadius === "number" ? `${screenRadius}px` : screenRadius,
          }}
        />
      )}

      {/* Center quote reveal */}
      <View style={styles.quoteWrapper}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeText}>🌙 SLEEPYHEAD MODE</Text>
        </View>

        <BlurRevealShimmerText
          text={quote}
          messageId={`sleepy-block-${chatId}-${quote.slice(0, 15)}`}
          letterDelay={35}
          revealDuration={1.3}
          shimmerDelay={800}
          shimmerFadeIn={1000}
          shimmerDuration={5.5}
          style={{
            fontFamily: "Josefin Sans, system-ui, sans-serif",
            fontSize: width > 600 ? 22 : 18,
            fontWeight: "400",
            color: "rgba(255, 255, 255, 0.92)",
            textAlign: "center",
            letterSpacing: 0.3,
            lineHeight: width > 600 ? 34 : 28,
            maxWidth: 520,
            textShadow: "0 2px 20px rgba(180, 130, 255, 0.25)",
          }}
        />
      </View>

      {/* Bottom Shimmering Countdown Timer */}
      <View style={styles.countdownContainer}>
        <ShinyText
          text={countdownText}
          speed={3}
          color="rgba(255, 255, 255, 0.65)"
          shineColor="#ffffff"
          spread={110}
          style={{
            fontFamily: "Josefin Sans, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: "500",
            letterSpacing: 0.6,
            textAlign: "center",
          }}
        />
      </View>
    </Animated.View>
  );
};

// Helper to inspect if cooldown is currently active
export async function isSleepyByeCooldownActive(chatId: string): Promise<boolean> {
  if (!chatId) return false;
  try {
    const key = STORAGE_COOLDOWN_KEY(chatId);
    let raw: string | null = null;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      raw = window.localStorage.getItem(key);
    }
    if (!raw) {
      raw = await AsyncStorage.getItem(key);
    }

    if (raw) {
      const exp = parseInt(raw, 10);
      if (!isNaN(exp) && exp > Date.now()) {
        return true;
      }
    }
  } catch {}
  return false;
}

// Helper to inspect if active block is already stored
export async function hasActiveSleepyByeBlock(chatId: string): Promise<boolean> {
  if (!chatId) return false;
  try {
    const key = STORAGE_BLOCK_KEY(chatId);
    let raw: string | null = null;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      raw = window.localStorage.getItem(key);
    }
    if (!raw) {
      raw = await AsyncStorage.getItem(key);
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.expiresAt && parsed.expiresAt > Date.now()) {
        return true;
      }
    }
  } catch {}
  return false;
}

const styles = StyleSheet.create({
  quoteWrapper: {
    paddingHorizontal: 28,
    maxWidth: 580,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badgeRow: {
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  badgeText: {
    fontFamily: "Josefin Sans",
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(220, 200, 255, 0.8)",
    letterSpacing: 1.5,
  },
  countdownContainer: {
    position: "absolute",
    bottom: 36,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 2,
  },
});

export default SleepyByeBlocker;
