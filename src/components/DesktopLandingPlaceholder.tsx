import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { MessageSquare, ShieldCheck, Lock } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

export default function DesktopLandingPlaceholder() {
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isAmoled
            ? "#000000"
            : theme.id === "light"
            ? "#f0f2f5"
            : theme.id === "pink"
            ? "#fce7f3"
            : "#111214",
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isAmoled
                ? "#111111"
                : theme.id === "light"
                ? "#ffffff"
                : "rgba(255,255,255,0.06)",
              borderColor: isAmoled
                ? "#222222"
                : theme.id === "light"
                ? "rgba(0,0,0,0.06)"
                : "rgba(255,255,255,0.1)",
            },
          ]}
        >
          <MessageSquare size={52} color={theme.accent || "#5865F2"} />
        </View>

        <Text style={[styles.title, { color: isAmoled ? "#ffffff" : theme.text }]}>
          AlaThing Web
        </Text>

        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Send and receive messages seamlessly with custom fonts, AMOLED dark themes, clumped media albums, and real-time sync.
        </Text>

        <View
          style={[
            styles.badgeRow,
            {
              backgroundColor: isAmoled
                ? "#111111"
                : theme.id === "light"
                ? "rgba(0,0,0,0.03)"
                : "rgba(255,255,255,0.04)",
              borderColor: isAmoled
                ? "#222222"
                : theme.id === "light"
                ? "rgba(0,0,0,0.06)"
                : "rgba(255,255,255,0.08)",
            },
          ]}
        >
          <ShieldCheck size={16} color={theme.accent || "#5865F2"} />
          <Text style={[styles.badgeText, { color: theme.textMuted }]}>
            End-to-end synchronized • Select a chat from the sidebar to begin
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Lock size={12} color={theme.textMuted} style={{ marginRight: 4 }} />
        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          Personal messages & media are securely synced
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.08)",
  },
  content: {
    maxWidth: 460,
    alignItems: "center",
    textAlign: "center",
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: -0.5,
    fontFamily: "Josefin Sans",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
    fontFamily: "Josefin Sans",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Josefin Sans",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Josefin Sans",
  },
});
