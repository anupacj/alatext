import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Platform, useWindowDimensions } from "react-native";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";

export interface AppleIntelligenceGlowProps {
  visible: boolean;
  screenRadius?: number | string;
  duration?: number;
}

export const AppleIntelligenceGlow: React.FC<AppleIntelligenceGlowProps> = ({
  visible,
  screenRadius = 0,
}) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const width = winW || (typeof window !== "undefined" ? window.innerWidth : 400);
  const height = winH || (typeof window !== "undefined" ? window.innerHeight : 800);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const numericRadius =
    typeof screenRadius === "number"
      ? screenRadius
      : parseFloat(String(screenRadius)) ||
        (Platform.OS === "ios" ? 48 : Platform.OS === "android" ? 36 : width < 768 ? 40 : 20);

  // Synchronize visibility and pulsing with "Thinking of You" / love glow
  useEffect(() => {
    if (visible) {
      // Smooth luminous fade-in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: Platform.OS !== "web",
      }).start();

      // Subtle breathing pulse synchronized with romantic heartbeat
      pulseAnim.setValue(1);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.035,
            duration: 900,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.975,
            duration: 900,
            useNativeDriver: Platform.OS !== "web",
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }

    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, [visible, fadeAnim, pulseAnim]);

  if (width <= 0 || height <= 0) return null;

  const svgW = Math.max(width, 100);
  const svgH = Math.max(height, 100);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: fadeAnim,
          zIndex: 50,
          borderRadius: numericRadius,
          overflow: "hidden",
        },
      ]}
    >
      {/* Web Inset Box-Shadow Layer for deep diffuse edge bloom */}
      {Platform.OS === "web" && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: numericRadius,
              boxShadow:
                "inset 0 0 28px rgba(244, 63, 94, 0.65), inset 0 0 65px rgba(236, 72, 153, 0.45), inset 0 0 115px rgba(192, 132, 252, 0.28), inset 0 0 175px rgba(251, 113, 133, 0.16)",
              pointerEvents: "none",
            } as any,
          ]}
        />
      )}

      {/* SVG Layer with multi-layer concentric glowing strokes mapping exact perimeter */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Gradient 1: Top-Left to Bottom-Right (Pink, Coral, Rose, Violet) */}
            <LinearGradient id="pinkGlowGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#f43f5e" stopOpacity="1" />
              <Stop offset="25%" stopColor="#fda4af" stopOpacity="0.95" />
              <Stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
              <Stop offset="75%" stopColor="#e879f9" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
            </LinearGradient>

            {/* Gradient 2: Top-Right to Bottom-Left (Soft Blush, Neon Magenta, Warm Coral) */}
            <LinearGradient id="pinkGlowGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#fb7185" stopOpacity="1" />
              <Stop offset="30%" stopColor="#f472b6" stopOpacity="0.95" />
              <Stop offset="65%" stopColor="#ec4899" stopOpacity="1" />
              <Stop offset="100%" stopColor="#f43f5e" stopOpacity="1" />
            </LinearGradient>

            {/* Gradient 3: Soft ambient wash */}
            <LinearGradient id="pinkGlowGrad3" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#fda4af" stopOpacity="0.85" />
              <Stop offset="35%" stopColor="#f43f5e" stopOpacity="0.95" />
              <Stop offset="70%" stopColor="#d946ef" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>

          {/* Layer 1: Razor Edge (Perimeter alignment) */}
          <Rect
            x={2}
            y={2}
            width={svgW - 4}
            height={svgH - 4}
            rx={numericRadius}
            ry={numericRadius}
            stroke="url(#pinkGlowGrad1)"
            strokeWidth={4.5}
            fill="none"
            opacity={0.98}
          />

          {/* Layer 2: Radiant Inner Aura */}
          <Rect
            x={6}
            y={6}
            width={svgW - 12}
            height={svgH - 12}
            rx={Math.max(4, numericRadius - 4)}
            ry={Math.max(4, numericRadius - 4)}
            stroke="url(#pinkGlowGrad2)"
            strokeWidth={14}
            fill="none"
            opacity={0.72}
          />

          {/* Layer 3: Deep Diffuse Wash */}
          <Rect
            x={16}
            y={16}
            width={svgW - 32}
            height={svgH - 32}
            rx={Math.max(2, numericRadius - 12)}
            ry={Math.max(2, numericRadius - 12)}
            stroke="url(#pinkGlowGrad1)"
            strokeWidth={32}
            fill="none"
            opacity={0.42}
          />

          {/* Layer 4: Ambient Inward Bleed */}
          <Rect
            x={32}
            y={32}
            width={svgW - 64}
            height={svgH - 64}
            rx={Math.max(2, numericRadius - 22)}
            ry={Math.max(2, numericRadius - 22)}
            stroke="url(#pinkGlowGrad3)"
            strokeWidth={64}
            fill="none"
            opacity={0.22}
          />

          {/* Layer 5: Inward Soft Mist Spreading to Middle */}
          <Rect
            x={56}
            y={56}
            width={svgW - 112}
            height={svgH - 112}
            rx={Math.max(2, numericRadius - 36)}
            ry={Math.max(2, numericRadius - 36)}
            stroke="url(#pinkGlowGrad2)"
            strokeWidth={100}
            fill="none"
            opacity={0.1}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

export const ThinkingOfYouHalo = AppleIntelligenceGlow;
