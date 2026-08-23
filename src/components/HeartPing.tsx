import React, { useEffect, useState } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, runOnJS } from "react-native-reanimated";
import { Heart } from "lucide-react-native";

const { width, height } = Dimensions.get("window");

export function HeartPing({ visible, onComplete }: { visible: boolean, onComplete: () => void }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsActive(true);
      opacity.value = 1;
      scale.value = withSequence(
        withSpring(1.5, { damping: 10, stiffness: 100 }),
        withTiming(1.2, { duration: 200 }),
        withSpring(2, { damping: 12, stiffness: 150 }),
        withTiming(1.8, { duration: 150 }),
        withSpring(15, { damping: 20, stiffness: 50 })
      );
      
      // Use setTimeout instead of Reanimated worklet callbacks to prevent Web crashes
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => {
          scale.value = 0;
          setIsActive(false);
          onComplete();
        }, 300);
      }, 1200);
    }
  }, [visible]);

  if (!isActive) return null;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <Heart size={80} color="#f23f43" fill="#f23f43" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  }
});
