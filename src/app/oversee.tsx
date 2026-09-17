import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ShieldAlert,
  Users,
  ChevronLeft,
  Search,
  Check,
  X,
  Copy,
  Ghost,
  Lock,
  Type,
  Image as ImageIcon,
  Bell,
  RefreshCw,
  Keyboard,
  Sparkles,
  ArrowUpDown,
  UserCheck,
  UserX,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FeatureKey, UserProfile, DEFAULT_PUBLIC_FEATURES } from "../lib/features";

const ALL_FEATURES: { key: FeatureKey; label: string; icon: any; desc: string }[] = [
  { key: "ghost_typing", label: "Ghost Typing Preview", icon: Ghost, desc: "Live character typing indicator" },
  { key: "custom_fonts", label: "Custom Message Fonts", icon: Type, desc: "Custom font selector when sending" },
  { key: "wallpapers", label: "Wallpaper Doodles", icon: ImageIcon, desc: "Background doodle overlays in chat" },
  { key: "alapin_decoy", label: "AlaPin Decoy Mode", icon: Lock, desc: "Stealth decoy PIN passcode screen" },
  { key: "custom_alerts", label: "Custom Alert Popups", icon: Bell, desc: "Broadcast non-dismissible alert popups" },
  { key: "glass_keyboard", label: "AlaGlass Keyboard (Beta)", icon: Keyboard, desc: "Custom frosted glass keyboard on mobile" },
];

