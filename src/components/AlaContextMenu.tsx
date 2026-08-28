import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
} from "react-native";
import {
  RotateCw,
  Lock,
  Maximize2,
  Minimize2,
  MessageSquare,
  Palette,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAlaPin } from "../context/AlaPinContext";

const THEME_LIST = [
  { id: "dark", label: "Dark" },
  { id: "black", label: "AMOLED" },
  { id: "light", label: "Light" },
  { id: "pink", label: "Pink" },
  { id: "hacker", label: "Hacker" },
];

export default function AlaContextMenu() {
  const { theme, setTheme } = useTheme();
  const { isPinEnabled, realPin, lockNow } = useAlaPin();
  const router = useRouter();
  const isAmoled = theme.id === "black";

  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      let posX = e.clientX;
      let posY = e.clientY;

      if (posX + 220 > screenW) posX = screenW - 230;
      if (posY + 260 > screenH) posY = screenH - 270;

      setPos({ x: Math.max(10, posX), y: Math.max(10, posY) });
      setVisible(true);

      opacityAnim.setValue(0);
      slideAnim.setValue(-12);
      scaleAnim.setValue(0.95);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.2)),
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]).start();
    };

    const handleClickOutside = () => setVisible(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (!visible || Platform.OS !== "web") return null;

  const currentThemeIdx = THEME_LIST.findIndex((t) => t.id === theme.id);

  const handleNextTheme = (dir: "next" | "prev") => {
    let newIdx = dir === "next" ? currentThemeIdx + 1 : currentThemeIdx - 1;
    if (newIdx >= THEME_LIST.length) newIdx = 0;
    if (newIdx < 0) newIdx = THEME_LIST.length - 1;
    setTheme(THEME_LIST[newIdx].id);
  };

  const handleRefresh = () => {
    setVisible(false);
    if (typeof window !== "undefined") window.location.reload();
  };

  const handleLock = () => {
    setVisible(false);
    lockNow();
  };

  const toggleFullscreen = () => {
    setVisible(false);
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const el = document.documentElement as any;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen toggle error:", e);
    }
  };

  const handleGoHome = () => {
    setVisible(false);
    router.push("/");
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.menuCard,
          {
            top: pos.y,
            left: pos.x,
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            backgroundColor: isAmoled
              ? "rgba(10,10,12,0.88)"
              : theme.id === "light" || theme.id === "pink"
              ? "rgba(255,255,255,0.88)"
              : "rgba(24,25,28,0.85)",
            borderColor: isAmoled
              ? "rgba(255,255,255,0.15)"
              : theme.id === "light"
              ? "rgba(0,0,0,0.1)"
              : "rgba(255,255,255,0.12)",
          },
        ]}
      >
        {/* Refresh Data */}
        <TouchableOpacity style={styles.menuItem} onPress={handleRefresh} activeOpacity={0.7}>
          <RotateCw size={15} color={theme.accent} style={{ marginRight: 10 }} />
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>Refresh Chat & Data</Text>
        </TouchableOpacity>

        {/* Lock App Now (AlaPin) */}
        {isPinEnabled && !!realPin && (
          <TouchableOpacity style={styles.menuItem} onPress={handleLock} activeOpacity={0.7}>
            <Lock size={15} color="#f43f5e" style={{ marginRight: 10 }} />
            <Text style={[styles.menuText, { color: "#f43f5e", fontWeight: "600" }]}>Lock App (AlaPin)</Text>
          </TouchableOpacity>
        )}

        {/* Fullscreen */}
        <TouchableOpacity style={styles.menuItem} onPress={toggleFullscreen} activeOpacity={0.7}>
          {isFullscreen ? (
            <Minimize2 size={15} color={theme.accent} style={{ marginRight: 10 }} />
          ) : (
            <Maximize2 size={15} color={theme.textMuted} style={{ marginRight: 10 }} />
          )}
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          </Text>
        </TouchableOpacity>

        {/* Home */}
        <TouchableOpacity style={styles.menuItem} onPress={handleGoHome} activeOpacity={0.7}>
          <MessageSquare size={15} color={theme.textMuted} style={{ marginRight: 10 }} />
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>Go to Home</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: isAmoled ? "#333" : "rgba(255,255,255,0.08)" }]} />

        {/* Minimalist Theme Selector: Theme ◄ Dark ► */}
        <View style={styles.themeRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Palette size={14} color={theme.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.themeLabel, { color: isAmoled ? "#aaa" : theme.textMuted }]}>Theme</Text>
          </View>
          <View style={styles.themeSelector}>
            <TouchableOpacity onPress={() => handleNextTheme("prev")} style={styles.arrowBtn} activeOpacity={0.7}>
              <ChevronLeft size={14} color={isAmoled ? "#fff" : theme.text} />
            </TouchableOpacity>
            <Text style={[styles.themeValueText, { color: theme.accent }]}>
              {THEME_LIST[currentThemeIdx >= 0 ? currentThemeIdx : 0].label}
            </Text>
            <TouchableOpacity onPress={() => handleNextTheme("next")} style={styles.arrowBtn} activeOpacity={0.7}>
              <ChevronRight size={14} color={isAmoled ? "#fff" : theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  menuCard: {
    position: "absolute",
    width: 215,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    backdropFilter: "blur(24px)",
    elevation: 12,
  } as any,
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuText: {
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 6,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  themeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  arrowBtn: {
    padding: 2,
  },
  themeValueText: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 54,
    textAlign: "center",
  },
});
