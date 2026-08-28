import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ShieldAlert,
  Users,
  Copy,
  Trash2,
  Check,
  ChevronLeft,
  Sparkles,
  Zap,
  Lock,
  Ghost,
  Type,
  Image as ImageIcon,
  Bell,
  RefreshCw,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FeatureKey, UserProfile, DEFAULT_PUBLIC_FEATURES } from "../lib/features";

const ALL_FEATURES: { key: FeatureKey; label: string; icon: any; desc: string }[] = [
  { key: "ghost_typing", label: "Ghost Typing Preview", icon: Ghost, desc: "Live character typing preview" },
  { key: "custom_fonts", label: "Custom Message Fonts", icon: Type, desc: "Custom font selector when sending" },
  { key: "wallpapers", label: "Wallpaper Doodles", icon: ImageIcon, desc: "Background doodle overlays" },
  { key: "alapin_decoy", label: "AlaPin Decoy Mode", icon: Lock, desc: "Stealth decoy PIN passcode screen" },
  { key: "custom_alerts", label: "Custom Alert Popups", icon: Bell, desc: "Broadcast non-dismissible alert popups" },
];

export default function OverseerScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [publicFeatures, setPublicFeatures] = useState<string[]>([]);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const fetchOverseerData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Check if current user is admin
      const { data: myProfile, error: meErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (meErr || !myProfile?.is_admin) {
        setIsAdmin(false);
        router.replace("/");
        return;
      }

      setIsAdmin(true);

      // 2. Fetch all profiles
      const { data: allProf } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (allProf) setProfiles(allProf as UserProfile[]);

      // 3. Fetch app_settings for public_features
      const { data: settings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "public_features")
        .single();

      if (settings?.value && Array.isArray(settings.value)) {
        setPublicFeatures(settings.value);
      } else {
        setPublicFeatures(DEFAULT_PUBLIC_FEATURES);
        await supabase
          .from("app_settings")
          .upsert({ key: "public_features", value: DEFAULT_PUBLIC_FEATURES });
      }
    } catch (e) {
      console.error("Overseer error:", e);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    fetchOverseerData();
  }, [fetchOverseerData]);

  // Toggle Global Public Feature Release
  const toggleGlobalFeature = async (featureKey: FeatureKey) => {
    const updated = publicFeatures.includes(featureKey)
      ? publicFeatures.filter((f) => f !== featureKey)
      : [...publicFeatures, featureKey];

    setPublicFeatures(updated);
    try {
      await supabase
        .from("app_settings")
        .upsert({ key: "public_features", value: updated });
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Personal Feature Award per User
  const togglePersonalAward = async (targetUser: UserProfile, featureKey: FeatureKey) => {
    const current = targetUser.awarded_features || [];
    const updated = current.includes(featureKey)
      ? current.filter((f) => f !== featureKey)
      : [...current, featureKey];

    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: updated } : p))
    );

    try {
      await supabase
        .from("profiles")
        .update({ awarded_features: updated })
        .eq("id", targetUser.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Ban/Unban User
  const toggleUserBan = async (targetUser: UserProfile) => {
    const newBannedState = !targetUser.is_banned;
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, is_banned: newBannedState } : p))
    );

    try {
      await supabase
        .from("profiles")
        .update({ is_banned: newBannedState })
        .eq("id", targetUser.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Copy SQL Snippet to Clipboard
  const copyToClipboard = (sql: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(sql);
    }
    setCopiedSql(label);
    setTimeout(() => setCopiedSql(null), 2500);
  };

  // Cleanup Test Data
  const handleCleanupData = async () => {
    const confirmText = "Are you sure you want to clean up test messages?";
    if (Platform.OS === "web") {
      if (!window.confirm(confirmText)) return;
    }
    setCleaning(true);
    try {
      // Delete system test messages
      await supabase.from("messages").delete().ilike("content", "%test%");
      alert("Test data cleanup complete!");
    } catch (e) {
      console.error(e);
    } finally {
      setCleaning(false);
    }
  };

  if (loading || !isAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5865F2" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#0f1015" }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/")}>
          <ChevronLeft size={22} color="#ffffff" />
          <Text style={styles.backText}>Back to Chat</Text>
        </TouchableOpacity>

        <View style={styles.titleBadge}>
          <ShieldAlert size={18} color="#f43f5e" style={{ marginRight: 6 }} />
          <Text style={styles.titleText}>Overseer Panel</Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchOverseerData}>
          <RefreshCw size={18} color="#949ba4" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* SECTION 1: GLOBAL PUBLIC FEATURE RELEASES */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Zap size={20} color="#38bdf8" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Global Public Feature Releases</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Toggling a feature ON releases it to ALL users publicly across the entire app.
          </Text>

          {ALL_FEATURES.map((item) => {
            const IconComp = item.icon;
            const isPublic = publicFeatures.includes(item.key);
            return (
              <View key={item.key} style={styles.featureRow}>
                <View style={styles.featureLeft}>
                  <View style={styles.iconCircle}>
                    <IconComp size={18} color={isPublic ? "#38bdf8" : "#888888"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureLabel}>{item.label}</Text>
                    <Text style={styles.featureDesc}>{item.desc}</Text>
                  </View>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={() => toggleGlobalFeature(item.key)}
                  trackColor={{ false: "#333333", true: "#0284c7" }}
                  thumbColor={isPublic ? "#38bdf8" : "#aaaaaa"}
                />
              </View>
            );
          })}
        </View>

        {/* SECTION 2: ACCOUNTS OVERSIGHT & PERSONAL AWARDS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#a855f7" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>User Oversight & Feature Awards ({profiles.length})</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Award exclusive features to individual users or ban problematic accounts.
          </Text>

          {profiles.map((p) => {
            const isSelf = p.id === user?.id;
            return (
              <View key={p.id} style={[styles.userCard, p.is_banned && styles.bannedUserCard]}>
                <View style={styles.userInfoRow}>
                  <View style={styles.userAvatarSlot}>
                    <Text style={styles.userAvatarChar}>
                      {(p.username || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameBadgeRow}>
                      <Text style={styles.userName}>{p.username || "Unknown"}</Text>
                      {p.is_admin && <View style={styles.adminPill}><Text style={styles.adminPillText}>ADMIN</Text></View>}
                      {p.is_banned && <View style={styles.bannedPill}><Text style={styles.bannedPillText}>BANNED</Text></View>}
                    </View>
                    <Text style={styles.userSubtext}>{p.email || p.id}</Text>
                  </View>

                  {!isSelf && (
                    <View style={styles.banSwitchWrap}>
                      <Text style={styles.banLabel}>{p.is_banned ? "Unban" : "Ban"}</Text>
                      <Switch
                        value={!!p.is_banned}
                        onValueChange={() => toggleUserBan(p)}
                        trackColor={{ false: "#333", true: "#e11d48" }}
                        thumbColor={p.is_banned ? "#f43f5e" : "#888"}
                      />
                    </View>
                  )}
                </View>

                {/* Individual Feature Award Badges */}
                <Text style={styles.awardHeader}>Personal Feature Awards:</Text>
                <View style={styles.badgeWrap}>
                  {ALL_FEATURES.map((f) => {
                    const isAwarded = (p.awarded_features || []).includes(f.key);
                    const isGloballyPublic = publicFeatures.includes(f.key);
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[
                          styles.awardBadge,
                          isAwarded && styles.awardBadgeActive,
                          isGloballyPublic && styles.awardBadgePublic,
                        ]}
                        onPress={() => togglePersonalAward(p, f.key)}
                      >
                        <Text
                          style={[
                            styles.awardBadgeText,
                            (isAwarded || isGloballyPublic) && styles.awardBadgeTextActive,
                          ]}
                        >
                          {f.label} {isGloballyPublic ? "(Public)" : isAwarded ? "✓" : "+"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* SECTION 3: ADMIN UTILITIES & CLEANUP */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Trash2 size={20} color="#f43f5e" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Admin Utilities & Database Cleanup</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Clean up test messages and orphaned chat data.
          </Text>

          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleCleanupData}
            disabled={cleaning}
          >
            {cleaning ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Trash2 size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.dangerBtnText}>Clean Up Test Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION 4: COPY SQL SNIPPETS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Copy size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Copy SQL Helper Snippets</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Run these commands in your Supabase SQL Editor for manual database operations.
          </Text>

          <View style={styles.sqlCard}>
            <Text style={styles.sqlTitle}>1. Promote User to Admin</Text>
            <Text style={styles.sqlCode}>
              {`UPDATE profiles SET is_admin = true WHERE username = 'YOUR_USERNAME';`}
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() =>
                copyToClipboard(
                  `UPDATE profiles SET is_admin = true WHERE username = 'YOUR_USERNAME';`,
                  "Make Admin SQL Copied!"
                )
              }
            >
              <Copy size={14} color="#10b981" style={{ marginRight: 4 }} />
              <Text style={styles.copyBtnText}>
                {copiedSql === "Make Admin SQL Copied!" ? "Copied!" : "Copy SQL"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sqlCard}>
            <Text style={styles.sqlTitle}>2. Ensure Required Overseer Database Columns</Text>
            <Text style={styles.sqlCode}>
              {`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS awarded_features TEXT[] DEFAULT '{}';`}
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() =>
                copyToClipboard(
                  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS awarded_features TEXT[] DEFAULT '{}';`,
                  "Schema Migration SQL Copied!"
                )
              }
            >
              <Copy size={14} color="#10b981" style={{ marginRight: 4 }} />
              <Text style={styles.copyBtnText}>
                {copiedSql === "Schema Migration SQL Copied!" ? "Copied!" : "Copy Migration SQL"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1015",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 20 : 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,63,94,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  titleText: {
    color: "#f43f5e",
    fontSize: 14,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 8,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  sectionCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#949ba4",
    fontSize: 13,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  featureLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  featureDesc: {
    color: "#888888",
    fontSize: 12,
  },
  userCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bannedUserCard: {
    borderColor: "rgba(244,63,94,0.4)",
    backgroundColor: "rgba(244,63,94,0.05)",
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  userAvatarSlot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#5865F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarChar: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  userNameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  userSubtext: {
    color: "#888888",
    fontSize: 12,
  },
  adminPill: {
    backgroundColor: "#a855f7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  bannedPill: {
    backgroundColor: "#f43f5e",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bannedPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  banSwitchWrap: {
    alignItems: "flex-end",
  },
  banLabel: {
    color: "#888888",
    fontSize: 11,
    marginBottom: 2,
  },
  awardHeader: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  awardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  awardBadgeActive: {
    backgroundColor: "rgba(168,85,247,0.25)",
    borderColor: "#a855f7",
  },
  awardBadgePublic: {
    backgroundColor: "rgba(56,189,248,0.2)",
    borderColor: "#38bdf8",
  },
  awardBadgeText: {
    color: "#888888",
    fontSize: 11,
  },
  awardBadgeTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e11d48",
    paddingVertical: 12,
    borderRadius: 10,
  },
  dangerBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  sqlCard: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  sqlTitle: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  sqlCode: {
    color: "#d1d5db",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },
});
