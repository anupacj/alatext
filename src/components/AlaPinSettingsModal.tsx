import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { X, ShieldCheck, Lock, Eye, EyeOff, Check, KeyRound, AlertTriangle } from "lucide-react-native";
import { useAlaPin } from "../context/AlaPinContext";
import { useTheme } from "../context/ThemeContext";

interface AlaPinSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AlaPinSettingsModal({ visible, onClose }: AlaPinSettingsModalProps) {
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";
  const {
    isPinEnabled,
    realPin,
    decoyPin,
    setupRealPin,
    setupDecoyPin,
    togglePinEnabled,
    lockNow,
  } = useAlaPin();

  const [inputRealPin, setInputRealPin] = useState(realPin || "");
  const [inputDecoyPin, setInputDecoyPin] = useState(decoyPin || "");
  const [showPins, setShowPins] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggle = async (val: boolean) => {
    if (val && !realPin && inputRealPin.length !== 4) {
      alert("Please enter a 4-digit Real PIN first!");
      return;
    }
    await togglePinEnabled(val);
  };

  const handleSave = async () => {
    if (inputRealPin.length !== 4) {
      alert("Real PIN must be exactly 4 digits!");
      return;
    }
    if (inputDecoyPin && inputDecoyPin.length !== 4) {
      alert("Decoy PIN must be exactly 4 digits (or leave blank)!");
      return;
    }
    if (inputDecoyPin && inputDecoyPin === inputRealPin) {
      alert("Decoy PIN must be different from Real PIN!");
      return;
    }

    await setupRealPin(inputRealPin);
    await setupDecoyPin(inputDecoyPin || null);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  const handleLockAppNow = () => {
    onClose();
    setTimeout(() => {
      lockNow();
    }, 200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isAmoled ? "#111111" : theme.surface }]}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ShieldCheck size={22} color={theme.accent} />
              <Text style={[styles.title, { color: isAmoled ? "#ffffff" : theme.text }]}>
                AlaPin Passcode Security
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Enable Switch Row */}
          <View style={[styles.row, { borderColor: "rgba(255,255,255,0.08)" }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { color: isAmoled ? "#ffffff" : theme.text }]}>
                Enable AlaPin Protection
              </Text>
              <Text style={[styles.sublabel, { color: theme.textMuted }]}>
                Require 4-digit passcode to access app
              </Text>
            </View>
            <Switch
              value={isPinEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#444", true: theme.accent }}
              thumbColor="#ffffff"
            />
          </View>

          {/* REAL PIN FIELD */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: isAmoled ? "#dddddd" : theme.text }]}>
              🔑 Real Account PIN (4 Digits)
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isAmoled ? "#000" : theme.background }]}>
              <TextInput
                style={[styles.input, { color: isAmoled ? "#fff" : theme.text }]}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPins}
                placeholder="e.g. 1234"
                placeholderTextColor={theme.textMuted}
                value={inputRealPin}
                onChangeText={(t) => setInputRealPin(t.replace(/[^0-9]/g, ""))}
              />
              <TouchableOpacity onPress={() => setShowPins(!showPins)}>
                {showPins ? <EyeOff size={18} color={theme.textMuted} /> : <Eye size={18} color={theme.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* DECOY PIN FIELD */}
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.inputLabel, { color: isAmoled ? "#dddddd" : theme.text }]}>
                🎭 Decoy (Dummy) PIN (Optional)
              </Text>
            </View>
            <Text style={[styles.helperText, { color: theme.textMuted }]}>
              Entering this PIN unlocks a stealth empty workspace (0 chats, bare layout).
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isAmoled ? "#000" : theme.background }]}>
              <TextInput
                style={[styles.input, { color: isAmoled ? "#fff" : theme.text }]}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPins}
                placeholder="e.g. 9999"
                placeholderTextColor={theme.textMuted}
                value={inputDecoyPin}
                onChangeText={(t) => setInputDecoyPin(t.replace(/[^0-9]/g, ""))}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: savedSuccess ? "#22c55e" : theme.accent }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            {savedSuccess ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Check size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Saved Successfully!</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>Save AlaPin Settings</Text>
            )}
          </TouchableOpacity>

          {/* Lock App Now Button */}
          {isPinEnabled && realPin && (
            <TouchableOpacity style={styles.lockNowBtn} onPress={handleLockAppNow} activeOpacity={0.8}>
              <Lock size={16} color="#f43f5e" style={{ marginRight: 6 }} />
              <Text style={styles.lockNowBtnText}>Lock App Now</Text>
            </TouchableOpacity>
          )}
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
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  sublabel: {
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  helperText: {
    fontSize: 11,
    marginBottom: 8,
    fontStyle: "italic",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: "600",
  },
  saveBtn: {
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  lockNowBtn: {
    flexDirection: "row",
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(244,63,94,0.12)",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  lockNowBtnText: {
    color: "#f43f5e",
    fontSize: 14,
    fontWeight: "600",
  },
});
