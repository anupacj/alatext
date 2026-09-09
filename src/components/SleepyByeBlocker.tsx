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
  blockedUntil?: string | null;   // ISO timestamp stored in Supabase chats.blocked_until
  quote?: string | null;          // Quote stored in Supabase chats.block_quote
  targetUsername?: string;
  onUnlocked?: () => void;
}

/**
 * Purges any legacy local storage keys that may have caused infinite lock loops
 */
export async function clearStuckLocalByeBlocks() {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith("@sleepy_bye_block_") || k.startsWith("@sleepy_bye_cooldown_"))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
    const asyncKeys = await AsyncStorage.getAllKeys();
    const stuck = asyncKeys.filter(
      (k) => k.startsWith("@sleepy_bye_block_") || k.startsWith("@sleepy_bye_cooldown_")
    );
    if (stuck.length > 0) {
      await Promise.all(stuck.map((k) => AsyncStorage.removeItem(k)));
    }
  } catch {}
}

export const SleepyByeBlocker: React.FC<SleepyByeBlockerProps> = ({
  chatId,
  visible,
  blockedUntil,
  quote,
  targetUsername = "sleepyhead",
  onUnlocked,
}) => {
  const { width, height } = useWindowDimensions();
  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));

  const timerRef = useRef<any>(null);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  // Determine active status from Supabase blockedUntil or visible prop
  useEffect(() => {
    if (!blockedUntil) {
      if (!visible) {
        if (isActive) {
          setIsActive(false);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: Platform.OS !== "web",
          }).start();
        }
      }
      return;
    }

    const exp = new Date(blockedUntil).getTime();
    const diff = Math.max(0, Math.ceil((exp - Date.now()) / 1000));

    if (diff > 0) {
      setRemainingSeconds(diff);
      setIsActive(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else {
      setIsActive(false);
      onUnlockedRef.current?.();
    }
  }, [blockedUntil, visible, isActive, fadeAnim]);

  // Handle countdown ticking
  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: Platform.OS !== "web",
          }).start(() => {
            setIsActive(false);
            onUnlockedRef.current?.();
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, fadeAnim]);

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

  if (!isActive) return null;

  const displayQuote = quote || getDailyByeQuote(targetUsername);

  // Format seconds into MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const countdownText = `The block will be lifted in ${timeFormatted}`;

  const isMobile = width < 600;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        {
          position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          zIndex: 999999,
          backgroundColor: "#07070a",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          opacity: fadeAnim,
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
                ? "radial-gradient(ellipse at 50% 50%, rgba(85, 45, 125, 0.32) 0%, rgba(35, 15, 60, 0.20) 45%, rgba(7, 7, 10, 0.95) 75%, #07070a 100%)"
                : undefined,
            backgroundColor: Platform.OS !== "web" ? "rgba(12, 10, 20, 0.95)" : undefined,
          } as any,
        ]}
      />

      {/* Screen edge twilight glow */}
      {Platform.OS === "web" && <div className="sleepy-halo" />}

      {/* Optical Center Container */}
      <View style={[styles.quoteWrapper, { maxWidth: isMobile ? 340 : 540, paddingHorizontal: isMobile ? 16 : 28 }]}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeText}>🌙 SLEEPYHEAD MODE</Text>
        </View>

        <BlurRevealShimmerText
          text={displayQuote}
          messageId={`sleepy-${chatId}-${blockedUntil || displayQuote.slice(0, 15)}`}
          letterDelay={25}
          revealDuration={1.2}
          shimmerDelay={600}
          shimmerFadeIn={800}
          shimmerDuration={5}
          style={{
            fontFamily: "Josefin Sans, system-ui, sans-serif",
            fontSize: isMobile ? 17 : 21,
            fontWeight: "400",
            color: "rgba(255, 255, 255, 0.94)",
            textAlign: "center",
            letterSpacing: 0.3,
            lineHeight: isMobile ? 27 : 34,
            maxWidth: isMobile ? 340 : 520,
            textShadow: "0 2px 20px rgba(180, 130, 255, 0.25)",
            wordBreak: "break-word",
          }}
        />
      </View>

      {/* Bottom Shimmering Countdown Timer */}
      <View style={styles.countdownContainer}>
        <ShinyText
          text={countdownText}
          speed={3}
          color="rgba(255, 255, 255, 0.68)"
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

const styles = StyleSheet.create({
  quoteWrapper: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    marginTop: -20, // optical center compensation
  },
  badgeRow: {
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  badgeText: {
    fontFamily: "Josefin Sans",
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(220, 200, 255, 0.85)",
    letterSpacing: 1.5,
  },
  countdownContainer: {
    position: "absolute",
    bottom: 36,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    zIndex: 2,
  },
});

export default SleepyByeBlocker;
