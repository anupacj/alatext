import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Animated,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurRevealShimmerText } from "./BlurRevealShimmerText";
import { ShinyText } from "./ShinyText";
import { getDailyByeQuote } from "../lib/sleepyByeQuotes";

export interface SleepyByeBlockerProps {
  chatId: string;
  visible?: boolean;
  blockedUntil?: string | null;   // ISO timestamp from Supabase
  quote?: string | null;          // Quote from Supabase
  targetUsername?: string;
  onUnlocked?: () => void;
}

const STORAGE_BLOCK_KEY = (chatId: string) => `@sleepy_bye_block_${chatId}`;

// Isolated ticking countdown component so the parent quote NEVER re-renders every second
const ShimmeringCountdown: React.FC<{
  expiresAtMs: number;
  onComplete: () => void;
}> = React.memo(({ expiresAtMs, onComplete }) => {
  const [remainingSecs, setRemainingSecs] = useState(() => {
    return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
  });

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setRemainingSecs(left);
      if (left <= 0) {
        clearInterval(timer);
        onCompleteRef.current?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAtMs]);

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const countdownText = `The block will be lifted in ${timeFormatted}`;

  return (
    <View style={styles.countdownContainer}>
      <ShinyText
        text={countdownText}
        speed={3}
        color="rgba(255, 255, 255, 0.72)"
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
  );
});

export const SleepyByeBlocker: React.FC<SleepyByeBlockerProps> = ({
  chatId,
  visible = false,
  blockedUntil,
  quote,
  targetUsername = "sleepyhead",
  onUnlocked,
}) => {
  const { width } = useWindowDimensions();
  const [isActive, setIsActive] = useState(false);
  const [activeExpiresAt, setActiveExpiresAt] = useState<number>(0);
  const [activeQuote, setActiveQuote] = useState<string>("");
  const [fadeAnim] = useState(new Animated.Value(0));

  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  // Restore or synchronize active block state from local storage or props
  useEffect(() => {
    if (!chatId) return;

    const checkState = async () => {
      let candidateExp = 0;
      let candidateQuote = quote || "";

      // 1. Check passed prop from Supabase
      if (blockedUntil) {
        const propExp = new Date(blockedUntil).getTime();
        if (propExp > Date.now()) {
          candidateExp = propExp;
        }
      }

      // 2. Check local persistence if prop is not set yet
      if (!candidateExp) {
        try {
          let raw: string | null = null;
          if (Platform.OS === "web" && typeof window !== "undefined") {
            raw = window.localStorage.getItem(STORAGE_BLOCK_KEY(chatId));
          }
          if (!raw) {
            raw = await AsyncStorage.getItem(STORAGE_BLOCK_KEY(chatId));
          }
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.blockedUntil && new Date(parsed.blockedUntil).getTime() > Date.now()) {
              candidateExp = new Date(parsed.blockedUntil).getTime();
              candidateQuote = parsed.quote || candidateQuote;
            } else {
              // Expired, remove
              if (Platform.OS === "web" && typeof window !== "undefined") {
                window.localStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
              }
              await AsyncStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
            }
          }
        } catch {}
      }

      if (candidateExp > Date.now()) {
        const safeName = targetUsername?.trim() || "sleepyhead";
        let q = candidateQuote;
        if (q && q.includes("[username]")) {
          q = q.replace(/\[username\]/g, safeName);
        } else if (!q || (safeName !== "sleepyhead" && !q.includes(safeName))) {
          q = getDailyByeQuote(safeName);
        }
        setActiveExpiresAt(candidateExp);
        setActiveQuote(q);
        setIsActive(true);

        // Sync local storage so exiting and returning ALWAYS remembers the block
        const record = { blockedUntil: new Date(candidateExp).toISOString(), quote: q };
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_BLOCK_KEY(chatId), JSON.stringify(record));
        }
        await AsyncStorage.setItem(STORAGE_BLOCK_KEY(chatId), JSON.stringify(record));

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
        }).start();
      } else {
        if (isActive) {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: Platform.OS !== "web",
          }).start(() => setIsActive(false));
        }
      }
    };

    checkState();
  }, [chatId, blockedUntil, quote, targetUsername, isActive, fadeAnim]);

  // Handle clean dismissal
  const handleDismiss = useCallback(async () => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
      }
      await AsyncStorage.removeItem(STORAGE_BLOCK_KEY(chatId));
    } catch {}

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      setIsActive(false);
      onUnlockedRef.current?.();
    });
  }, [chatId, fadeAnim]);

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
      <View style={[styles.quoteWrapper, { maxWidth: isMobile ? "88%" : 640, width: "100%", paddingHorizontal: isMobile ? 16 : 28 }]}>
        <BlurRevealShimmerText
          text={activeQuote}
          letterDelay={22}
          revealDuration={1.0}
          shimmerDelay={400}
          shimmerFadeIn={700}
          shimmerDuration={5}
          style={{
            fontFamily: "Josefin Sans, system-ui, sans-serif",
            fontSize: isMobile ? 18 : 22,
            fontWeight: "400",
            color: "rgba(255, 255, 255, 0.95)",
            textAlign: "center",
            letterSpacing: 0.2,
            lineHeight: isMobile ? "30px" : "38px",
            textShadow: "0 2px 20px rgba(180, 130, 255, 0.30)",
          }}
        />
      </View>

      {/* Isolated Countdown Component: Never re-renders the quote above! */}
      <ShimmeringCountdown
        expiresAtMs={activeExpiresAt}
        onComplete={handleDismiss}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  quoteWrapper: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    marginTop: -16, // optical center compensation
  },
  countdownContainer: {
    position: "absolute",
    bottom: 30,
    alignItems: "center",
    gap: 10,
    zIndex: 2,
  },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  dismissBtnText: {
    fontFamily: "Josefin Sans",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "500",
  },
});

export default SleepyByeBlocker;
