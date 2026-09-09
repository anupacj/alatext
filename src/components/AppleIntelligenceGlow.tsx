import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Platform, useWindowDimensions } from "react-native";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";

interface AppleIntelligenceGlowProps {
  visible: boolean;
  duration?: number;
}

export const AppleIntelligenceGlow: React.FC<AppleIntelligenceGlowProps> = ({
  visible,
  duration = 3200,
}) => {
  const { width, height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Dynamic corner radius to match device curves
  const cornerRadius = Platform.OS === "ios" ? 50 : (Platform.OS === "android" ? 38 : (width < 768 ? 44 : 24));

  useEffect(() => {
    if (visible) {
      // Fade in smoothly
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: Platform.OS !== "web",
      }).start();

      // Breathing / luminous pulse animation
      pulseAnim.setValue(1);
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.94,
            duration: 900,
            useNativeDriver: Platform.OS !== "web",
          }),
        ])
      );
      loopRef.current.start();
    } else {
      if (loopRef.current) loopRef.current.stop();
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }

    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [visible, fadeAnim, pulseAnim]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: fadeAnim,
          zIndex: 9999,
          overflow: "hidden",
        },
      ]}
    >
      {/* Web Inset Box-Shadow Layer for extra diffuse bloom */}
      {Platform.OS === "web" && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: cornerRadius,
              boxShadow:
                "inset 0 0 25px rgba(244, 63, 94, 0.45), inset 0 0 65px rgba(236, 72, 153, 0.32), inset 0 0 110px rgba(192, 132, 252, 0.2), inset 0 0 160px rgba(251, 113, 133, 0.12)",
            } as any,
          ]}
        />
      )}

      {/* SVG Layer with multi-layer concentric strokes mapping exact device curves */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
              <Stop offset="0%" stopColor="#fda4af" stopOpacity="0.8" />
              <Stop offset="35%" stopColor="#f43f5e" stopOpacity="0.9" />
              <Stop offset="70%" stopColor="#d946ef" stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
            </LinearGradient>
          </Defs>

          {/* Layer 1: Razor Edge (Perimeter alignment) */}
          <Rect
            x={2}
            y={2}
            width={width - 4}
            height={height - 4}
            rx={cornerRadius}
            ry={cornerRadius}
            stroke="url(#pinkGlowGrad1)"
            strokeWidth={4}
            fill="none"
            opacity={0.95}
          />

          {/* Layer 2: Radiant Inner Aura */}
          <Rect
            x={6}
            y={6}
            width={width - 12}
            height={height - 12}
            rx={Math.max(4, cornerRadius - 4)}
            ry={Math.max(4, cornerRadius - 4)}
            stroke="url(#pinkGlowGrad2)"
            strokeWidth={12}
            fill="none"
            opacity={0.65}
          />

          {/* Layer 3: Deep Diffuse Wash */}
          <Rect
            x={16}
            y={16}
            width={width - 32}
            height={height - 32}
            rx={Math.max(2, cornerRadius - 12)}
            ry={Math.max(2, cornerRadius - 12)}
            stroke="url(#pinkGlowGrad1)"
            strokeWidth={28}
            fill="none"
            opacity={0.38}
          />

          {/* Layer 4: Ambient Inward Bleed */}
          <Rect
            x={32}
            y={32}
            width={width - 64}
            height={height - 64}
            rx={Math.max(2, cornerRadius - 22)}
            ry={Math.max(2, cornerRadius - 22)}
            stroke="url(#pinkGlowGrad3)"
            strokeWidth={56}
            fill="none"
            opacity={0.18}
          />

          {/* Layer 5: Inward Soft Mist Spreading to Middle */}
          <Rect
            x={56}
            y={56}
            width={width - 112}
            height={height - 112}
            rx={Math.max(2, cornerRadius - 36)}
            ry={Math.max(2, cornerRadius - 36)}
            stroke="url(#pinkGlowGrad2)"
            strokeWidth={90}
            fill="none"
            opacity={0.08}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};
