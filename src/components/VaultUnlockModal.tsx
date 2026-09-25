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
import { ShieldCheck, Lock, X, Fingerprint, KeyRound } from "lucide-react-native";
import { useAlaPin } from "../context/AlaPinContext";
import { useTheme } from "../context/ThemeContext";

interface VaultUnlockModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function VaultUnlockModal({
  visible,
  onClose,
  onSuccess,
}: VaultUnlockModalProps) {
  const {
    realPin,
    decoyPin,
    isBiometricSupported,
    isBiometricEnabled,
    unlockVaultWithPin,
    unlockVaultWithBiometrics,
  } = useAlaPin();
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shakeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      setPin("");
      setErrorMsg("");
      // Auto-trigger biometric prompt if enabled & supported
      if (isBiometricSupported && isBiometricEnabled) {
        handleBiometricPrompt();
      }
    }
  }, [visible]);

  const handleBiometricPrompt = async () => {
    try {
      const success = await unlockVaultWithBiometrics();
      if (success) {
        onSuccess?.();
        onClose();
      }
    } catch {
      // ignore
    }
  };

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
          // If no AlaPin configured yet, any 4-digit or standard entry unlocks
          if (!realPin) {
            onSuccess?.();
            onClose();
            return;
          }

          const result = unlockVaultWithPin(newPin);
          if (result.success) {
            onSuccess?.();
            onClose();
          } else {
            triggerShake();
            setErrorMsg("Incorrect PIN. Please try again.");
            setPin("");
          }
        }, 120);
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isAmoled ? "#101014" : theme.surface }]}>
          {/* Header Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Icon & Title */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <Lock size={30} color="#a855f7" />
            </View>
            <Text style={[styles.title, { color: isAmoled ? "#ffffff" : theme.text }]}>
              Unlock Secret Vault
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {isBiometricSupported
                ? "Enter 4-digit AlaPin or use Fingerprint"
                : "Enter 4-digit AlaPin to reveal secret memories and notes"}
            </Text>
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
                      ? { backgroundColor: "#a855f7", borderColor: "#a855f7", transform: [{ scale: 1.15 }] }
                      : { backgroundColor: "transparent", borderColor: isAmoled ? "#444" : "rgba(150,150,150,0.4)" },
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Error Message */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : <View style={{ height: 18 }} />}

          {/* Keypad */}
          <View style={styles.keypad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.keyBtn, { backgroundColor: isAmoled ? "#18181f" : "rgba(0,0,0,0.04)" }]}
                onPress={() => handleKeyPress(num)}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyText, { color: isAmoled ? "#ffffff" : theme.text }]}>{num}</Text>
              </TouchableOpacity>
            ))}

            {isBiometricSupported ? (
              <TouchableOpacity
                style={[styles.keyBtn, styles.actionKeyBtn, { backgroundColor: "rgba(168, 85, 247, 0.18)" }]}
                onPress={handleBiometricPrompt}
                activeOpacity={0.7}
              >
                <Fingerprint size={28} color="#a855f7" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.keyBtn, styles.actionKeyBtn]}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionKeyText, { color: theme.textMuted }]}>CLR</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.keyBtn, { backgroundColor: isAmoled ? "#18181f" : "rgba(0,0,0,0.04)" }]}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    padding: 6,
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Josefin Sans",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    color: "#f43f5e",
    fontSize: 13,
    fontFamily: "Josefin Sans",
    fontWeight: "600",
    height: 18,
    marginBottom: 12,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 270,
    justifyContent: "space-between",
    gap: 14,
    marginTop: 6,
  },
  keyBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  actionKeyBtn: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  keyText: {
    fontSize: 22,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  actionKeyText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
});
