import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import {
  RotateCw,
  Lock,
  Maximize2,
  Minimize2,
  MessageSquare,
  Palette,
  Check,
  ShieldCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAlaPin } from "../context/AlaPinContext";

const THEME_OPTIONS = [
  { id: "dark", label: "Dark", color: "#313338" },
  { id: "black", label: "AMOLED", color: "#000000" },
  { id: "light", label: "Light", color: "#ffffff" },
  { id: "pink", label: "Pink", color: "#fdf2f8" },
  { id: "hacker", label: "Hacker", color: "#0a0a0a" },
];

export default function AlaContextMenu() {
  const { theme, setTheme } = useTheme();
  const { isPinEnabled, realPin, lockNow } = useAlaPin();
  const router = useRouter();
  const isAmoled = theme.id === "black";

  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      let posX = e.clientX;
      let posY = e.clientY;

      if (posX + 240 > screenW) posX = screenW - 250;
      if (posY + 320 > screenH) posY = screenH - 330;

      setPos({ x: Math.max(10, posX), y: Math.max(10, posY) });
      setVisible(true);
    };

    const handleClickOutside = () => {
      setVisible(false);
    };

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

  const handleRefresh = () => {
    setVisible(false);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
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
    <View style={[styles.overlay]} pointerEvents="box-none">
      <View
        style={[
          styles.menuCard,
          {
            top: pos.y,
            left: pos.x,
            backgroundColor: isAmoled ? "rgba(10,10,10,0.92)" : "rgba(30,31,34,0.92)",
            borderColor: isAmoled ? "#222" : "rgba(255,255,255,0.12)",
          },
        ]}
      >
        {/* Section 1: Refresh & Lock */}
        <TouchableOpacity style={styles.menuItem} onPress={handleRefresh}>
          <RotateCw size={16} color={theme.accent} style={{ marginRight: 10 }} />
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>Refresh Chat & Data</Text>
        </TouchableOpacity>

        {isPinEnabled && !!realPin && (
          <TouchableOpacity style={styles.menuItem} onPress={handleLock}>
            <Lock size={16} color="#f43f5e" style={{ marginRight: 10 }} />
            <Text style={[styles.menuText, { color: "#f43f5e", fontWeight: "600" }]}>Lock App Now (AlaPin)</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={toggleFullscreen}>
          {isFullscreen ? (
            <Minimize2 size={16} color={theme.accent} style={{ marginRight: 10 }} />
          ) : (
            <Maximize2 size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
          )}
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>
            {isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Section 2: Navigation */}
        <TouchableOpacity style={styles.menuItem} onPress={handleGoHome}>
          <MessageSquare size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
          <Text style={[styles.menuText, { color: isAmoled ? "#fff" : theme.text }]}>Go to Home / Chats</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Section 3: Quick Theme Switcher */}
        <View style={styles.themeSection}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Palette size={14} color={theme.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Quick Theme Switcher</Text>
          </View>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((t) => {
              const isSelected = theme.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.themeChip,
                    { backgroundColor: t.color, borderColor: isSelected ? theme.accent : "rgba(255,255,255,0.15)" },
                  ]}
                  onPress={() => {
                    setTheme(t.id);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.themeChipText, { color: t.id === "light" || t.id === "pink" ? "#111" : "#fff" }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
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
    width: 240,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    backdropFilter: "blur(20px)",
    elevation: 10,
  } as any,
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 6,
  },
  themeSection: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  themeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
