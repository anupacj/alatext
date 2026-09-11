import React, { useEffect, useState, useMemo } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";

interface FloatingHeartItem {
  id: number;
  emoji: string;
  leftPercent: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  rotateDeg: number;
}

const HEART_EMOJIS = ["❤️", "💖", "💕", "💓", "💗", "💘", "🫶", "💝"];

export interface FloatingHeartsProps {
  active: boolean;
  onComplete?: () => void;
  count?: number;
}

export const FloatingHearts: React.FC<FloatingHeartsProps> = ({
  active,
  onComplete,
  count = 14,
}) => {
  const [visible, setVisible] = useState(false);

  // Inject Web CSS keyframes for floating hearts
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "floating-hearts-keyframes";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes floatUpAndFade {
            0% {
              transform: translate3d(0, 0, 0) scale(0.4) rotate(0deg);
              opacity: 0;
            }
            15% {
              opacity: 0.95;
              transform: translate3d(var(--drift-half), -20vh, 0) scale(1.1) rotate(var(--rot-half));
            }
            70% {
              opacity: 0.85;
              transform: translate3d(var(--drift-full), -65vh, 0) scale(1.0) rotate(var(--rot-full));
            }
            100% {
              transform: translate3d(var(--drift-full), -95vh, 0) scale(0.85) rotate(var(--rot-full));
              opacity: 0;
            }
          }
          .floating-heart-particle {
            position: absolute;
            bottom: 60px;
            pointer-events: none;
            user-select: none;
            animation-name: floatUpAndFade;
            animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
            animation-fill-mode: forwards;
            filter: drop-shadow(0 2px 8px rgba(244, 63, 94, 0.45));
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Generate particles when activated
  const hearts: FloatingHeartItem[] = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: count }).map((_, i) => ({
      id: i + Date.now(),
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
      leftPercent: 8 + Math.random() * 84, // 8% to 92%
      size: 18 + Math.floor(Math.random() * 16), // 18px to 34px
      duration: 2.8 + Math.random() * 1.2, // 2.8s to 4.0s
      delay: Math.random() * 0.9, // 0s to 0.9s
      driftX: -35 + Math.random() * 70, // -35px to +35px
      rotateDeg: -25 + Math.random() * 50, // -25deg to +25deg
    }));
  }, [active, count]);

  useEffect(() => {
    if (active) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 4200);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [active, onComplete]);

  if (!visible || hearts.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {hearts.map((h) => {
        if (Platform.OS === "web") {
          return (
            <span
              key={h.id}
              className="floating-heart-particle"
              style={
                {
                  left: `${h.leftPercent}%`,
                  fontSize: `${h.size}px`,
                  animationDuration: `${h.duration}s`,
                  animationDelay: `${h.delay}s`,
                  "--drift-half": `${h.driftX * 0.5}px`,
                  "--drift-full": `${h.driftX}px`,
                  "--rot-half": `${h.rotateDeg * 0.5}deg`,
                  "--rot-full": `${h.rotateDeg}deg`,
                } as any
              }
            >
              {h.emoji}
            </span>
          );
        }

        // Native mobile fallback
        return (
          <View
            key={h.id}
            style={[
              styles.nativeHeart,
              { left: `${h.leftPercent}%`, bottom: 80 },
            ]}
          >
            <Text style={{ fontSize: h.size }}>{h.emoji}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflow: "hidden",
  },
  nativeHeart: {
    position: "absolute",
    opacity: 0.85,
  },
});

export default FloatingHearts;
