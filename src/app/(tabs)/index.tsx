import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  SafeAreaView, Platform, ActivityIndicator, Modal, TextInput, ScrollView,
  useWindowDimensions, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User, Search, MessageSquare, Plus, Users, X, Check, Settings,
  Maximize2, Minimize2, Lock, RotateCcw, Phone, PhoneIncoming,
  PhoneOutgoing, PhoneMissed, Video, Pin, Camera, Palette, Sparkles,
  CircleDot, CheckCheck, Clock, ChevronRight, MessageCircle, AlertCircle,
  MoreVertical, RefreshCw,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useTheme, THEMES } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useAlaPin } from "../../context/AlaPinContext";

import ChatSidebar from "../../components/ChatSidebar";
import DesktopLandingPlaceholder from "../../components/DesktopLandingPlaceholder";
import ShinyText from "../../components/ShinyText";
import { useTabsLoading } from "../../context/TabsLoadingContext";
import { isFullscreenActive, tryEnterFullscreen, exitFullscreen } from "../../lib/fullscreen";
import { getStoredCallLogs, CallLogEntry, initiateCall } from "../../utils/webrtcCall";
import { getStoredStories, addStory, StoryItem } from "../../utils/userStories";

export default function Home() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const isWebMobile = Platform.OS === "web" && width < 768;

  const { theme, setTheme } = useTheme();
  const isAmoled = theme.id === "black";
  const { isDecoyMode, isPinEnabled, realPin, lockNow } = useAlaPin();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setIsTabsLoading } = useTabsLoading();

  useEffect(() => {
    setIsTabsLoading(loading);
  }, [loading, setIsTabsLoading]);

  // Modal & Search state
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<{ id: string; username: string }[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Web Mobile State
  const [webTab, setWebTab] = useState<"chats" | "calls" | "updates">("chats");
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [startCallModalOpen, setStartCallModalOpen] = useState(false);
  const [chatMenuModalItem, setChatMenuModalItem] = useState<any | null>(null);

  // Load pinned chats
  useEffect(() => {
    AsyncStorage.getItem("@pinned_chat_ids").then((val) => {
      if (val) {
        try {
          setPinnedChatIds(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const togglePinChat = async (chatId: string) => {
    const isPinned = pinnedChatIds.includes(chatId);
    const updated = isPinned
      ? pinnedChatIds.filter((id) => id !== chatId)
      : [chatId, ...pinnedChatIds];
    setPinnedChatIds(updated);
    await AsyncStorage.setItem("@pinned_chat_ids", JSON.stringify(updated));
    setChatMenuModalItem(null);
  };

  // Load call logs & stories on Web Mobile
  const refreshCallsAndStories = useCallback(() => {
    getStoredCallLogs().then(setCallLogs);
    getStoredStories().then(setStories);
  }, []);

  useEffect(() => {
    if (isWebMobile) {
      refreshCallsAndStories();
    }
  }, [isWebMobile, webTab, refreshCallsAndStories]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const handleFullscreenChange = () => {
        setIsFullscreen(isFullscreenActive());
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      };
    }
  }, []);

  const toggleFullscreen = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    try {
      if (!isFullscreenActive()) {
        tryEnterFullscreen();
      } else {
        exitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen toggle error:", e);
    }
  };

  const handleWipeData = async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm("Wipe all local app data, cache, and reload?");
      if (!ok) return;
      try {
        await AsyncStorage.clear();
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (e) {}
      window.location.reload();
    }
  };

  const isPreAnniversary = React.useMemo(() => {
    const d = new Date();
    return d.getMonth() === 9 && d.getDate() >= 11 && d.getDate() <= 13;
  }, []);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    const cacheKey = `user_${user.id}_chats`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setChats(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {}

    try {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(`
          chat_id,
          last_read_at,
          chats (
            id, name, is_group, avatar_url,
            chat_participants (
              user_id,
              nickname,
              profiles ( id, username, display_name, avatar_url )
            )
          )
        `)
        .eq("user_id", user.id);
      if (error) throw error;

      if (!data || data.length === 0) {
        setChats([]);
        AsyncStorage.setItem(cacheKey, JSON.stringify([])).catch(() => {});
        setLoading(false);
        return;
      }

      const chatIds = data.map((item: any) => item.chats?.id).filter(Boolean);

      const { data: allLastMsgs } = await supabase
        .from("messages")
        .select("chat_id, sender_id, content, type, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      const lastMsgMap: Record<string, any> = {};
      if (allLastMsgs) {
        for (const msg of allLastMsgs) {
          if (!lastMsgMap[msg.chat_id]) {
            lastMsgMap[msg.chat_id] = msg;
          }
        }
      }

      const formatted = data
        .map((item: any) => {
          const chat = item.chats;
          if (!chat) return null;
          let chatName = chat.name || "Chat";
          let chatAvatar = chat.avatar_url;
          let partnerUserId: string | null = null;

          if (!chat.is_group && chat.chat_participants) {
            const myPart = chat.chat_participants.find((p: any) => p.user_id === user.id);
            const otherPart = chat.chat_participants.find((p: any) => p.user_id !== user.id);
            const other = otherPart?.profiles;
            if (other) {
              chatName = myPart?.nickname || other.display_name || other.username;
              chatAvatar = other.avatar_url;
              partnerUserId = other.id || otherPart?.user_id;
            }
          }

          const lastMsg = lastMsgMap[chat.id];
          let lastMsgText = "Tap to view messages...";
          let isMe = false;
          if (lastMsg) {
            isMe = lastMsg.sender_id === user.id;
            if (lastMsg.type === "image") lastMsgText = "📷 Photo";
            else if (lastMsg.type === "video") lastMsgText = "🎥 Video";
            else if (lastMsg.type === "audio") lastMsgText = "🎵 Voice note";
            else if (lastMsg.type === "alert" || lastMsg.content?.startsWith('{"title":'))
              lastMsgText = "🚨 Alert";
            else lastMsgText = lastMsg.content;
          }

          // Friendly relative time (e.g., "2 mins", "24 mins")
          let lastMsgTime = "";
          if (lastMsg) {
            const diffSec = Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 1000);
            if (diffSec < 60) lastMsgTime = "just now";
            else if (diffSec < 3600) lastMsgTime = `${Math.floor(diffSec / 60)} mins`;
            else if (diffSec < 86400) lastMsgTime = `${Math.floor(diffSec / 3600)}h ago`;
            else lastMsgTime = new Date(lastMsg.created_at).toLocaleDateString([], { month: "short", day: "numeric" });
          }

          let unread = 0;
          if (lastMsg && !isMe) {
            if (item.last_read_at) {
              if (new Date(lastMsg.created_at) > new Date(item.last_read_at)) {
                unread = 1;
              }
            } else {
              unread = 1;
            }
          }

          return {
            id: chat.id,
            name: chatName,
            avatar: chatAvatar || null,
            lastMessage: lastMsgText,
            time: lastMsgTime,
            unread,
            isGroup: chat.is_group,
            isMe,
            partnerUserId,
            timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : 0,
          };
        })
        .filter(Boolean) as any[];

      formatted.sort((a, b) => b.timestamp - a.timestamp);

      setChats(formatted);
      AsyncStorage.setItem(cacheKey, JSON.stringify(formatted)).catch(() => {});
    } catch (e) {
      console.error("Error fetching chats", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChats();
    if (user) {
      import("../../lib/push").then((m) => m.registerPushNotifications(user.id));
    }
  }, [fetchChats, user]);

  const displayedChats = isDecoyMode ? [] : chats;

  // Filtered & Pinned Chats for Web Mobile
  const filteredAndSortedChats = useMemo(() => {
    let list = displayedChats;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aPinned = pinnedChatIds.includes(a.id);
      const bPinned = pinnedChatIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [displayedChats, searchQuery, pinnedChatIds]);

  const resetModal = () => {
    setModalVisible(false);
    setMode("dm");
    setSearchUsername("");
    setSearchError("");
    setGroupName("");
    setGroupMembers([]);
    setMemberInput("");
  };

  const handleStartDM = async () => {
    if (!searchUsername.trim() || !user) return;
    setSearchLoading(true);
    setSearchError("");
    try {
      const { data: tp, error: pe } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", searchUsername.trim())
        .single();
      if (pe || !tp) {
        setSearchError("User not found.");
        setSearchLoading(false);
        return;
      }
      if (tp.id === user.id) {
        setSearchError("You cannot chat with yourself.");
        setSearchLoading(false);
        return;
      }

      const { data: myChats } = await supabase
        .from("chat_participants")
        .select("chat_id, chats(is_group)")
        .eq("user_id", user.id);
      if (myChats && myChats.length > 0) {
        const directChatIds = myChats
          .filter((c: any) => c.chats && !c.chats.is_group)
          .map((c: any) => c.chat_id);
        if (directChatIds.length > 0) {
          const { data: existingPart } = await supabase
            .from("chat_participants")
            .select("chat_id")
            .eq("user_id", tp.id)
            .in("chat_id", directChatIds)
            .limit(1);

          if (existingPart && existingPart.length > 0) {
            const existingChatId = existingPart[0].chat_id;
            resetModal();
            tryEnterFullscreen();
            router.push({ pathname: "/chat", params: { id: existingChatId, name: tp.username } });
            return;
          }
        }
      }

      const uuid = require("react-native-uuid");
      const newChatId = uuid.default ? uuid.default.v4() : uuid.v4();
      const { error: ce } = await supabase
        .from("chats")
        .insert([{ id: newChatId, is_group: false, name: tp.username }]);
      if (ce) throw ce;
      const { error: pe2 } = await supabase.from("chat_participants").insert([
        { chat_id: newChatId, user_id: user.id },
        { chat_id: newChatId, user_id: tp.id },
      ]);
      if (pe2) throw pe2;
      resetModal();
      tryEnterFullscreen();
      router.push({ pathname: "/chat", params: { id: newChatId, name: tp.username } });
    } catch (e: any) {
      setSearchError(e.message || "An error occurred.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberInput.trim()) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", memberInput.trim())
      .single();
    if (!profile) {
      setSearchError("User not found: " + memberInput.trim());
      return;
    }
    if (profile.id === user?.id) {
      setSearchError("Cannot add yourself.");
      return;
    }
    if (groupMembers.find((m) => m.id === profile.id)) {
      setMemberInput("");
      return;
    }
    setGroupMembers((prev) => [...prev, { id: profile.id, username: profile.username }]);
    setMemberInput("");
    setSearchError("");
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0 || !user) return;
    setSearchLoading(true);
    try {
      const uuid = require("react-native-uuid");
      const newChatId = uuid.default ? uuid.default.v4() : uuid.v4();
      const { error: ce } = await supabase
        .from("chats")
        .insert([{ id: newChatId, is_group: true, name: groupName.trim(), created_by: user.id }]);
      if (ce) throw ce;
      const participants = [
        { chat_id: newChatId, user_id: user.id },
        ...groupMembers.map((m) => ({ chat_id: newChatId, user_id: m.id })),
      ];
      const { error: pe } = await supabase.from("chat_participants").insert(participants);
      if (pe) throw pe;
      resetModal();
      tryEnterFullscreen();
      router.push({ pathname: "/chat", params: { id: newChatId, name: groupName.trim(), isGroup: "true" } });
    } catch (e: any) {
      setSearchError(e.message || "An error occurred.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Add Story via ImagePicker
  const handlePickStory = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const newStory: StoryItem = {
          id: `story_${Date.now()}`,
          userId: user?.id || "me",
          userName: "You",
          userAvatar: undefined,
          mediaUrl: result.assets[0].uri,
          timestamp: Date.now(),
          caption: "My new moment ✨",
        };
        await addStory(newStory);
        refreshCallsAndStories();
      }
    } catch (e) {
      console.warn("Story pick error:", e);
    }
  };

  // Initiate call helper
  const handleStartCallWithContact = (contact: any, callType: "audio" | "video") => {
    if (!user || !contact) return;
    setStartCallModalOpen(false);
    const partnerId = contact.partnerUserId || contact.id;
    initiateCall({
      chatId: contact.id,
      callerId: user.id,
      callerName: user.email?.split("@")[0] || "User",
      partnerId,
      partnerName: contact.name,
      partnerAvatar: contact.avatar,
      callType,
    });
    router.push({ pathname: "/chat", params: { id: contact.id, name: contact.name } });
  };

  // Native Mobile Item Renderer (PRESERVED EXACTLY AS ORIGINAL)
  const renderNativeItem = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.7}
        onPress={() => {
          tryEnterFullscreen();
          router.push({
            pathname: "/chat",
            params: { id: item.id, name: item.name, isGroup: item.isGroup ? "true" : "false" },
          });
        }}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            {item.isGroup ? <Users size={24} color={theme.textMuted} /> : <User size={24} color={theme.textMuted} />}
          </View>
        )}
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, item.unread > 0 && styles.chatNameUnread]}>{item.name}</Text>
            <Text style={[styles.chatTime, item.unread > 0 && { color: theme.text, fontWeight: "bold" }]}>
              {item.time}
            </Text>
          </View>
          <View style={styles.messageRow}>
            <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.unread > 0 && <View style={styles.badge} />}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [styles, theme, router]
  );

  // Loading Screen
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ShinyText
          text="Loading AlaThing..."
          speed={1.8}
          color="#777777"
          shineColor="#ffffff"
          spread={120}
          style={{
            fontSize: 24,
            fontWeight: "700",
            fontFamily: "'Josefin Sans', sans-serif",
            letterSpacing: 0.8,
          }}
        />
      </View>
    );
  }

  // 1. Desktop Web View (PRESERVED UNTOUCHED)
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.background }}>
        <View style={{ width: 380, height: "100%" }}>
          <ChatSidebar
            onSelectChat={(chatId, name) => {
              tryEnterFullscreen();
              router.push({ pathname: "/chat", params: { id: chatId, name } });
            }}
          />
        </View>
        <View style={{ flex: 1, height: "100%" }}>
          <DesktopLandingPlaceholder />
        </View>
      </View>
    );
  }

  // 2. Mobile Native App View (PRESERVED UNTOUCHED)
  if (!isWebMobile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerLeft} activeOpacity={0.8}>
              <View style={styles.userAvatarMini}>
                <User size={16} color="#fff" />
              </View>
              <Text style={styles.headerTitle}>AlaThing</Text>
              {isPreAnniversary && (
                <Text
                  style={{
                    fontSize: 13,
                    color: "#fbbf24",
                    marginLeft: 4,
                    textShadowColor: "#fbbf24",
                    textShadowRadius: 6,
                    textShadowOffset: { width: 0, height: 0 },
                  }}
                >
                  ✦
                </Text>
              )}
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {isPinEnabled && !!realPin && (
                <TouchableOpacity style={styles.iconButton} onPress={lockNow} accessibilityLabel="Lock App Now">
                  <Lock size={18} color="#f43f5e" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconButton}>
                <Search size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          {displayedChats.length === 0 ? (
            <View style={styles.centerContainer}>
              <MessageSquare size={64} color={theme.textMuted} />
              <Text style={styles.emptyText}>No chats yet</Text>
              <Text style={styles.emptySubtext}>Tap the + button to start texting!</Text>
            </View>
          ) : (
            <FlatList
              data={displayedChats}
              keyExtractor={(item) => item.id}
              renderItem={renderNativeItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
          <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setModalVisible(true)}>
            <Plus size={32} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // 3. Web Mobile Experience (Dribbble-inspired UI)
  // -------------------------------------------------------------------------
  const totalUnreadCount = displayedChats.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <SafeAreaView style={[webStyles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[webStyles.container, { backgroundColor: theme.background }]}>
        {/* Web Mobile Top Header */}
        <View style={[webStyles.headerRow, { backgroundColor: "transparent" }]}>
          <View style={webStyles.headerLeft}>
            <Text style={[webStyles.brandTitle, { color: theme.text }]}>
              ala thing
            </Text>
            {isPreAnniversary && (
              <Text style={{ fontSize: 13, color: "#fbbf24", marginLeft: 4 }}>✦</Text>
            )}
          </View>

          <View style={webStyles.headerRightIcons}>
            {/* Search Toggle */}
            <TouchableOpacity
              style={[webStyles.circleIconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              onPress={() => setIsSearchOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Search size={18} color={isSearchOpen ? theme.accent : theme.text} />
            </TouchableOpacity>

            {/* Quick Camera / Add Story */}
            <TouchableOpacity
              style={[webStyles.circleIconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              onPress={handlePickStory}
              activeOpacity={0.7}
            >
              <Camera size={18} color={theme.text} />
            </TouchableOpacity>

            {/* 3-Dot More Menu */}
            <TouchableOpacity
              style={[webStyles.circleIconBtn, { backgroundColor: moreMenuOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)" }]}
              onPress={() => setMoreMenuOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <MoreVertical size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3-Dot Dropdown Menu Modal */}
        {moreMenuOpen && (
          <Modal transparent animationType="fade" visible={moreMenuOpen} onRequestClose={() => setMoreMenuOpen(false)}>
            <Pressable style={webStyles.moreMenuBackdrop} onPress={() => setMoreMenuOpen(false)}>
              <View style={[webStyles.moreMenuCard, { backgroundColor: isAmoled ? "#161616" : theme.surface, borderColor: theme.border }]}>
                {/* 1. Change Theme */}
                <TouchableOpacity
                  style={webStyles.moreMenuItem}
                  onPress={() => {
                    setMoreMenuOpen(false);
                    setThemeModalOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[webStyles.moreMenuIconCircle, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
                    <Palette size={16} color={theme.accent || "#f97316"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[webStyles.moreMenuItemTitle, { color: theme.text }]}>Change Theme</Text>
                    <Text style={[webStyles.moreMenuItemSubtitle, { color: theme.textMuted }]}>{theme.name}</Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Lock App (if PIN enabled) */}
                {isPinEnabled && !!realPin && (
                  <TouchableOpacity
                    style={webStyles.moreMenuItem}
                    onPress={() => {
                      setMoreMenuOpen(false);
                      lockNow();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[webStyles.moreMenuIconCircle, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
                      <Lock size={16} color="#f43f5e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[webStyles.moreMenuItemTitle, { color: theme.text }]}>Lock App</Text>
                      <Text style={[webStyles.moreMenuItemSubtitle, { color: theme.textMuted }]}>Require PIN</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 3. Reload / Refresh */}
                <TouchableOpacity
                  style={webStyles.moreMenuItem}
                  onPress={() => {
                    setMoreMenuOpen(false);
                    fetchChats();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[webStyles.moreMenuIconCircle, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                    <RefreshCw size={16} color="#38bdf8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[webStyles.moreMenuItemTitle, { color: theme.text }]}>Refresh</Text>
                    <Text style={[webStyles.moreMenuItemSubtitle, { color: theme.textMuted }]}>Sync messages</Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Profile & Account */}
                <TouchableOpacity
                  style={[webStyles.moreMenuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    setMoreMenuOpen(false);
                    router.push("/profile");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[webStyles.moreMenuIconCircle, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                    <User size={16} color={theme.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[webStyles.moreMenuItemTitle, { color: theme.text }]}>Profile & Account</Text>
                    <Text style={[webStyles.moreMenuItemSubtitle, { color: theme.textMuted }]}>Settings and radar</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Inline Search Bar */}
        {isSearchOpen && (
          <View style={webStyles.searchBarContainer}>
            <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[webStyles.searchInput, { color: theme.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={16} color={theme.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* TAB 1: CHATS (Dribbble Card Feed) */}
        {webTab === "chats" && (
          <View style={{ flex: 1 }}>
            {filteredAndSortedChats.length === 0 ? (
              <View style={webStyles.emptyBox}>
                <MessageSquare size={52} color={theme.textMuted} />
                <Text style={[webStyles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
                <Text style={[webStyles.emptySubtitle, { color: theme.textMuted }]}>
                  Tap + to start a direct message or group
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredAndSortedChats}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isPinned = pinnedChatIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[webStyles.chatRow, { borderBottomColor: "rgba(255,255,255,0.04)" }]}
                      activeOpacity={0.75}
                      onPress={() => {
                        tryEnterFullscreen();
                        router.push({
                          pathname: "/chat",
                          params: { id: item.id, name: item.name, isGroup: item.isGroup ? "true" : "false" },
                        });
                      }}
                      onLongPress={() => setChatMenuModalItem(item)}
                    >
                      {/* Avatar */}
                      <View style={webStyles.avatarWrap}>
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={webStyles.chatAvatarImg} />
                        ) : (
                          <View style={[webStyles.chatAvatarImg, { backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }]}>
                            {item.isGroup ? <Users size={22} color="#fff" /> : <User size={22} color="#fff" />}
                          </View>
                        )}
                      </View>

                      {/* Chat Main Info */}
                      <View style={webStyles.chatInfoCol}>
                        <View style={webStyles.chatTopLine}>
                          <Text style={[webStyles.contactNameText, { color: theme.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[webStyles.timeAgoText, { color: theme.textMuted }]}>
                            {item.time}
                          </Text>
                        </View>

                        <View style={webStyles.chatBottomLine}>
                          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
                            {item.isMe && (
                              <CheckCheck size={14} color="#38bdf8" />
                            )}
                            <Text
                              style={[
                                webStyles.previewText,
                                { color: item.unread > 0 ? theme.text : theme.textMuted },
                                item.unread > 0 && { fontWeight: "700" },
                              ]}
                              numberOfLines={1}
                            >
                              {item.lastMessage}
                            </Text>
                          </View>

                          {/* Pin & Unread Badges Cluster */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 }}>
                            {isPinned && (
                              <Pin size={13} color={theme.accent || "#f97316"} style={{ transform: [{ rotate: "45deg" }] }} />
                            )}
                            {item.unread > 0 && (
                              <View style={webStyles.unreadBadgeCircle}>
                                <Text style={webStyles.unreadBadgeText}>
                                  {item.unread}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* TAB 2: CALLS (Call Logs & Quick Dial) */}
        {webTab === "calls" && (
          <View style={{ flex: 1 }}>
            <View style={webStyles.subHeaderRow}>
              <Text style={[webStyles.subHeaderTitle, { color: theme.text }]}>Recent Calls</Text>
              <TouchableOpacity
                style={[webStyles.pillActionBtn, { backgroundColor: theme.accent || "#f97316" }]}
                onPress={() => setStartCallModalOpen(true)}
              >
                <Phone size={14} color="#fff" />
                <Text style={webStyles.pillActionBtnText}>New Call</Text>
              </TouchableOpacity>
            </View>

            {callLogs.length === 0 ? (
              <View style={webStyles.emptyBox}>
                <Phone size={52} color={theme.textMuted} />
                <Text style={[webStyles.emptyTitle, { color: theme.text }]}>No call history</Text>
                <Text style={[webStyles.emptySubtitle, { color: theme.textMuted }]}>
                  Calls you make or receive will show up here
                </Text>
              </View>
            ) : (
              <FlatList
                data={callLogs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isMissed = item.direction === "missed";
                  const isIncoming = item.direction === "incoming";
                  const isOutgoing = item.direction === "outgoing";

                  return (
                    <View style={[webStyles.chatRow, { borderBottomColor: "rgba(255,255,255,0.04)" }]}>
                      <View style={webStyles.avatarWrap}>
                        {item.partnerAvatar ? (
                          <Image source={{ uri: item.partnerAvatar }} style={webStyles.chatAvatarImg} />
                        ) : (
                          <View style={[webStyles.chatAvatarImg, { backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }]}>
                            <User size={22} color="#fff" />
                          </View>
                        )}
                      </View>

                      <View style={webStyles.chatInfoCol}>
                        <View style={webStyles.chatTopLine}>
                          <Text style={[webStyles.contactNameText, { color: isMissed ? "#f43f5e" : theme.text }]} numberOfLines={1}>
                            {item.partnerName}
                          </Text>
                          <Text style={[webStyles.timeAgoText, { color: theme.textMuted }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>

                        <View style={webStyles.chatBottomLine}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            {isMissed && <PhoneMissed size={14} color="#f43f5e" />}
                            {isIncoming && <PhoneIncoming size={14} color="#10b981" />}
                            {isOutgoing && <PhoneOutgoing size={14} color="#38bdf8" />}
                            <Text style={{ fontSize: 13, color: theme.textMuted, fontFamily: "Josefin Sans" }}>
                              {item.callType === "video" ? "Video call" : "Audio call"} • {item.duration > 0 ? `${Math.floor(item.duration / 60)}m ${item.duration % 60}s` : "Missed"}
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              const matchChat = displayedChats.find((c) => c.partnerUserId === item.partnerId || c.name === item.partnerName);
                              if (matchChat) {
                                handleStartCallWithContact(matchChat, item.callType);
                              }
                            }}
                            style={{ padding: 6 }}
                          >
                            <Phone size={18} color={theme.accent || "#f97316"} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* TAB 3: UPDATES / STORIES */}
        {webTab === "updates" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={webStyles.subHeaderRow}>
              <Text style={[webStyles.subHeaderTitle, { color: theme.text }]}>Status Updates</Text>
              <TouchableOpacity
                style={[webStyles.pillActionBtn, { backgroundColor: theme.accent || "#f97316" }]}
                onPress={handlePickStory}
              >
                <Plus size={14} color="#fff" />
                <Text style={webStyles.pillActionBtnText}>Add Story</Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal Stories Carousel matching Dribbble Mockup */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 12 }}
            >
              {/* [+] You card */}
              <TouchableOpacity
                style={[webStyles.storyCard, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }]}
                onPress={handlePickStory}
                activeOpacity={0.8}
              >
                <View style={[webStyles.storyAddCircle, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                  <Plus size={22} color="#fff" />
                </View>
                <Text style={[webStyles.storyCardName, { color: theme.text }]}>You</Text>
              </TouchableOpacity>

              {/* Friends' Stories */}
              {stories.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[webStyles.storyCard, { borderColor: theme.accent || "#f97316" }]}
                  onPress={() => setActiveStory(s)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: s.mediaUrl }} style={webStyles.storyCardThumb} />
                  <View style={webStyles.storyCardOverlay}>
                    {s.userAvatar && (
                      <Image source={{ uri: s.userAvatar }} style={webStyles.storyAuthorAvatar} />
                    )}
                    <Text style={webStyles.storyCardName} numberOfLines={1}>
                      {s.userName}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Josefin Sans", marginBottom: 12 }}>
                Recent Moments
              </Text>
              {stories.length === 0 ? (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40, opacity: 0.7 }}>
                  <Sparkles size={28} color={theme.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600", fontFamily: "Josefin Sans", textAlign: "center" }}>
                    No status updates yet
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, fontFamily: "Josefin Sans", textAlign: "center", marginTop: 4 }}>
                    Tap + to share a photo or update!
                  </Text>
                </View>
              ) : (
                stories.map((s) => (
                  <TouchableOpacity
                    key={`list_${s.id}`}
                    style={[webStyles.chatRow, { borderBottomColor: "rgba(255,255,255,0.04)" }]}
                    onPress={() => setActiveStory(s)}
                  >
                    <View style={[webStyles.avatarWrap, { borderColor: theme.accent || "#f97316", borderWidth: 2, padding: 2, borderRadius: 28 }]}>
                      <Image source={{ uri: s.userAvatar || s.mediaUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                    </View>
                    <View style={webStyles.chatInfoCol}>
                      <Text style={[webStyles.contactNameText, { color: theme.text }]}>{s.userName}</Text>
                      <Text style={[webStyles.previewText, { color: theme.textMuted }]}>{s.caption || "Tap to view update"}</Text>
                    </View>
                    <Text style={[webStyles.timeAgoText, { color: theme.textMuted }]}>
                      {new Date(s.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* FLOATING GLASSY 4-TAB NAVIGATION BAR + FLOATING + BUTTON */}
        <View style={webStyles.floatingNavContainer} pointerEvents="box-none">
          <View style={[webStyles.navPill, { backgroundColor: "rgba(24, 20, 18, 0.92)", borderColor: "rgba(255,255,255,0.12)" }]}>
            {/* 1. Chats */}
            <TouchableOpacity
              style={[webStyles.navItemBtn, webTab === "chats" && webStyles.navItemBtnActive]}
              onPress={() => setWebTab("chats")}
              activeOpacity={0.7}
            >
              <View style={{ position: "relative" }}>
                <MessageCircle size={20} color={webTab === "chats" ? "#ffffff" : "rgba(255,255,255,0.45)"} />
                {totalUnreadCount > 0 && (
                  <View style={webStyles.pillTabBadge} />
                )}
              </View>
              <Text style={[webStyles.navItemText, webTab === "chats" && webStyles.navItemTextActive]}>
                Chats
              </Text>
            </TouchableOpacity>

            {/* 2. Call */}
            <TouchableOpacity
              style={[webStyles.navItemBtn, webTab === "calls" && webStyles.navItemBtnActive]}
              onPress={() => setWebTab("calls")}
              activeOpacity={0.7}
            >
              <Phone size={19} color={webTab === "calls" ? "#ffffff" : "rgba(255,255,255,0.45)"} />
              <Text style={[webStyles.navItemText, webTab === "calls" && webStyles.navItemTextActive]}>
                Call
              </Text>
            </TouchableOpacity>

            {/* 3. Updates */}
            <TouchableOpacity
              style={[webStyles.navItemBtn, webTab === "updates" && webStyles.navItemBtnActive]}
              onPress={() => setWebTab("updates")}
              activeOpacity={0.7}
            >
              <CircleDot size={20} color={webTab === "updates" ? "#ffffff" : "rgba(255,255,255,0.45)"} />
              <Text style={[webStyles.navItemText, webTab === "updates" && webStyles.navItemTextActive]}>
                Updates
              </Text>
            </TouchableOpacity>

            {/* 4. Profile */}
            <TouchableOpacity
              style={webStyles.navItemBtn}
              onPress={() => router.push("/profile")}
              activeOpacity={0.7}
            >
              <User size={20} color="rgba(255,255,255,0.45)" />
              <Text style={webStyles.navItemText}>Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Floating Circular Plus Action Button */}
          <TouchableOpacity
            style={[webStyles.floatingPlusBtn, { backgroundColor: theme.accent || "#f97316" }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* QUICK CHAT MENU MODAL (Pin / Unpin) */}
        {chatMenuModalItem && (
          <Modal transparent animationType="fade" visible onRequestClose={() => setChatMenuModalItem(null)}>
            <Pressable style={webStyles.modalBackdrop} onPress={() => setChatMenuModalItem(null)}>
              <View style={[webStyles.quickMenuSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[webStyles.quickMenuTitle, { color: theme.text }]}>
                  {chatMenuModalItem.name}
                </Text>

                <TouchableOpacity
                  style={webStyles.quickMenuRow}
                  onPress={() => togglePinChat(chatMenuModalItem.id)}
                >
                  <Pin size={18} color={theme.accent || "#f97316"} />
                  <Text style={[webStyles.quickMenuText, { color: theme.text }]}>
                    {pinnedChatIds.includes(chatMenuModalItem.id) ? "Unpin chat" : "Pin to top 📌"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.quickMenuRow}
                  onPress={() => {
                    setChatMenuModalItem(null);
                    router.push({
                      pathname: "/chat",
                      params: { id: chatMenuModalItem.id, name: chatMenuModalItem.name },
                    });
                  }}
                >
                  <MessageCircle size={18} color={theme.text} />
                  <Text style={[webStyles.quickMenuText, { color: theme.text }]}>Open conversation</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}

        {/* THEME SWITCHER MODAL */}
        <Modal transparent animationType="slide" visible={themeModalOpen} onRequestClose={() => setThemeModalOpen(false)}>
          <View style={webStyles.modalBackdrop}>
            <View style={[webStyles.themeModalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Palette size={20} color={theme.accent || "#f97316"} />
                  <Text style={[webStyles.themeModalTitle, { color: theme.text }]}>Select Theme</Text>
                </View>
                <TouchableOpacity onPress={() => setThemeModalOpen(false)}>
                  <X size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {Object.values(THEMES).map((t) => {
                  const isSelected = theme.id === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        webStyles.themeOptionRow,
                        { backgroundColor: t.background, borderColor: isSelected ? t.accent : "rgba(255,255,255,0.08)" },
                      ]}
                      onPress={() => {
                        setTheme(t.id);
                        setThemeModalOpen(false);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent }} />
                        <Text style={{ color: t.text, fontWeight: "700", fontSize: 15, fontFamily: "Josefin Sans" }}>
                          {t.name}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={t.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* START A CALL MODAL */}
        <Modal transparent animationType="slide" visible={startCallModalOpen} onRequestClose={() => setStartCallModalOpen(false)}>
          <View style={webStyles.modalBackdrop}>
            <View style={[webStyles.themeModalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={[webStyles.themeModalTitle, { color: theme.text }]}>Start a Call</Text>
                <TouchableOpacity onPress={() => setStartCallModalOpen(false)}>
                  <X size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {displayedChats.map((c) => (
                  <View
                    key={`call_pick_${c.id}`}
                    style={[webStyles.chatRow, { paddingHorizontal: 0, borderBottomColor: "rgba(255,255,255,0.04)" }]}
                  >
                    <Image source={{ uri: c.avatar || "https://ui-avatars.com/api/?name=U" }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[webStyles.contactNameText, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={[webStyles.circleIconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
                        onPress={() => handleStartCallWithContact(c, "audio")}
                      >
                        <Phone size={16} color={theme.accent || "#f97316"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[webStyles.circleIconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
                        onPress={() => handleStartCallWithContact(c, "video")}
                      >
                        <Video size={16} color="#38bdf8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* FULL SCREEN STORY VIEWER MODAL */}
        {activeStory && (
          <Modal transparent animationType="fade" visible onRequestClose={() => setActiveStory(null)}>
            <View style={webStyles.storyViewerOverlay}>
              <Image source={{ uri: activeStory.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              <View style={webStyles.storyViewerHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {activeStory.userAvatar && (
                    <Image source={{ uri: activeStory.userAvatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  )}
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, fontFamily: "Josefin Sans" }}>
                    {activeStory.userName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveStory(null)}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {activeStory.caption && (
                <View style={webStyles.storyCaptionBox}>
                  <Text style={webStyles.storyCaptionText}>{activeStory.caption}</Text>
                </View>
              )}
            </View>
          </Modal>
        )}

        {/* START NEW CHAT / GROUP MODAL */}
        <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={resetModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>{mode === "dm" ? "Start a Chat" : "New Group"}</Text>

              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === "dm" && styles.modeBtnActive]}
                  onPress={() => {
                    setMode("dm");
                    setSearchError("");
                  }}
                >
                  <User size={16} color={mode === "dm" ? "#fff" : theme.textMuted} />
                  <Text style={[styles.modeBtnText, mode === "dm" && styles.modeBtnTextActive]}>Direct</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === "group" && styles.modeBtnActive]}
                  onPress={() => {
                    setMode("group");
                    setSearchError("");
                  }}
                >
                  <Users size={16} color={mode === "group" ? "#fff" : theme.textMuted} />
                  <Text style={[styles.modeBtnText, mode === "group" && styles.modeBtnTextActive]}>Group</Text>
                </TouchableOpacity>
              </View>

              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

              {mode === "dm" ? (
                <>
                  <Text style={styles.modalSubtitle}>Enter your friend&apos;s exact username.</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Username (e.g. jdoe123)"
                    placeholderTextColor={theme.textMuted}
                    value={searchUsername}
                    onChangeText={setSearchUsername}
                    autoCapitalize="none"
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetModal}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.startButton]}
                      onPress={handleStartDM}
                      disabled={searchLoading}
                    >
                      {searchLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.startButtonText}>Start</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Group name"
                    placeholderTextColor={theme.textMuted}
                    value={groupName}
                    onChangeText={setGroupName}
                  />
                  <View style={styles.addMemberRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                      placeholder="Add member username"
                      placeholderTextColor={theme.textMuted}
                      value={memberInput}
                      onChangeText={setMemberInput}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.addMemberBtn} onPress={handleAddMember}>
                      <Plus size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {groupMembers.length > 0 && (
                    <View style={styles.chipsContainer}>
                      {groupMembers.map((m) => (
                        <View key={m.id} style={styles.chip}>
                          <Text style={styles.chipText}>{m.username}</Text>
                          <TouchableOpacity
                            onPress={() => setGroupMembers((prev) => prev.filter((gm) => gm.id !== m.id))}
                          >
                            <X size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetModal}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.startButton]}
                      onPress={handleCreateGroup}
                      disabled={searchLoading || !groupName.trim() || groupMembers.length === 0}
                    >
                      {searchLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.startButtonText}>Create</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Original Styles (preserved for Mobile Native App & General Modals)
// ---------------------------------------------------------------------------
const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.surface },
    container: {
      flex: 1,
      backgroundColor: theme.surface,
      maxWidth: Platform.OS === "web" ? 800 : ("100%" as any),
      width: "100%",
      alignSelf: "center",
      borderLeftWidth: Platform.OS === "web" && theme.id !== "black" ? 1 : 0,
      borderRightWidth: Platform.OS === "web" && theme.id !== "black" ? 1 : 0,
      borderColor: theme.id === "black" ? "#000000" : theme.border,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    userAvatarMini: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      marginRight: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: -0.5,
      fontFamily: "Josefin Sans",
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    listContainer: { paddingTop: 8, paddingBottom: 120 },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
    emptyText: { color: theme.text, fontSize: 18, fontWeight: "600", fontFamily: "Josefin Sans", marginTop: 16 },
    emptySubtext: { color: theme.textMuted, fontSize: 14, fontFamily: "Josefin Sans", marginTop: 8 },
    chatItem: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
    avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: theme.background },
    avatarFallback: { justifyContent: "center", alignItems: "center" },
    chatContent: { flex: 1, justifyContent: "center" },
    chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    chatName: {
      color: theme.id === "light" ? "#111111" : theme.id === "pink" ? "#5c0a2e" : theme.text,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    chatNameUnread: {
      color: theme.id === "light" ? "#000000" : theme.id === "pink" ? "#4a0724" : theme.text,
      fontWeight: "900",
      fontFamily: "Josefin Sans",
    },
    chatTime: { color: theme.textMuted, fontSize: 12, fontWeight: "500", fontFamily: "Josefin Sans" },
    messageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    lastMessage: {
      color: theme.id === "light" ? "#444444" : theme.id === "pink" ? "#9d174d" : theme.textMuted,
      fontSize: 15,
      flex: 1,
      paddingRight: 16,
      fontFamily: "Josefin Sans",
    },
    lastMessageUnread: {
      color: theme.id === "light" ? "#000000" : theme.id === "pink" ? "#4a0724" : theme.text,
      fontWeight: "800",
      fontFamily: "Josefin Sans",
    },
    badge: { backgroundColor: "#f23f43", borderRadius: 4, width: 8, height: 8, alignSelf: "center", marginLeft: 8 },
    badgeText: { color: theme.text, fontSize: 12, fontWeight: "bold", fontFamily: "Josefin Sans" },
    fab: {
      position: "absolute",
      bottom: 100,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modalView: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 10,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
      fontFamily: "Josefin Sans",
      marginBottom: 16,
      textAlign: "center",
    },
    modeToggle: { flexDirection: "row", backgroundColor: theme.border, borderRadius: 8, padding: 4, marginBottom: 20 },
    modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6, gap: 6 },
    modeBtnActive: { backgroundColor: theme.accent },
    modeBtnText: { color: theme.textMuted, fontSize: 14, fontWeight: "600", fontFamily: "Josefin Sans" },
    modeBtnTextActive: { color: "#ffffff", fontWeight: "700", fontFamily: "Josefin Sans" },
    modalSubtitle: { color: theme.textMuted, fontSize: 14, fontFamily: "Josefin Sans", marginBottom: 16, textAlign: "center" },
    errorText: { color: "#f23f43", fontSize: 13, fontFamily: "Josefin Sans", marginBottom: 12, textAlign: "center" },
    modalInput: {
      backgroundColor: theme.border,
      color: theme.text,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: "Josefin Sans",
      marginBottom: 16,
    },
    addMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    addMemberBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
    chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipText: { color: theme.text, fontSize: 14, fontFamily: "Josefin Sans" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, minWidth: 80, alignItems: "center" },
    cancelButton: { backgroundColor: "transparent" },
    cancelButtonText: { color: theme.text, fontSize: 14, fontWeight: "600", fontFamily: "Josefin Sans" },
    startButton: { backgroundColor: theme.accent },
    startButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700", fontFamily: "Josefin Sans" },
  });

// ---------------------------------------------------------------------------
// Web Mobile Specific Styles (Matching Dribbble Reference)
// ---------------------------------------------------------------------------
const webStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    letterSpacing: -0.6,
  },
  headerRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Josefin Sans",
    outlineStyle: "none" as any,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  avatarWrap: {
    position: "relative",
    marginRight: 14,
  },
  chatAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  onlineDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f97316",
    borderWidth: 2,
    borderColor: "#181210",
  },
  chatInfoCol: {
    flex: 1,
    justifyContent: "center",
  },
  chatTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  contactNameText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
    letterSpacing: -0.2,
  },
  timeAgoText: {
    fontSize: 12,
    fontFamily: "Josefin Sans",
  },
  chatBottomLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewText: {
    fontSize: 14,
    fontFamily: "Josefin Sans",
  },
  unreadBadgeCircle: {
    backgroundColor: "#f43f5e",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
  subHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  subHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
  pillActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillActionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
  storyCard: {
    width: 86,
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  storyAddCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  storyCardThumb: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  storyCardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  storyAuthorAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  storyCardName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Josefin Sans",
  },
  floatingNavContainer: {
    position: "absolute",
    bottom: 19,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 9999,
  },
  navPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    width: 280,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        } as any)
      : {}),
  },
  navItemBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  navItemBtnActive: {},
  navItemText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
    color: "rgba(255,255,255,0.45)",
  },
  navItemTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  pillTabBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#f43f5e",
  },
  floatingPlusBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
          cursor: "pointer",
        } as any)
      : {}),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  quickMenuSheet: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  quickMenuTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    marginBottom: 4,
  },
  quickMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  quickMenuText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  themeModalBox: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  themeModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
  themeOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  storyViewerOverlay: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
    padding: 20,
  },
  storyViewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 100,
  },
  storyCaptionBox: {
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    marginBottom: 20,
  },
  storyCaptionText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Josefin Sans",
    textAlign: "center",
  },
  moreMenuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  moreMenuCard: {
    position: "absolute",
    top: 64,
    right: 16,
    width: 220,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 10000,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
        } as any)
      : {}),
  },
  moreMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  moreMenuIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  moreMenuItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  moreMenuItemSubtitle: {
    fontSize: 11,
    fontFamily: "Josefin Sans",
    marginTop: 1,
  },
});
