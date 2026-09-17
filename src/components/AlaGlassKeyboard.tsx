import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Vibration,
  ScrollView,
  Animated,
} from "react-native";
import {
  ArrowUp,
  Delete,
  CornerDownLeft,
  Send,
  Heart,
  Smartphone,
  ChevronDown,
  Sparkles,
} from "lucide-react-native";

export interface AlaGlassKeyboardProps {
  onInsertText: (text: string) => void;
  onBackspace: () => void;
  onSend: () => void;
  onClose: () => void;
  onSwitchToSystem: () => void;
  theme: any;
  isAmoled: boolean;
}

const QUICK_PHRASES = [
  "I love you ❤️",
  "Hey 💕",
  "Miss you ✨",
  "On my way 🚀",
  "Good morning ☀️",
  "Goodnight 🌙",
  "Call me? 📞",
  "Thinking of you 🌸",
];

const HEART_CYCLE = ["❤️", "💖", "💕", "💗", "💘", "✨", "🫶"];

type KeyboardMode = "letters" | "numbers" | "symbols";

export const AlaGlassKeyboard: React.FC<AlaGlassKeyboardProps> = React.memo(({
  onInsertText,
  onBackspace,
  onSend,
  onClose,
  onSwitchToSystem,
  theme,
  isAmoled,
}) => {
  const [mode, setMode] = useState<KeyboardMode>("letters");
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const lastShiftPressRef = useRef<number>(0);
  const backspaceTimerRef = useRef<any>(null);
  const heartIndexRef = useRef<number>(0);

  const triggerHaptic = useCallback(() => {
    try {
      if (Platform.OS !== "web") {
        Vibration.vibrate(8);
      }
    } catch (e) {}
  }, []);

  const handleCharPress = useCallback((char: string) => {
    triggerHaptic();
    const finalChar = (isShift || isCapsLock) ? char.toUpperCase() : char.toLowerCase();
    onInsertText(finalChar);

    // If shift was on (and not caps lock), revert back to lowercase
    if (isShift && !isCapsLock) {
      setIsShift(false);
    }
  }, [isShift, isCapsLock, onInsertText, triggerHaptic]);

  const handleShiftPress = useCallback(() => {
    triggerHaptic();
    const now = Date.now();
    if (now - lastShiftPressRef.current < 350) {
      // Double tap -> toggle Caps Lock
      setIsCapsLock((prev) => !prev);
      setIsShift(false);
    } else {
      if (isCapsLock) {
        setIsCapsLock(false);
        setIsShift(false);
      } else {
        setIsShift((prev) => !prev);
      }
    }
    lastShiftPressRef.current = now;
  }, [isCapsLock, triggerHaptic]);

  const handleBackspaceStart = useCallback(() => {
    triggerHaptic();
    onBackspace();

    // Start long-press continuous delete after 350ms
    backspaceTimerRef.current = setInterval(() => {
      triggerHaptic();
      onBackspace();
    }, 90);
  }, [onBackspace, triggerHaptic]);

  const handleBackspaceEnd = useCallback(() => {
    if (backspaceTimerRef.current) {
      clearInterval(backspaceTimerRef.current);
      backspaceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (backspaceTimerRef.current) {
        clearInterval(backspaceTimerRef.current);
      }
    };
  }, []);

  const handleQuickPhrase = useCallback((phrase: string) => {
    triggerHaptic();
    onInsertText(phrase + " ");
  }, [onInsertText, triggerHaptic]);

  const handleHeartPress = useCallback(() => {
    triggerHaptic();
    const emoji = HEART_CYCLE[heartIndexRef.current % HEART_CYCLE.length];
    heartIndexRef.current += 1;
    onInsertText(emoji);
  }, [onInsertText, triggerHaptic]);

  const textColor = isAmoled
    ? "#ffffff"
    : theme.id === "pink"
    ? "#831843"
    : theme.text || "#f2f3f5";

  const keyBg = isAmoled
    ? "rgba(255, 255, 255, 0.10)"
    : theme.id === "pink"
    ? "rgba(255, 255, 255, 0.45)"
    : "rgba(255, 255, 255, 0.09)";

  const keyBorder = isAmoled
    ? "rgba(255, 255, 255, 0.14)"
    : theme.id === "pink"
    ? "rgba(244, 114, 182, 0.35)"
    : "rgba(255, 255, 255, 0.16)";

  const activeKeyBg = isAmoled
    ? "rgba(255, 255, 255, 0.28)"
    : theme.id === "pink"
    ? "rgba(244, 114, 182, 0.40)"
    : "rgba(88, 101, 242, 0.35)";

  const renderKey = (label: string, value?: string, flex = 1) => {
    const displayVal = value || label;
    const isSpecialChar = displayVal.length > 1;
    const transformedLabel = (!isSpecialChar && (isShift || isCapsLock)) ? label.toUpperCase() : label.toLowerCase();

    return (
      <Pressable
        key={label}
        style={({ pressed }) => [
          styles.key,
          {
            flex,
            backgroundColor: pressed ? activeKeyBg : keyBg,
            borderColor: keyBorder,
          },
        ]}
        onPress={() => handleCharPress(displayVal)}
      >
        <Text style={[styles.keyText, { color: textColor }]}>
          {transformedLabel}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.keyboardContainer,
        isAmoled
          ? { backgroundColor: "rgba(10, 10, 12, 0.85)", borderTopColor: "rgba(255, 255, 255, 0.12)" }
          : theme.id === "pink"
          ? { backgroundColor: "rgba(253, 242, 248, 0.82)", borderTopColor: "rgba(244, 114, 182, 0.3)" }
          : { backgroundColor: "rgba(20, 22, 28, 0.82)", borderTopColor: "rgba(255, 255, 255, 0.12)" },
      ]}
    >
      {/* 1. Quick Phrases & Keyboard Switcher Bar */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPhrasesList}
        >
          {QUICK_PHRASES.map((phrase) => (
            <TouchableOpacity
              key={phrase}
              style={[styles.quickChip, { borderColor: keyBorder, backgroundColor: keyBg }]}
              onPress={() => handleQuickPhrase(phrase)}
            >
              <Text style={[styles.quickChipText, { color: textColor }]}>{phrase}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Top Control Buttons */}
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.topActionBtn, { backgroundColor: keyBg, borderColor: keyBorder }]}
            onPress={onSwitchToSystem}
            accessibilityLabel="Switch to system keyboard"
          >
            <Smartphone size={15} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topActionBtn, { backgroundColor: keyBg, borderColor: keyBorder }]}
            onPress={onClose}
            accessibilityLabel="Dismiss glass keyboard"
          >
            <ChevronDown size={17} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Main Keypad Rows */}
      {mode === "letters" && (
        <View style={styles.keysSection}>
          {/* Row 1 */}
          <View style={styles.row}>
            {["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"].map((l) => renderKey(l))}
          </View>

          {/* Row 2 */}
          <View style={[styles.row, { paddingHorizontal: 16 }]}>
            {["a", "s", "d", "f", "g", "h", "j", "k", "l"].map((l) => renderKey(l))}
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            {/* Shift Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                {
                  flex: 1.4,
                  backgroundColor: isCapsLock || isShift ? activeKeyBg : (pressed ? activeKeyBg : keyBg),
                  borderColor: isCapsLock ? (theme.accent || "#f43f5e") : keyBorder,
                },
              ]}
              onPress={handleShiftPress}
            >
              <ArrowUp
                size={18}
                color={isCapsLock ? (theme.accent || "#f43f5e") : textColor}
                strokeWidth={isCapsLock ? 3 : 2}
              />
            </Pressable>

            {["z", "x", "c", "v", "b", "n", "m"].map((l) => renderKey(l))}

            {/* Backspace Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1.4, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPressIn={handleBackspaceStart}
              onPressOut={handleBackspaceEnd}
            >
              <Delete size={19} color={textColor} />
            </Pressable>
          </View>

          {/* Row 4 (Bottom) */}
          <View style={styles.row}>
            {/* 123 Toggle */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1.4, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={() => {
                triggerHaptic();
                setMode("numbers");
              }}
            >
              <Text style={[styles.specialKeyText, { color: textColor }]}>123</Text>
            </Pressable>

            {/* Heart Quick Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={handleHeartPress}
            >
              <Heart size={18} color="#f43f5e" fill="#f43f5e" />
            </Pressable>

            {/* Space Bar */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                { flex: 4.2, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={() => handleCharPress(" ")}
            >
              <Text style={[styles.spaceKeyText, { color: textColor }]}>space</Text>
            </Pressable>

            {/* Period */}
            {renderKey(".", ".", 1)}

            {/* Send Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                {
                  flex: 1.5,
                  backgroundColor: pressed ? (theme.accent || "#f43f5e") : (theme.accent || "#f43f5e"),
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                triggerHaptic();
                onSend();
              }}
            >
              <Send size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* 3. Numbers & Symbols Keypad */}
      {(mode === "numbers" || mode === "symbols") && (
        <View style={styles.keysSection}>
          {/* Row 1 */}
          <View style={styles.row}>
            {(mode === "numbers"
              ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]
              : ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="]
            ).map((ch) => renderKey(ch))}
          </View>

          {/* Row 2 */}
          <View style={styles.row}>
            {(mode === "numbers"
              ? ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""]
              : ["_", "\\", "|", "~", "<", ">", "$", "€", "£", "•"]
            ).map((ch) => renderKey(ch))}
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            {/* Toggle between #+= and 123 */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1.5, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={() => {
                triggerHaptic();
                setMode(mode === "numbers" ? "symbols" : "numbers");
              }}
            >
              <Text style={[styles.specialKeyText, { color: textColor }]}>
                {mode === "numbers" ? "#+=" : "123"}
              </Text>
            </Pressable>

            {(mode === "numbers"
              ? [".", ",", "?", "!", "'"]
              : [".", ",", "?", "!", "`"]
            ).map((ch) => renderKey(ch))}

            {/* Backspace Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1.5, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPressIn={handleBackspaceStart}
              onPressOut={handleBackspaceEnd}
            >
              <Delete size={19} color={textColor} />
            </Pressable>
          </View>

          {/* Row 4 (Bottom) */}
          <View style={styles.row}>
            {/* ABC Toggle */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                { flex: 1.5, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={() => {
                triggerHaptic();
                setMode("letters");
              }}
            >
              <Text style={[styles.specialKeyText, { color: textColor }]}>ABC</Text>
            </Pressable>

            {/* Space Bar */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                { flex: 5, backgroundColor: pressed ? activeKeyBg : keyBg, borderColor: keyBorder },
              ]}
              onPress={() => handleCharPress(" ")}
            >
              <Text style={[styles.spaceKeyText, { color: textColor }]}>space</Text>
            </Pressable>

            {/* Send Key */}
            <Pressable
              style={({ pressed }) => [
                styles.key,
                {
                  flex: 1.5,
                  backgroundColor: theme.accent || "#f43f5e",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                triggerHaptic();
                onSend();
              }}
            >
              <Send size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  keyboardContainer: {
    width: "100%",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    paddingHorizontal: 5,
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.28)",
      } as any,
    }),
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  quickPhrasesList: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keysSection: {
    width: "100%",
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 5,
  },
  key: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 5px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22)",
        transition: "all 0.08s ease-out",
        userSelect: "none",
        cursor: "pointer",
      } as any,
      default: {
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
    }),
  },
  specialKey: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  keyText: {
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  specialKeyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  spaceKeyText: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.75,
  },
});
