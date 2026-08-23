import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";

export function HeartPing({ visible, onComplete }: { visible: boolean, onComplete: () => void }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsActive(true);
      setTimeout(() => {
        setIsActive(false);
        onComplete();
      }, 1500);
    }
  }, [visible]);

  if (!isActive) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Heart size={120} color="#f23f43" fill="#f23f43" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  }
});
