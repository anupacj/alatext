import React, { useEffect } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, withDelay } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const PARTICLES = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  delay: Math.random() * 5000,
  duration: 8000 + Math.random() * 4000,
  scale: 0.5 + Math.random() * 1.5,
}));

function Particle({ particle, type }: { particle: any, type: string }) {
  const translateY = useSharedValue(particle.y);
  const opacity = useSharedValue(0.1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(particle.y - height * 0.8, { duration: particle.duration, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: particle.duration * 0.2 }),
          withTiming(0.6, { duration: particle.duration * 0.6 }),
          withTiming(0, { duration: particle.duration * 0.2 })
        ),
        -1,
        false
      )
    );
    rotation.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(360, { duration: particle.duration, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: particle.x,
    top: translateY.value,
    opacity: opacity.value,
    transform: [
      { scale: particle.scale },
      { rotate: `${rotation.value}deg` }
    ],
  }));

  let content = "✨";
  if (type === "hearts") content = "💕";
  if (type === "stars") content = "⭐";
  if (type === "snow") content = "❄️";
  if (type === "petals") content = "🌸";

  return <Animated.Text style={[style, { fontSize: 24, pointerEvents: "none" }]}>{content}</Animated.Text>;
}

export function DoodleOverlay({ type }: { type: string }) {
  if (!type || type === "none") return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: "none", zIndex: 1 }]} pointerEvents="none">
      {PARTICLES.map(p => (
        <Particle key={p.id} particle={p} type={type} />
      ))}
    </Animated.View>
  );
}
