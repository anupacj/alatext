import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import { ShieldCheck, Lock, KeyRound, X } from "lucide-react-native";
import { useAlaPin } from "../context/AlaPinContext";
import { useTheme } from "../context/ThemeContext";

export default function AlaPinLockScreen() {
  const { isLocked, unlockWithPin, isPinEnabled } = useAlaPin();
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shakeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!isLocked) {
      setPin("");
      setErrorMsg("");
    }
  }, [isLocked]);

  if (!isPinEnabled || !isLocked) return null;

  const triggerShake = () => {
    if (Platform.OS !== "web") {
      Vibration.vibrate(200);
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMsg("");

      if (newPin.length === 4) {
        setTimeout(() => {
          const result = unlockWithPin(newPin);
          if (!result.success) {
            triggerShake();
            setErrorMsg("Incorrect AlaPin. Try again.");
            setPin("");
          }
        }, 100);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg("");
    }
  };

  const handleClear = () => {
    setPin("");
    setErrorMsg("");
  };

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: isAmoled ? "#000000" : theme.background }]}>
        {/* Top Header & Lock Icon */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: isAmoled ? "#1a1a1a" : theme.surface }]}>
            <ShieldCheck size={36} color={theme.accent} />
          </View>
          <Text style={[styles.title, { color: isAmoled ? "#ffffff" : theme.text }]}>AlaPin Protection</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Enter 4-Digit Passcode to Unlock</Text>
        </View>

        {/* 4 PIN Dots */}
        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isFilled
                    ? { backgroundColor: theme.accent, borderColor: theme.accent, scale: 1.1 }
                    : { backgroundColor: "transparent", borderColor: isAmoled ? "#444" : "rgba(150,150,150,0.4)" },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Error Message */}
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : <View style={{ height: 20 }} />}

        {/* Keypad */}
        <View style={styles.keypad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.keyBtn, { backgroundColor: isAmoled ? "#111111" : theme.surface }]}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, { color: isAmoled ? "#ffffff" : theme.text }]}>{num}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.keyBtn, styles.actionKeyBtn]}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionKeyText, { color: theme.textMuted }]}>CLR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keyBtn, { backgroundColor: isAmoled ? "#111111" : theme.surface }]}
            onPress={() => handleKeyPress("0")}
            activeOpacity={0.7}
          >
            <Text style={[styles.keyText, { color: isAmoled ? "#ffffff" : theme.text }]}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keyBtn, styles.actionKeyBtn]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <X size={22} color={isAmoled ? "#ffffff" : theme.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorText: {
    color: "#f43f5e",
    fontSize: 14,
    fontWeight: "600",
    height: 20,
    marginBottom: 16,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "space-between",
    gap: 16,
    marginTop: 10,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionKeyBtn: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  keyText: {
    fontSize: 24,
    fontWeight: "600",
  },
  actionKeyText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