export default function OverseerScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [publicFeatures, setPublicFeatures] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "admin" | "banned" | "awarded">("all");
  const [sortBy, setSortBy] = useState<"active" | "name" | "admin">("active");

  // Selected User for Detail Modal
  const [inspectedUser, setInspectedUser] = useState<UserProfile | null>(null);

  const syncChannelRef = useRef<any>(null);

  useEffect(() => {
    const channel = supabase.channel("app_settings_sync");
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        syncChannelRef.current = channel;
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(label);
    showToast(`✓ Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const broadcastSettingsUpdate = (payload: any) => {
    try {
      if (syncChannelRef.current) {
        syncChannelRef.current.send({
          type: "broadcast",
          event: "settings_updated",
          payload,
        });
      } else {
        const channel = supabase.channel("app_settings_sync");
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            syncChannelRef.current = channel;
            channel.send({
              type: "broadcast",
              event: "settings_updated",
              payload,
            });
          }
        });
      }
    } catch (e) {
      console.error("Broadcast error:", e);
    }
  };

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

      // 2. Fetch all profiles (order by updated_at desc, never created_at)
      const { data: allProf, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false });

      if (profErr) {
        console.error("Profiles fetch error:", profErr);
        showToast(`⚠️ Profiles error: ${profErr.message}`);
      } else if (allProf) {
        setProfiles(allProf as UserProfile[]);
        // If an inspected user is currently open, keep it in sync
        setInspectedUser((prev) => {
          if (!prev) return null;
          const fresh = allProf.find((p) => p.id === prev.id);
          return (fresh as UserProfile) || prev;
        });
      }

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
    } catch (e: any) {
      console.error("Overseer error:", e);
      showToast(`⚠️ ${e.message || "Failed to load"}`);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    fetchOverseerData();
  }, [fetchOverseerData]);

  // Toggle Global Public Feature Release
  const toggleGlobalFeature = async (featureKey: FeatureKey, label: string) => {
    const updated = publicFeatures.includes(featureKey)
      ? publicFeatures.filter((f) => f !== featureKey)
      : [...publicFeatures, featureKey];

    const isNowPublic = updated.includes(featureKey);
    setPublicFeatures(updated);

    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "public_features", value: updated });

      if (error) {
        showToast(`⚠️ Failed to update ${label}: ${error.message}`);
      } else {
        showToast(`✓ Saved: ${label} is now ${isNowPublic ? "PUBLIC (EVERYONE)" : "PRIVATE / SELECTIVE"}`);
        broadcastSettingsUpdate({ publicFeatures: updated });
      }
    } catch (e: any) {
      showToast(`⚠️ Exception: ${e.message}`);
    }
  };

  // Toggle Personal Feature Award per User
  const togglePersonalAward = async (targetUser: UserProfile, featureKey: FeatureKey, label: string) => {
    const current = Array.isArray(targetUser.awarded_features) ? targetUser.awarded_features : [];
    const updated = current.includes(featureKey)
      ? current.filter((f) => f !== featureKey)
      : [...current, featureKey];

    const isNowAwarded = updated.includes(featureKey);

    // Optimistic local update
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: updated } : p))
    );
    setInspectedUser((prev) =>
      prev && prev.id === targetUser.id ? { ...prev, awarded_features: updated } : prev
    );

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ awarded_features: updated })
        .eq("id", targetUser.id);

      if (error) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: current } : p))
        );
        setInspectedUser((prev) =>
          prev && prev.id === targetUser.id ? { ...prev, awarded_features: current } : prev
        );
        showToast(`⚠️ Award failed for @${targetUser.username}: ${error.message}`);
      } else {
        showToast(`✓ Saved: ${label} ${isNowAwarded ? "awarded to" : "removed from"} @${targetUser.username || "user"}`);
        broadcastSettingsUpdate({ userId: targetUser.id, awardedFeatures: updated });
      }
    } catch (e: any) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: current } : p))
      );
      setInspectedUser((prev) =>
        prev && prev.id === targetUser.id ? { ...prev, awarded_features: current } : prev
      );
      showToast(`⚠️ Exception: ${e.message}`);
    }
  };

  // Grant All Features to User
  const grantAllFeatures = async (targetUser: UserProfile) => {
    const allKeys = ALL_FEATURES.map((f) => f.key);
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: allKeys } : p))
    );
    setInspectedUser((prev) =>
      prev && prev.id === targetUser.id ? { ...prev, awarded_features: allKeys } : prev
    );

    const { error } = await supabase
      .from("profiles")
      .update({ awarded_features: allKeys })
      .eq("id", targetUser.id);

    if (error) {
      showToast(`⚠️ Error granting all: ${error.message}`);
    } else {
      showToast(`✓ All features granted to @${targetUser.username}!`);
      broadcastSettingsUpdate({ userId: targetUser.id, awardedFeatures: allKeys });
    }
  };

  // Clear All Features from User
  const clearAllFeatures = async (targetUser: UserProfile) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, awarded_features: [] } : p))
    );
    setInspectedUser((prev) =>
      prev && prev.id === targetUser.id ? { ...prev, awarded_features: [] } : prev
    );

    const { error } = await supabase
      .from("profiles")
      .update({ awarded_features: [] })
      .eq("id", targetUser.id);

    if (error) {
      showToast(`⚠️ Error clearing features: ${error.message}`);
    } else {
      showToast(`✓ All personal awards cleared for @${targetUser.username}!`);
      broadcastSettingsUpdate({ userId: targetUser.id, awardedFeatures: [] });
    }
  };

  // Toggle Admin Status
  const toggleUserAdmin = async (targetUser: UserProfile) => {
    const newAdminState = !targetUser.is_admin;
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, is_admin: newAdminState } : p))
    );
    setInspectedUser((prev) =>
      prev && prev.id === targetUser.id ? { ...prev, is_admin: newAdminState } : prev
    );

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: newAdminState })
        .eq("id", targetUser.id);

      if (error) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === targetUser.id ? { ...p, is_admin: !newAdminState } : p))
        );
        setInspectedUser((prev) =>
          prev && prev.id === targetUser.id ? { ...prev, is_admin: !newAdminState } : prev
        );
        showToast(`⚠️ Admin toggle failed: ${error.message}`);
      } else {
        showToast(`✓ @${targetUser.username} is now ${newAdminState ? "an ADMIN" : "a Regular User"}`);
        broadcastSettingsUpdate({ userId: targetUser.id, isAdmin: newAdminState });
      }
    } catch (e: any) {
      showToast(`⚠️ Exception: ${e.message}`);
    }
  };

  // Toggle Ban/Unban User
  const toggleUserBan = async (targetUser: UserProfile) => {
    const newBannedState = !targetUser.is_banned;
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetUser.id ? { ...p, is_banned: newBannedState } : p))
    );
    setInspectedUser((prev) =>
      prev && prev.id === targetUser.id ? { ...prev, is_banned: newBannedState } : prev
    );

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: newBannedState })
        .eq("id", targetUser.id);

      if (error) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === targetUser.id ? { ...p, is_banned: !newBannedState } : p))
        );
        setInspectedUser((prev) =>
          prev && prev.id === targetUser.id ? { ...prev, is_banned: !newBannedState } : prev
        );
        showToast(`⚠️ Ban toggle failed: ${error.message}`);
      } else {
        showToast(`✓ Saved: @${targetUser.username} is now ${newBannedState ? "BANNED" : "UNBANNED"}`);
        broadcastSettingsUpdate({ userId: targetUser.id, isBanned: newBannedState });
      }
    } catch (e: any) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === targetUser.id ? { ...p, is_banned: !newBannedState } : p))
      );
      setInspectedUser((prev) =>
        prev && prev.id === targetUser.id ? { ...prev, is_banned: !newBannedState } : prev
      );
      showToast(`⚠️ Exception: ${e.message}`);
    }
  };

  // Filter & Sort Users
  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((p) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchUsername = (p.username || "").toLowerCase().includes(q);
          const matchDisplay = (p.display_name || "").toLowerCase().includes(q);
          const matchId = (p.id || "").toLowerCase().includes(q);
          if (!matchUsername && !matchDisplay && !matchId) return false;
        }

        // Category Filter
        if (filterBy === "admin") return !!p.is_admin;
        if (filterBy === "banned") return !!p.is_banned;
        if (filterBy === "awarded") return Array.isArray(p.awarded_features) && p.awarded_features.length > 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return (a.username || "").localeCompare(b.username || "");
        }
        if (sortBy === "admin") {
          if (a.is_admin && !b.is_admin) return -1;
          if (!a.is_admin && b.is_admin) return 1;
        }
        // Default: active / updated_at
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [profiles, searchQuery, filterBy, sortBy]);

  const counts = useMemo(() => {
    return {
      all: profiles.length,
      admin: profiles.filter((p) => p.is_admin).length,
      banned: profiles.filter((p) => p.is_banned).length,
      awarded: profiles.filter((p) => Array.isArray(p.awarded_features) && p.awarded_features.length > 0).length,
    };
  }, [profiles]);

  const formatActiveDate = (ts?: string) => {
    if (!ts) return "Never";
    try {
      const d = new Date(ts);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 2) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
      return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
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
          <Text style={styles.titleText}>Overseer Control Center</Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchOverseerData}>
          <RefreshCw size={18} color="#949ba4" />
        </TouchableOpacity>
      </View>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SECTION 1: GLOBAL PUBLIC FEATURE TOGGLES */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color="#38bdf8" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Global Public Features</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Features toggled ON are free and available to everyone. Toggling OFF makes them exclusive (only users you personally award can access them).
          </Text>

          {ALL_FEATURES.map((item) => {
            const isPublic = publicFeatures.includes(item.key);
            const IconComp = item.icon;
            return (
              <View key={item.key} style={styles.featureRow}>
                <View style={styles.featureLeft}>
                  <View style={[styles.iconCircle, isPublic && styles.iconCircleActive]}>
                    <IconComp size={18} color={isPublic ? "#38bdf8" : "#666666"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.featureLabel}>{item.label}</Text>
                      <View style={[styles.statusTag, isPublic ? styles.statusTagPublic : styles.statusTagPrivate]}>
                        <Text style={[styles.statusTagText, isPublic ? styles.statusTagTextPublic : styles.statusTagTextPrivate]}>
                          {isPublic ? "PUBLIC" : "EXCLUSIVE"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.featureDesc}>{item.desc}</Text>
                  </View>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={() => toggleGlobalFeature(item.key, item.label)}
                  trackColor={{ false: "#27272a", true: "#0284c7" }}
                  thumbColor={isPublic ? "#38bdf8" : "#888888"}
                />
              </View>
            );
          })}
        </View>

        {/* SECTION 2: USER OVERSIGHT & DETAILED INSPECTION */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#a855f7" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>User Oversight & Selective Feature Awards</Text>
            <View style={styles.userCountPill}>
              <Text style={styles.userCountPillText}>{filteredProfiles.length} / {profiles.length}</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Click any user to inspect their profile, promote/demote admins, ban accounts, or award exclusive features.
          </Text>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Search size={16} color="#888888" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username, display name, or UUID..."
              placeholderTextColor="#666666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                <X size={16} color="#888888" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter & Sort Chips */}
          <View style={styles.filterSortRow}>
            <View style={styles.filterChipsWrap}>
              <TouchableOpacity
                style={[styles.filterChip, filterBy === "all" && styles.filterChipActive]}
                onPress={() => setFilterBy("all")}
              >
                <Text style={[styles.filterChipText, filterBy === "all" && styles.filterChipTextActive]}>
                  All ({counts.all})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, filterBy === "admin" && styles.filterChipActive]}
                onPress={() => setFilterBy("admin")}
              >
                <Text style={[styles.filterChipText, filterBy === "admin" && styles.filterChipTextActive]}>
                  Admins ({counts.admin})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, filterBy === "banned" && styles.filterChipActive]}
                onPress={() => setFilterBy("banned")}
              >
                <Text style={[styles.filterChipText, filterBy === "banned" && styles.filterChipTextActive]}>
                  Banned ({counts.banned})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, filterBy === "awarded" && styles.filterChipActive]}
                onPress={() => setFilterBy("awarded")}
              >
                <Text style={[styles.filterChipText, filterBy === "awarded" && styles.filterChipTextActive]}>
                  Awarded ({counts.awarded})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sortChipsWrap}>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === "active" && styles.sortChipActive]}
                onPress={() => setSortBy("active")}
              >
                <ArrowUpDown size={12} color={sortBy === "active" ? "#38bdf8" : "#888888"} style={{ marginRight: 4 }} />
                <Text style={[styles.sortChipText, sortBy === "active" && styles.sortChipTextActive]}>Active</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortChip, sortBy === "name" && styles.sortChipActive]}
                onPress={() => setSortBy("name")}
              >
                <Text style={[styles.sortChipText, sortBy === "name" && styles.sortChipTextActive]}>Name</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortChip, sortBy === "admin" && styles.sortChipActive]}
                onPress={() => setSortBy("admin")}
              >
                <Text style={[styles.sortChipText, sortBy === "admin" && styles.sortChipTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Cards List */}
          {filteredProfiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={36} color="#555555" />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? "Try refining your search query." : "No profiles registered in database."}
              </Text>
            </View>
          ) : (
            filteredProfiles.map((p) => {
              const isSelf = p.id === user?.id;
              const awardedList = Array.isArray(p.awarded_features) ? p.awarded_features : [];
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.userCard, p.is_banned && styles.bannedUserCard]}
                  onPress={() => setInspectedUser(p)}
                  activeOpacity={0.8}
                >
                  <View style={styles.userInfoRow}>
                    <View style={styles.userAvatarSlot}>
                      {p.avatar_url ? (
                        <Image source={{ uri: p.avatar_url }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.userAvatarChar}>
                          {(p.username || "U")[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.userNameBadgeRow}>
                        <Text style={styles.userName}>{p.display_name || p.username || "Unknown"}</Text>
                        <Text style={styles.userHandle}>@{p.username || "user"}</Text>
                        {p.is_admin && <View style={styles.adminPill}><Text style={styles.adminPillText}>ADMIN</Text></View>}
                        {p.is_banned && <View style={styles.bannedPill}><Text style={styles.bannedPillText}>BANNED</Text></View>}
                        {isSelf && <View style={styles.selfPill}><Text style={styles.selfPillText}>YOU</Text></View>}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                        <Text style={styles.userSubtext}>ID: {p.id?.slice(0, 8)}...</Text>
                        <Text style={styles.userDot}>•</Text>
                        <Text style={styles.userSubtext}>Active: {formatActiveDate(p.updated_at)}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {!isSelf && (
                        <View style={styles.banSwitchWrap}>
                          <Switch
                            value={!!p.is_banned}
                            onValueChange={() => toggleUserBan(p)}
                            trackColor={{ false: "#333", true: "#e11d48" }}
                            thumbColor={p.is_banned ? "#f43f5e" : "#888"}
                          />
                        </View>
                      )}
                      <View style={styles.inspectBtn}>
                        <Text style={styles.inspectBtnText}>Manage</Text>
                      </View>
                    </View>
                  </View>

                  {/* Feature Badges Overview */}
                  <View style={styles.badgeWrap}>
                    {ALL_FEATURES.map((f) => {
                      const isAwarded = awardedList.includes(f.key);
                      const isGloballyPublic = publicFeatures.includes(f.key);
                      return (
                        <TouchableOpacity
                          key={f.key}
                          style={[
                            styles.awardBadge,
                            isAwarded && styles.awardBadgeActive,
                            isGloballyPublic && !isAwarded && styles.awardBadgePublic,
                          ]}
                          onPress={() => togglePersonalAward(p, f.key, f.label)}
                        >
                          <Text
                            style={[
                              styles.awardBadgeText,
                              (isAwarded || isGloballyPublic) && styles.awardBadgeTextActive,
                            ]}
                          >
                            {f.label} {isAwarded ? "✓ (Awarded)" : isGloballyPublic ? "(Public)" : "+ (Assign)"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DETAILED USER PROFILE & PERMISSIONS MODAL */}
      {inspectedUser && (
        <Modal
          visible={!!inspectedUser}
          animationType="fade"
          transparent
          onRequestClose={() => setInspectedUser(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.modalAvatarSlot}>
                    {inspectedUser.avatar_url ? (
                      <Image source={{ uri: inspectedUser.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.userAvatarChar}>
                        {(inspectedUser.username || "U")[0].toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.modalTitle}>{inspectedUser.display_name || inspectedUser.username}</Text>
                      {inspectedUser.is_admin && <View style={styles.adminPill}><Text style={styles.adminPillText}>ADMIN</Text></View>}
                      {inspectedUser.is_banned && <View style={styles.bannedPill}><Text style={styles.bannedPillText}>BANNED</Text></View>}
                    </View>
                    <Text style={styles.modalSubtitle}>@{inspectedUser.username}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setInspectedUser(null)}>
                  <X size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Details Grid */}
                <View style={styles.detailsGrid}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>User UUID</Text>
                    <TouchableOpacity
                      style={styles.copyIdRow}
                      onPress={() => copyToClipboard(inspectedUser.id || "", "User UUID")}
                    >
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {inspectedUser.id}
                      </Text>
                      <Copy size={13} color="#38bdf8" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Last Activity</Text>
                    <Text style={styles.detailValue}>
                      {formatActiveDate(inspectedUser.updated_at)}
                    </Text>
                  </View>

                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Notification Mode</Text>
                    <Text style={styles.detailValue}>
                      {inspectedUser.notification_preference || "Standard"}
                    </Text>
                  </View>

                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Account Role</Text>
                    <Text style={[styles.detailValue, inspectedUser.is_admin && { color: "#c084fc", fontWeight: "bold" }]}>
                      {inspectedUser.is_admin ? "Administrator" : "Standard Member"}
                    </Text>
                  </View>
                </View>

                {/* Administrative Controls */}
                <Text style={styles.sectionHeaderSmall}>Account Control</Text>
                <View style={styles.adminActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, inspectedUser.is_admin ? styles.actionBtnDanger : styles.actionBtnAdmin]}
                    onPress={() => toggleUserAdmin(inspectedUser)}
                  >
                    <UserCheck size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>
                      {inspectedUser.is_admin ? "Demote from Admin" : "Promote to Admin"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, inspectedUser.is_banned ? styles.actionBtnActive : styles.actionBtnDanger]}
                    onPress={() => toggleUserBan(inspectedUser)}
                  >
                    <UserX size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>
                      {inspectedUser.is_banned ? "Unban Account" : "Ban Account"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Personal Feature Awards Suite */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
                  <Text style={styles.sectionHeaderSmall}>Personal Feature Grants</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={() => grantAllFeatures(inspectedUser)}
                    >
                      <Text style={styles.batchBtnText}>Grant All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.batchBtn, { borderColor: "rgba(244,63,94,0.3)" }]}
                      onPress={() => clearAllFeatures(inspectedUser)}
                    >
                      <Text style={[styles.batchBtnText, { color: "#f43f5e" }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={{ color: "#888888", fontSize: 12, marginBottom: 12 }}>
                  Award features individually to this account. Users keep awarded features even when a feature is set to Private/Exclusive globally.
                </Text>

                <View style={styles.featuresList}>
                  {ALL_FEATURES.map((f) => {
                    const isAwarded = Array.isArray(inspectedUser.awarded_features) && inspectedUser.awarded_features.includes(f.key);
                    const isGloballyPublic = publicFeatures.includes(f.key);
                    const IconComp = f.icon;

                    return (
                      <View key={f.key} style={styles.modalFeatureCard}>
                        <View style={styles.modalFeatureLeft}>
                          <View style={[styles.iconCircle, (isAwarded || isGloballyPublic) && styles.iconCircleActive]}>
                            <IconComp size={18} color={isAwarded ? "#c084fc" : isGloballyPublic ? "#38bdf8" : "#666666"} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalFeatureTitle}>{f.label}</Text>
                            <Text style={styles.modalFeatureDesc}>{f.desc}</Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.modalAwardBtn,
                            isAwarded && styles.modalAwardBtnActive,
                            !isAwarded && isGloballyPublic && styles.modalAwardBtnPublic,
                          ]}
                          onPress={() => togglePersonalAward(inspectedUser, f.key, f.label)}
                        >
                          <Text
                            style={[
                              styles.modalAwardBtnText,
                              (isAwarded || isGloballyPublic) && styles.modalAwardBtnTextActive,
                            ]}
                          >
                            {isAwarded ? "✓ Awarded" : isGloballyPublic ? "🌐 Public" : "+ Assign"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
  toastBanner: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  toastText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
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
    flex: 1,
  },
  userCountPill: {
    backgroundColor: "rgba(168,85,247,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.4)",
  },
  userCountPillText: {
    color: "#c084fc",
    fontSize: 12,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    color: "#949ba4",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
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
  iconCircleActive: {
    backgroundColor: "rgba(56,189,248,0.15)",
  },
  featureLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  featureDesc: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusTagPublic: {
    backgroundColor: "rgba(56,189,248,0.2)",
  },
  statusTagPrivate: {
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  statusTagTextPublic: {
    color: "#38bdf8",
  },
  statusTagTextPrivate: {
    color: "#c084fc",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    paddingVertical: 4,
  },
  filterSortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  filterChipActive: {
    backgroundColor: "#a855f7",
  },
  filterChipText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  sortChipsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sortChipActive: {
    backgroundColor: "rgba(56,189,248,0.2)",
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  sortChipText: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "600",
  },
  sortChipTextActive: {
    color: "#38bdf8",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptySubtitle: {
    color: "#888888",
    fontSize: 13,
  },
  userCard: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  bannedUserCard: {
    borderColor: "rgba(244,63,94,0.4)",
    backgroundColor: "rgba(244,63,94,0.06)",
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  userAvatarSlot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#5865F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  userAvatarChar: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 18,
  },
  userNameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  userName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  userHandle: {
    color: "#888888",
    fontSize: 13,
  },
  userDot: {
    color: "#555555",
    fontSize: 12,
  },
  userSubtext: {
    color: "#888888",
    fontSize: 11,
  },
  adminPill: {
    backgroundColor: "#a855f7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminPillText: {
    color: "#ffffff",
    fontSize: 9,
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
    fontSize: 9,
    fontWeight: "bold",
  },
  selfPill: {
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selfPillText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
  },
  banSwitchWrap: {
    alignItems: "flex-end",
  },
  inspectBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  inspectBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  awardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  awardBadgeActive: {
    backgroundColor: "rgba(168,85,247,0.25)",
    borderColor: "#a855f7",
  },
  awardBadgePublic: {
    backgroundColor: "rgba(56,189,248,0.15)",
    borderColor: "rgba(56,189,248,0.5)",
  },
  awardBadgeText: {
    color: "#888888",
    fontSize: 10,
  },
  awardBadgeTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "88%",
    backgroundColor: "#16171f",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalAvatarSlot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#5865F2",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },
  modalSubtitle: {
    color: "#888888",
    fontSize: 13,
  },
  closeBtn: {
    padding: 8,
  },
  modalBody: {
    padding: 20,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  detailCard: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  detailLabel: {
    color: "#888888",
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  copyIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderSmall: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  adminActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnAdmin: {
    backgroundColor: "#7c3aed",
  },
  actionBtnDanger: {
    backgroundColor: "#e11d48",
  },
  actionBtnActive: {
    backgroundColor: "#10b981",
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  batchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  batchBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  modalFeatureCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalFeatureLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  modalFeatureTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  modalFeatureDesc: {
    color: "#888888",
    fontSize: 11,
    marginTop: 2,
  },
  modalAwardBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalAwardBtnActive: {
    backgroundColor: "rgba(168,85,247,0.25)",
    borderColor: "#a855f7",
  },
  modalAwardBtnPublic: {
    backgroundColor: "rgba(56,189,248,0.15)",
    borderColor: "#38bdf8",
  },
  modalAwardBtnText: {
    color: "#888888",
    fontSize: 12,
  },
  modalAwardBtnTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
});
