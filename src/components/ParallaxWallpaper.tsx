import React, { useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Image,
  Animated,
  Platform,
} from "react-native";

export interface ParallaxWallpaperProps {
  uri: string;
  zoom?: number;
  blur?: number;
  dim?: number;
  scrollY?: Animated.Value;
}

export const ParallaxWallpaper: React.FC<ParallaxWallpaperProps> = React.memo(({
  uri,
  zoom = 1,
  blur = 0,
  dim = 0,
  scrollY,
}) => {
  // Motion offsets for cursor and device tilt
  const motionAnimX = useRef(new Animated.Value(0)).current;
  const motionAnimY = useRef(new Animated.Value(0)).current;
  const defaultScrollY = useRef(new Animated.Value(0)).current;

  const activeScrollY = scrollY || defaultScrollY;

  // Scroll parallax translation: subtle 0.04x drift clamped to ±20px
  const scrollTranslateY = useMemo(() => {
    return activeScrollY.interpolate({
      inputRange: [-500, 0, 500],
      outputRange: [20, 0, -20],
      extrapolate: "clamp",
    });
  }, [activeScrollY]);

  // Combined vertical translation: mouse/tilt motion + scroll motion
  const totalTranslateY = useMemo(() => {
    return Animated.add(motionAnimY, scrollTranslateY);
  }, [motionAnimY, scrollTranslateY]);

  // Pre-buffer zoom so shifting by ±18px never reveals borders
  const baseScale = (zoom || 1) * 1.08;

  // Web mouse move and device orientation handlers
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let targetX = 0;
    let targetY = 0;

    // 1. Mouse/pointer movement on desktop web
    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width <= 0 || height <= 0) return;

      // Normalized coordinates: -1 to +1 from screen center
      const nx = (e.clientX - width / 2) / (width / 2);
      const ny = (e.clientY - height / 2) / (height / 2);

      // Subtle parallax shift (max ±16px) in opposite direction
      targetX = -Math.max(-1, Math.min(1, nx)) * 16;
      targetY = -Math.max(-1, Math.min(1, ny)) * 16;

      Animated.spring(motionAnimX, {
        toValue: targetX,
        friction: 9,
        tension: 35,
        useNativeDriver: true,
      }).start();

      Animated.spring(motionAnimY, {
        toValue: targetY,
        friction: 9,
        tension: 35,
        useNativeDriver: true,
      }).start();
    };

    const handlePointerLeave = () => {
      Animated.spring(motionAnimX, {
        toValue: 0,
        friction: 8,
        tension: 30,
        useNativeDriver: true,
      }).start();

      Animated.spring(motionAnimY, {
        toValue: 0,
        friction: 8,
        tension: 30,
        useNativeDriver: true,
      }).start();
    };

    // 2. Mobile device gyroscope tilt (where supported)
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      // gamma is left-to-right tilt in degrees [-90, 90], typical handheld range is [-30, 30]
      const clampedGamma = Math.max(-30, Math.min(30, e.gamma));
      // beta is front-to-back tilt in degrees [-180, 180], typical handheld reading is ~45 deg
      const clampedBeta = Math.max(-30, Math.min(30, e.beta - 45));

      targetX = -(clampedGamma / 30) * 16;
      targetY = -(clampedBeta / 30) * 16;

      Animated.spring(motionAnimX, {
        toValue: targetX,
        friction: 8,
        tension: 30,
        useNativeDriver: true,
      }).start();

      Animated.spring(motionAnimY, {
        toValue: targetY,
        friction: 8,
        tension: 30,
        useNativeDriver: true,
      }).start();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", handlePointerLeave, { passive: true });

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener("deviceorientation", handleDeviceOrientation);
      }
    };
  }, [motionAnimX, motionAnimY]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      <Animated.View
        style={[
          styles.innerOversize,
          {
            transform: [
              { translateX: motionAnimX },
              { translateY: totalTranslateY },
              { scale: baseScale },
            ],
          },
        ]}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={blur * 20}
        />
        {dim > 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(0,0,0,${dim})` },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  innerOversize: {
    position: "absolute",
    top: -24,
    left: -24,
    right: -24,
    bottom: -24,
  },
});

export default ParallaxWallpaper;
