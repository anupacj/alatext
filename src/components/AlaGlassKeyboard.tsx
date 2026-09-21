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
  PanResponder,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle } from "react-native-svg";
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
import { resolveSlideWord, getKeyAtCoordinate } from "../lib/slideTyping";

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

interface GlassKeyProps {
  label?: string;
  displayContent?: React.ReactNode;
  flex?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  isSpecial?: boolean;
  isActive?: boolean;
  isSlideHighlighted?: boolean;
  activeBorderColor?: string;
  customStyle?: any;
  textColor: string;
  keyBg: string;
  keyBorder: string;
  activeKeyBg: string;
  glowColor: string;
  glowBorder: string;
}

const GlassKey: React.FC<GlassKeyProps> = ({
  label,
  displayContent,
  flex = 1,
  onPress,
  onPressIn,
  onPressOut,
  isSpecial,
  isActive = false,
  isSlideHighlighted = false,
  activeBorderColor,
  customStyle,
  textColor,
  keyBg,
  keyBorder,
  activeKeyBg,
  glowColor,
  glowBorder,
}) => {
  const glowAnim = useRef(new Animated.Value((isActive || isSlideHighlighted) ? 1 : 0)).current;
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: (isActive || isSlideHighlighted) ? 1 : 0,
      duration: isSlideHighlighted ? 60 : 180,
      useNativeDriver: false,
    }).start();
  }, [isActive, isSlideHighlighted]);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 40,
      useNativeDriver: false,
    }).start();
    onPressIn?.();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    if (!isActive && !isSlideHighlighted) {
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 320, // Subtle, smooth fading glow!
        useNativeDriver: false,
      }).start();
    }
    onPressOut?.();
  };

  const isLit = isPressed || isActive || isSlideHighlighted;

  return (
    <Pressable
      style={[
        styles.key,
        isSpecial && styles.specialKey,
        {
          flex,
          backgroundColor: isLit ? activeKeyBg : keyBg,
          borderColor: isLit ? (activeBorderColor || glowBorder) : keyBorder,
          ...(Platform.OS === "web" ? {
            boxShadow: isLit
              ? `0 0 16px ${glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.45)`
              : "0 2px 5px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22)",
            transition: "background-color 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.28s ease, box-shadow 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.08s ease",
            transform: isPressed ? "scale(0.95)" : "scale(1)",
          } : {}),
        },
        customStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Native smooth fading glow layer */}
      {Platform.OS !== "web" && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 8,
              backgroundColor: glowColor,
              borderWidth: 1,
              borderColor: glowBorder,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.65],
              }),
            },
          ]}
        />
      )}
      {displayContent ? (
        displayContent
      ) : (
        <Text style={[isSpecial ? styles.specialKeyText : styles.keyText, { color: textColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return `rgba(88, 101, 242, ${alpha})`;
  }
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return `rgba(88, 101, 242, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface GlassChipProps {
  label: string;
  onPress: () => void;
  textColor: string;
  keyBg: string;
  keyBorder: string;
  activeKeyBg: string;
  glowColor: string;
  glowBorder: string;
}

const GlassChip: React.FC<GlassChipProps> = ({
  label,
  onPress,
  textColor,
  keyBg,
  keyBorder,
  activeKeyBg,
  glowColor,
  glowBorder,
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 40,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      style={[
        styles.quickChip,
        {
          borderColor: isPressed ? glowBorder : keyBorder,
          backgroundColor: isPressed ? activeKeyBg : keyBg,
          ...(Platform.OS === "web" ? {
            boxShadow: isPressed
              ? `0 0 12px ${glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.4)`
              : "0 1px 3px rgba(0,0,0,0.12)",
            transition: "background-color 0.28s ease, border-color 0.28s ease, box-shadow 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.08s ease",
            transform: isPressed ? "scale(0.95)" : "scale(1)",
            userSelect: "none",
            cursor: "pointer",
          } : {}),
        },
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {Platform.OS !== "web" && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 14,
              backgroundColor: glowColor,
              borderWidth: 1,
              borderColor: glowBorder,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.6],
              }),
            },
          ]}
        />
      )}
      <Text style={[styles.quickChipText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
};

interface GlassIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  keyBg: string;
  keyBorder: string;
  activeKeyBg: string;
  glowColor: string;
  glowBorder: string;
}

const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  keyBg,
  keyBorder,
  activeKeyBg,
  glowColor,
  glowBorder,
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 40,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      style={[
        styles.topActionBtn,
        {
          backgroundColor: isPressed ? activeKeyBg : keyBg,
          borderColor: isPressed ? glowBorder : keyBorder,
          ...(Platform.OS === "web" ? {
            boxShadow: isPressed
              ? `0 0 12px ${glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.4)`
              : "0 1px 3px rgba(0,0,0,0.12)",
            transition: "background-color 0.28s ease, border-color 0.28s ease, box-shadow 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.08s ease",
            transform: isPressed ? "scale(0.92)" : "scale(1)",
            userSelect: "none",
            cursor: "pointer",
          } : {}),
        },
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
    >
      {Platform.OS !== "web" && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 14,
              backgroundColor: glowColor,
              borderWidth: 1,
              borderColor: glowBorder,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.6],
              }),
            },
          ]}
        />
      )}
      {icon}
    </Pressable>
  );
};

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

  // Slide Typing (Gesture / Glide Typing) state
  const [isSlideTyping, setIsSlideTyping] = useState(true);
  const [activeSlideKey, setActiveSlideKey] = useState<string | null>(null);
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);
  const [slidePreviewWord, setSlidePreviewWord] = useState<string | null>(null);

  const isSlidingRef = useRef(false);
  const slideKeysRef = useRef<string[]>([]);
  const keysSectionRef = useRef<View>(null);
  const keypadDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const keysOffsetRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });

  const updateSectionOffset = useCallback(() => {
    keysSectionRef.current?.measure((x, y, width, height, pageX, pageY) => {
      if (width > 0 && height > 0) {
        keypadDimensionsRef.current = { width, height };
        keysOffsetRef.current = { pageX, pageY };
      }
    });
  }, []);

  const triggerHaptic = useCallback((type: "light" | "medium" | "heavy" = "light") => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(type === "heavy" ? 22 : (type === "medium" ? 14 : 8));
        }
      } else {
        if (type === "heavy") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => Vibration.vibrate(20));
        } else if (type === "medium") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => Vibration.vibrate(12));
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => Vibration.vibrate(8));
        }
      }
    } catch (e) {
      try {
        Vibration.vibrate(8);
      } catch (err) {}
    }
  }, []);

  const slidePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return isSlideTyping && mode === "letters" && Math.hypot(gestureState.dx, gestureState.dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return isSlideTyping && mode === "letters" && Math.hypot(gestureState.dx, gestureState.dy) > 10;
      },
      onPanResponderGrant: (evt) => {
        isSlidingRef.current = true;
        slideKeysRef.current = [];
        updateSectionOffset();

        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX - (keysOffsetRef.current.pageX || 0);
        const y = pageY - (keysOffsetRef.current.pageY || 0);

        setTrailPoints([{ x, y }]);

        const key = getKeyAtCoordinate(x, y, keypadDimensionsRef.current.width, keypadDimensionsRef.current.height);
        if (key) {
          slideKeysRef.current = [key];
          setActiveSlideKey(key);
          setSlidePreviewWord(key);
          triggerHaptic();
        }
      },
      onPanResponderMove: (evt) => {
        if (!isSlidingRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX - (keysOffsetRef.current.pageX || 0);
        const y = pageY - (keysOffsetRef.current.pageY || 0);

        setTrailPoints((prev) => {
          const next = [...prev, { x, y }];
          return next.length > 22 ? next.slice(next.length - 22) : next;
        });

        const key = getKeyAtCoordinate(x, y, keypadDimensionsRef.current.width, keypadDimensionsRef.current.height);
        if (key) {
          const lastKey = slideKeysRef.current[slideKeysRef.current.length - 1];
          if (key !== lastKey) {
            slideKeysRef.current.push(key);
            setActiveSlideKey(key);
            triggerHaptic();
            const candidate = resolveSlideWord(slideKeysRef.current);
            setSlidePreviewWord(candidate);
          }
        }
      },
      onPanResponderRelease: () => {
        if (!isSlidingRef.current) return;
        isSlidingRef.current = false;
        setActiveSlideKey(null);

        const keys = slideKeysRef.current;
        if (keys.length >= 2) {
          const word = resolveSlideWord(keys);
          if (word) {
            triggerHaptic("heavy");
            onInsertText(word + " ");
          }
        }

        setSlidePreviewWord(null);
        setTimeout(() => {
          setTrailPoints([]);
        }, 120);
      },
      onPanResponderTerminate: () => {
        isSlidingRef.current = false;
        setActiveSlideKey(null);
        setSlidePreviewWord(null);
        setTrailPoints([]);
      },
    })
  ).current;

  const handleCharPress = useCallback((char: string) => {
    triggerHaptic();
    const finalChar = (isShift || isCapsLock) ? char.toUpperCase() : char.toLowerCase();
    onInsertText(finalChar);

    if (isShift && !isCapsLock) {
      setIsShift(false);
    }
  }, [isShift, isCapsLock, onInsertText, triggerHaptic]);

  const handleShiftPress = useCallback(() => {
    triggerHaptic();
    const now = Date.now();
    if (now - lastShiftPressRef.current < 350) {
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
    triggerHaptic("medium");
    onBackspace();

    backspaceTimerRef.current = setInterval(() => {
      triggerHaptic("medium");
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
    triggerHaptic("medium");
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
    ? "rgba(255, 255, 255, 0.06)"
    : theme.id === "pink"
    ? "rgba(255, 255, 255, 0.45)"
    : "rgba(255, 255, 255, 0.09)";

  const keyBorder = isAmoled
    ? "rgba(255, 255, 255, 0.10)"
    : theme.id === "pink"
    ? "rgba(244, 114, 182, 0.35)"
    : "rgba(255, 255, 255, 0.15)";

  const activeKeyBg = isAmoled
    ? "rgba(255, 255, 255, 0.22)"
    : theme.id === "pink"
    ? "rgba(244, 114, 182, 0.42)"
    : hexToRgba(theme.accent || "#5865F2", 0.35);

  const glowColor = isAmoled
    ? "rgba(168, 85, 247, 0.55)"
    : theme.id === "pink"
    ? "rgba(244, 63, 94, 0.50)"
    : theme.id === "hacker"
    ? "rgba(74, 222, 128, 0.55)"
    : hexToRgba(theme.accent || "#5865F2", 0.55);

  const glowBorder = isAmoled
    ? "#a855f7"
    : theme.id === "pink"
    ? "rgba(244, 63, 94, 0.75)"
    : theme.id === "hacker"
    ? "rgba(74, 222, 128, 0.85)"
    : hexToRgba(theme.accent || "#5865F2", 0.85);

  const renderKey = (label: string, value?: string, flex = 1) => {
    const displayVal = value || label;
    const isSpecialChar = displayVal.length > 1;
    const transformedLabel = (!isSpecialChar && (isShift || isCapsLock)) ? label.toUpperCase() : label.toLowerCase();
    const isSlideActive = activeSlideKey === label.toLowerCase();

    return (
      <GlassKey
        key={label}
        label={transformedLabel}
        flex={flex}
        isSlideHighlighted={isSlideActive}
        onPress={() => handleCharPress(displayVal)}
        textColor={textColor}
        keyBg={keyBg}
        keyBorder={keyBorder}
        activeKeyBg={activeKeyBg}
        glowColor={glowColor}
        glowBorder={glowBorder}
      />
    );
  };

  return (
    <View
      style={[
        styles.keyboardContainer,
        isAmoled
          ? {
              backgroundColor: "#000000",
              borderTopColor: "rgba(255, 255, 255, 0.08)",
              ...(Platform.OS === "web" ? {
                boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.95)",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
              } as any : {}),
            }
          : theme.id === "pink"
          ? { backgroundColor: "rgba(253, 242, 248, 0.86)", borderTopColor: "rgba(244, 114, 182, 0.35)" }
          : { backgroundColor: "rgba(18, 20, 26, 0.86)", borderTopColor: "rgba(255, 255, 255, 0.12)" },
      ]}
    >
      {/* 1. Quick Phrases & Keyboard Switcher Bar */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPhrasesList}
        >
          {/* Slide Typing Toggle Chip */}
          <Pressable
            style={[
              styles.quickChip,
              {
                borderColor: isSlideTyping ? glowBorder : keyBorder,
                backgroundColor: isSlideTyping ? activeKeyBg : keyBg,
                borderWidth: isSlideTyping ? 1.5 : 1,
              },
            ]}
            onPress={() => {
              triggerHaptic();
              setIsSlideTyping((prev) => !prev);
            }}
          >
            <Text
              style={[
                styles.quickChipText,
                {
                  color: isSlideTyping ? (isAmoled ? "#ffffff" : (theme.accent || textColor)) : textColor,
                  fontWeight: "700",
                },
              ]}
            >
              {isSlideTyping ? "✨ Slide ON" : "✨ Slide OFF"}
            </Text>
          </Pressable>

          {QUICK_PHRASES.map((phrase) => (
            <GlassChip
              key={phrase}
              label={phrase}
              onPress={() => handleQuickPhrase(phrase)}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />
          ))}
        </ScrollView>

        {/* Top Control Buttons */}
        <View style={styles.topActions}>
          <GlassIconButton
            icon={<Smartphone size={15} color={textColor} />}
            onPress={onSwitchToSystem}
            accessibilityLabel="Switch to system keyboard"
            keyBg={keyBg}
            keyBorder={keyBorder}
            activeKeyBg={activeKeyBg}
            glowColor={glowColor}
            glowBorder={glowBorder}
          />
          <GlassIconButton
            icon={<ChevronDown size={17} color={textColor} />}
            onPress={onClose}
            accessibilityLabel="Dismiss glass keyboard"
            keyBg={keyBg}
            keyBorder={keyBorder}
            activeKeyBg={activeKeyBg}
            glowColor={glowColor}
            glowBorder={glowBorder}
          />
        </View>
      </View>

      {/* 2. Main Keypad Rows */}
      {mode === "letters" && (
        <View
          ref={keysSectionRef}
          onLayout={(e) => {
            keypadDimensionsRef.current = {
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
            updateSectionOffset();
          }}
          {...(isSlideTyping ? slidePanResponder.panHandlers : {})}
          style={[styles.keysSection, { position: "relative" }]}
        >
          {/* Luminous Ribbon Trail following finger during slide typing */}
          {trailPoints.length >= 2 && (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                d={trailPoints.reduce(
                  (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
                  ""
                )}
                stroke={glowBorder}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.85}
              />
              <Circle
                cx={trailPoints[trailPoints.length - 1].x}
                cy={trailPoints[trailPoints.length - 1].y}
                r={7}
                fill={glowColor}
                opacity={0.9}
              />
            </Svg>
          )}

          {/* Floating Candidate Word Preview Pill */}
          {slidePreviewWord && trailPoints.length > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.slidePreviewPill,
                {
                  left: Math.max(8, Math.min(trailPoints[trailPoints.length - 1].x - 36, (keypadDimensionsRef.current.width || 300) - 72)),
                  top: Math.max(-36, trailPoints[trailPoints.length - 1].y - 50),
                  borderColor: glowBorder,
                  backgroundColor: isAmoled ? "rgba(18, 18, 22, 0.96)" : "rgba(30, 32, 40, 0.94)",
                },
              ]}
            >
              <Text style={[styles.slidePreviewText, { color: "#ffffff" }]}>
                {slidePreviewWord}
              </Text>
            </View>
          )}

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
            {/* Shift Key with illuminated state */}
            <GlassKey
              flex={1.4}
              isSpecial
              isActive={isShift || isCapsLock}
              activeBorderColor={isCapsLock ? (theme.accent || "#f43f5e") : glowBorder}
              onPress={handleShiftPress}
              displayContent={
                <ArrowUp
                  size={18}
                  color={isCapsLock ? (theme.accent || "#f43f5e") : (isShift ? glowBorder : textColor)}
                  strokeWidth={isCapsLock ? 3 : 2}
                />
              }
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {["z", "x", "c", "v", "b", "n", "m"].map((l) => renderKey(l))}

            {/* Backspace Key with hold-to-repeat */}
            <GlassKey
              flex={1.4}
              isSpecial
              onPressIn={handleBackspaceStart}
              onPressOut={handleBackspaceEnd}
              displayContent={<Delete size={19} color={textColor} />}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />
          </View>

          {/* Row 4 (Bottom) */}
          <View style={styles.row}>
            {/* 123 Toggle */}
            <GlassKey
              flex={1.4}
              isSpecial
              label="123"
              onPress={() => {
                triggerHaptic();
                setMode("numbers");
              }}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {/* Heart Quick Key */}
            <GlassKey
              flex={1}
              isSpecial
              onPress={handleHeartPress}
              displayContent={<Heart size={18} color="#f43f5e" fill="#f43f5e" />}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor="rgba(244, 63, 94, 0.6)"
              glowBorder="#f43f5e"
            />

            {/* Space Bar */}
            <GlassKey
              flex={4.2}
              label="space"
              onPress={() => handleCharPress(" ")}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {/* Period */}
            {renderKey(".", ".", 1)}

            {/* Send Key with vibrant glow */}
            <GlassKey
              flex={1.5}
              isSpecial
              onPress={() => {
                triggerHaptic("medium");
                onSend();
              }}
              displayContent={<Send size={18} color="#ffffff" />}
              customStyle={{
                backgroundColor: theme.accent || "#f43f5e",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
              textColor="#ffffff"
              keyBg={theme.accent || "#f43f5e"}
              keyBorder="rgba(255, 255, 255, 0.3)"
              activeKeyBg={theme.accent ? `${theme.accent}cc` : "#e11d48"}
              glowColor={theme.accent || "#f43f5e"}
              glowBorder="#ffffff"
            />
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
            <GlassKey
              flex={1.5}
              isSpecial
              label={mode === "numbers" ? "#+=" : "123"}
              onPress={() => {
                triggerHaptic();
                setMode(mode === "numbers" ? "symbols" : "numbers");
              }}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {(mode === "numbers"
              ? [".", ",", "?", "!", "'"]
              : [".", ",", "?", "!", "`"]
            ).map((ch) => renderKey(ch))}

            {/* Backspace Key */}
            <GlassKey
              flex={1.5}
              isSpecial
              onPressIn={handleBackspaceStart}
              onPressOut={handleBackspaceEnd}
              displayContent={<Delete size={19} color={textColor} />}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />
          </View>

          {/* Row 4 (Bottom) */}
          <View style={styles.row}>
            {/* ABC Toggle */}
            <GlassKey
              flex={1.5}
              isSpecial
              label="ABC"
              onPress={() => {
                triggerHaptic();
                setMode("letters");
              }}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {/* Space Bar */}
            <GlassKey
              flex={5}
              label="space"
              onPress={() => handleCharPress(" ")}
              textColor={textColor}
              keyBg={keyBg}
              keyBorder={keyBorder}
              activeKeyBg={activeKeyBg}
              glowColor={glowColor}
              glowBorder={glowBorder}
            />

            {/* Send Key */}
            <GlassKey
              flex={1.5}
              isSpecial
              onPress={() => {
                triggerHaptic();
                onSend();
              }}
              displayContent={<Send size={18} color="#ffffff" />}
              customStyle={{
                backgroundColor: theme.accent || "#f43f5e",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
              textColor="#ffffff"
              keyBg={theme.accent || "#f43f5e"}
              keyBorder="rgba(255, 255, 255, 0.3)"
              activeKeyBg={theme.accent ? `${theme.accent}cc` : "#e11d48"}
              glowColor={theme.accent || "#f43f5e"}
              glowBorder="#ffffff"
            />
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
    paddingHorizontal: 4,
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.32)",
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
    position: "relative",
    overflow: "hidden",
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
    position: "relative",
    overflow: "hidden",
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
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 5px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22)",
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
  slidePreviewPill: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 99,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  slidePreviewText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    textAlign: "center",
  },
});
