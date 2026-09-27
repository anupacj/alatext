import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Platform, useWindowDimensions } from "react-native";
import Svg, { Rect, Defs, RadialGradient, Stop, Mask, G } from "react-native-svg";

export interface AppleIntelligenceGlowProps {
  visible: boolean;
  screenRadius?: number | string;
  duration?: number;
}

const HALO_BOX_SHADOW =
  "inset 30px 30px 70px -15px #E0507A, inset -30px 30px 70px -15px #F06B9C, inset 30px -30px 70px -15px #C9418F, inset -30px -30px 70px -15px #F4A0C0, inset 0 0 40px -5px #E85C93";

export const AppleIntelligenceGlow: React.FC<AppleIntelligenceGlowProps> = ({
  visible,
  screenRadius = 0,
}) => {
  const { width, height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.55)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Sync Web CSS variable --screen-radius and inject pulse keyframes
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const radiusVal = typeof screenRadius === "number" ? `${screenRadius}px` : String(screenRadius);
      document.documentElement.style.setProperty("--screen-radius", radiusVal);

      const styleId = "thinking-halo-keyframes";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes haloPulse {
            0%   { opacity: 0.55; }
            100% { opacity: 0.9; }
          }
          .halo {
            position: absolute;
            inset: 0;
            border-radius: var(--screen-radius, 0px);
            pointer-events: none;
            box-shadow:
              inset 30px 30px 70px -15px #E0507A,
              inset -30px 30px 70px -15px #F06B9C,
              inset 30px -30px 70px -15px #C9418F,
              inset -30px -30px 70px -15px #F4A0C0,
              inset 0 0 40px -5px #E85C93;
            animation: haloPulse 4s ease-in-out infinite alternate;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, [screenRadius]);

  // Synchronize visibility and pulsing with "Thinking of You"
  useEffect(() => {
    if (visible) {
      // Smooth fade-in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: Platform.OS !== "web",
      }).start();

      // 4s alternate pulse (0.55 -> 0.9 -> 0.55)
      pulseAnim.setValue(0.55);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 2000,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.55,
            duration: 2000,
            useNativeDriver: Platform.OS !== "web",
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }

    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, [visible, fadeAnim, pulseAnim]);

  if (width <= 0 || height <= 0) return null;

  const numericRadius = typeof screenRadius === "number" ? screenRadius : parseFloat(String(screenRadius)) || 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: fadeAnim,
          zIndex: 9999,
          borderRadius: screenRadius as any,
          overflow: "hidden",
        },
      ]}
    >
      {Platform.OS === "web" ? (
        // Web: Pure CSS layered inset box-shadow adhering to exact specification
        <View
          // @ts-ignore className for Web
          className="halo"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: screenRadius as any,
              boxShadow: HALO_BOX_SHADOW,
              pointerEvents: "none",
            } as any,
          ]}
        />
      ) : (
        // Native (iOS/Android): Box-shadow or RadialGradient inside Mask using the exact same shared radius
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: pulseAnim,
              borderRadius: numericRadius,
              boxShadow: HALO_BOX_SHADOW,
            } as any,
          ]}
        >
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <Mask id="haloMask">
                <Rect x={0} y={0} width={width} height={height} rx={numericRadius} ry={numericRadius} fill="#ffffff" />
              </Mask>
              <RadialGradient id="roseTL" cx="0%" cy="0%" r="50%">
                <Stop offset="0%" stopColor="#E0507A" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#E0507A" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="pinkTR" cx="100%" cy="0%" r="50%">
                <Stop offset="0%" stopColor="#F06B9C" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#F06B9C" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="plumBL" cx="0%" cy="100%" r="50%">
                <Stop offset="0%" stopColor="#C9418F" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#C9418F" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="blushBR" cx="100%" cy="100%" r="50%">
                <Stop offset="0%" stopColor="#F4A0C0" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#F4A0C0" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="ambientCenter" cx="50%" cy="50%" r="70%">
                <Stop offset="60%" stopColor="#E85C93" stopOpacity="0" />
                <Stop offset="100%" stopColor="#E85C93" stopOpacity="0.45" />
              </RadialGradient>
            </Defs>
            <G mask="url(#haloMask)">
              <Rect x={0} y={0} width={width} height={height} fill="url(#roseTL)" />
              <Rect x={0} y={0} width={width} height={height} fill="url(#pinkTR)" />
              <Rect x={0} y={0} width={width} height={height} fill="url(#plumBL)" />
              <Rect x={0} y={0} width={width} height={height} fill="url(#blushBR)" />
              <Rect x={0} y={0} width={width} height={height} fill="url(#ambientCenter)" />
            </G>
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export const ThinkingOfYouHalo = AppleIntelligenceGlow;
