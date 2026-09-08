import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Modal, TextInput, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { User, Search, MessageSquare, Plus, Users, Lock, Maximize2, Minimize2, Settings } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAlaPin } from "../context/AlaPinContext";
import ShinyText from "./ShinyText";

interface ChatSidebarProps {
  activeChatId?: string;
  onSelectChat?: (chatId: string, name: string, avatar: string) => void;
}

export default function ChatSidebar({ activeChatId, onSelectChat }: ChatSidebarProps) {
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";
  const { isDecoyMode, isPinEnabled, realPin, lockNow } = useAlaPin();
  const styles = React.useMemo(() => createStyles(theme, isAmoled), [theme, isAmoled]);
  const router = useRouter();
  const { user } = useAuth();
  
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<{ id: string; username: string }[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
        if (data) setMyProfile(data);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
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
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
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
              profiles ( username, display_name, avatar_url )
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
        .select("chat_id, content, type, created_at")
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

      const formatted = data.map((item: any) => {
        const chat = item.chats;
        if (!chat) return null;
        let chatName = chat.name || "Chat";
        let chatAvatar = chat.avatar_url;
        if (!chat.is_group && chat.chat_participants) {
          const myPart = chat.chat_participants.find((p: any) => p.user_id === user.id);
          const otherPart = chat.chat_participants.find((p: any) => p.user_id !== user.id);
          const other = otherPart?.profiles;
          if (other) { chatName = myPart?.nickname || other.display_name || other.username; chatAvatar = other.avatar_url; }
        }

        const lastMsg = lastMsgMap[chat.id];
        let lastMsgText = "Tap to view messages...";
        if (lastMsg) {
          if (lastMsg.type === "image") lastMsgText = "📷 Image";
          else if (lastMsg.type === "video") lastMsgText = "🎥 Video";
          else if (lastMsg.type === "audio") lastMsgText = "🎵 Voice note";
          else if (lastMsg.type === "alert" || lastMsg.content?.startsWith('{"title":')) lastMsgText = "🚨 Custom Alert";
          else lastMsgText = lastMsg.content;
        }
        const lastMsgTime = lastMsg
          ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";

        let unread = 0;
        if (lastMsg) {
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
          timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : 0
        };
      }).filter(Boolean) as any[];

      formatted.sort((a, b) => b.timestamp - a.timestamp);
      
      setChats(formatted);
      AsyncStorage.setItem(cacheKey, JSON.stringify(formatted)).catch(() => {});
    } catch (e) { console.error("Error fetching chats", e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { 
    fetchChats(); 
  }, [fetchChats]);

  const resetModal = () => {
    setModalVisible(false); setMode("dm"); setSearchUsername(""); setSearchError("");
    setGroupName(""); setGroupMembers([]); setMemberInput("");
  };

  const handleStartDM = async () => {
    if (!searchUsername.trim() || !user) return;
    setSearchLoading(true); setSearchError("");
    try {
      const { data: tp, error: pe } = await supabase.from("profiles").select("id, username").eq("username", searchUsername.trim()).single();
      if (pe || !tp) { setSearchError("User not found."); setSearchLoading(false); return; }
      if (tp.id === user.id) { setSearchError("You cannot chat with yourself."); setSearchLoading(false); return; }

      const { data: myChats } = await supabase.from("chat_participants").select("chat_id, chats(is_group)").eq("user_id", user.id);
      if (myChats && myChats.length > 0) {
        const directChatIds = myChats.filter((c: any) => c.chats && !c.chats.is_group).map((c: any) => c.chat_id);
        if (directChatIds.length > 0) {
          const { data: existingPart } = await supabase.from("chat_participants")
            .select("chat_id")
            .eq("user_id", tp.id)
            .in("chat_id", directChatIds)
            .limit(1);

          if (existingPart && existingPart.length > 0) {
            const existingChatId = existingPart[0].chat_id;
            resetModal();
            if (onSelectChat) onSelectChat(existingChatId, tp.username, "");
            else router.push({ pathname: "/chat", params: { id: existingChatId, name: tp.username } });
            return;
          }
        }
      }

      const uuid = require("react-native-uuid");
      const newChatId = uuid.default ? uuid.default.v4() : uuid.v4();
      const { error: ce } = await supabase.from("chats").insert([{ id: newChatId, is_group: false, name: tp.username }]);
      if (ce) throw ce;
      const { error: pe2 } = await supabase.from("chat_participants").insert([
        { chat_id: newChatId, user_id: user.id },
        { chat_id: newChatId, user_id: tp.id },
      ]);
      if (pe2) throw pe2;
      resetModal();
      if (onSelectChat) onSelectChat(newChatId, tp.username, "");
      else router.push({ pathname: "/chat", params: { id: newChatId, name: tp.username } });
    } catch (e: any) { setSearchError(e.message || "An error occurred."); }
    finally { setSearchLoading(false); }
  };

  const handleAddMember = async () => {
    if (!memberInput.trim()) return;
    const { data: profile } = await supabase.from("profiles").select("id, username").eq("username", memberInput.trim()).single();
    if (!profile) { setSearchError("User not found: " + memberInput.trim()); return; }
    if (profile.id === user?.id) { setSearchError("Cannot add yourself."); return; }
    if (groupMembers.find(m => m.id === profile.id)) { setMemberInput(""); return; }
    setGroupMembers(prev => [...prev, { id: profile.id, username: profile.username }]);
    setMemberInput(""); setSearchError("");
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0 || !user) return;
    setSearchLoading(true);
    try {
      const uuid = require("react-native-uuid");
      const newChatId = uuid.default ? uuid.default.v4() : uuid.v4();
      const { error: ce } = await supabase.from("chats").insert([{ id: newChatId, is_group: true, name: groupName.trim() }]);
      if (ce) throw ce;
      const participants = [{ chat_id: newChatId, user_id: user.id }, ...groupMembers.map(m => ({ chat_id: newChatId, user_id: m.id }))];
      const { error: pe } = await supabase.from("chat_participants").insert(participants);
      if (pe) throw pe;
      resetModal();
      if (onSelectChat) onSelectChat(newChatId, groupName.trim(), "");
      else router.push({ pathname: "/chat", params: { id: newChatId, name: groupName.trim() } });
    } catch (e: any) { setSearchError(e.message || "An error occurred."); }
    finally { setSearchLoading(false); }
  };

  const displayedChats = isDecoyMode
    ? []
    : chats.filter(c => 
        !searchFilter.trim() || 
        c.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
        c.lastMessage.toLowerCase().includes(searchFilter.toLowerCase())
      );

  const handleChatItemPress = (item: any) => {
    if (onSelectChat) {
      onSelectChat(item.id, item.name, item.avatar || "");
    } else {
      router.push({ pathname: "/chat", params: { id: item.id, name: item.name } });
    }
  };

  const renderItem = useCallback(({ item }: { item: any }) => {
    const isActive = activeChatId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          isActive && styles.chatItemActive,
        ]}
        activeOpacity={0.7}
        onPress={() => handleChatItemPress(item)}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            {item.isGroup ? <Users size={22} color={theme.textMuted} /> : <User size={22} color={theme.textMuted} />}
          </View>
        )}
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, isActive && { color: theme.accent || "#5865F2" }, item.unread > 0 && styles.chatNameUnread]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.chatTime, item.unread > 0 && { color: theme.text, fontWeight: "bold" }]}>{item.time}</Text>
          </View>
          <View style={styles.messageRow}>
            <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.unread > 0 && <View style={styles.badge} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, theme, activeChatId]);

  return (
    <View style={styles.sidebarContainer}>
      {/* DESKTOP HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => router.push("/profile")}>
          {myProfile?.avatar_url ? (
            <Image source={{ uri: myProfile.avatar_url }} style={styles.userAvatarMiniImg} />
          ) : (
            <View style={styles.userAvatarMini}><User size={16} color="#fff" /></View>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>AlaThing</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {isPinEnabled && !!realPin && (
            <TouchableOpacity style={styles.iconButton} onPress={lockNow} accessibilityLabel="Lock App Now">
              <Lock size={18} color="#f43f5e" />
            </TouchableOpacity>
          )}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={toggleFullscreen}
              accessibilityLabel={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            >
              {isFullscreen ? (
                <Minimize2 size={18} color={theme.accent} />
              ) : (
                <Maximize2 size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/profile")}>
            <Settings size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.accent || "#5865F2" }]} onPress={() => setModalVisible(true)}>
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* QUICK FILTER SEARCH BAR */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarInputBox}>
          <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search or start new chat"
            placeholderTextColor={theme.textMuted}
            value={searchFilter}
            onChangeText={setSearchFilter}
          />
        </View>
      </View>

      {/* RECENT CHATS LIST */}
      {loading ? (
        <View style={[styles.centerContainer, { backgroundColor: isAmoled ? "#000000" : theme.background }]}>
          <ShinyText
            text="Loading AlaThing..."
            speed={1.8}
            color={theme.id === "pink" ? "#be185d" : (theme.id === "light" ? "#888888" : "#777777")}
            shineColor={theme.id === "pink" ? "#831843" : (theme.id === "light" ? "#111111" : "#ffffff")}
            spread={120}
            style={{
              fontSize: 20,
              fontWeight: "700",
              fontFamily: "'Josefin Sans', sans-serif",
              letterSpacing: 0.8,
            }}
          />
        </View>
      ) : displayedChats.length === 0 ? (
        <View style={styles.centerContainer}>
          <MessageSquare size={48} color={theme.textMuted} />
          <Text style={styles.emptyText}>No chats found</Text>
          <Text style={styles.emptySubtext}>Tap + to start texting!</Text>
        </View>
      ) : (
        <FlatList
          data={displayedChats}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* NEW CHAT MODAL */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{mode === "dm" ? "Start a Chat" : "New Group"}</Text>

            <View style={styles.modeToggle}>
              <TouchableOpacity style={[styles.modeBtn, mode === "dm" && styles.modeBtnActive]} onPress={() => { setMode("dm"); setSearchError(""); }}>
                <User size={16} color={mode === "dm" ? "#fff" : theme.textMuted} />
                <Text style={[styles.modeBtnText, mode === "dm" && styles.modeBtnTextActive]}>Direct</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === "group" && styles.modeBtnActive]} onPress={() => { setMode("group"); setSearchError(""); }}>
                <Users size={16} color={mode === "group" ? "#fff" : theme.textMuted} />
                <Text style={[styles.modeBtnText, mode === "group" && styles.modeBtnTextActive]}>Group</Text>
              </TouchableOpacity>
            </View>

            {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

            {mode === "dm" ? (
              <>
                <Text style={styles.modalSubtitle}>Enter your friend&apos;s exact username.</Text>
                <TextInput style={styles.modalInput} placeholder="Username (e.g. jdoe123)" placeholderTextColor={theme.textMuted}
                  value={searchUsername} onChangeText={setSearchUsername} autoCapitalize="none" />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetModal}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.startButton]} onPress={handleStartDM} disabled={searchLoading}>
                    {searchLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.startButtonText}>Start</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TextInput style={styles.modalInput} placeholder="Group name" placeholderTextColor={theme.textMuted}
                  value={groupName} onChangeText={setGroupName} />
                <View style={styles.addMemberRow}>
                  <TextInput style={[styles.modalInput, { flex: 1, marginBottom: 0 }]} placeholder="Add member username"
                    placeholderTextColor={theme.textMuted} value={memberInput} onChangeText={setMemberInput} autoCapitalize="none" />
                  <TouchableOpacity style={styles.addMemberBtn} onPress={handleAddMember}>
                    <Plus size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                {groupMembers.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 10 }}>
                    {groupMembers.map(m => (
                      <View key={m.id} style={{ backgroundColor: theme.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: "#fff", fontSize: 12 }}>@{m.username}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetModal}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.startButton]} onPress={handleCreateGroup} disabled={searchLoading}>
                    {searchLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.startButtonText}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any, isAmoled: boolean) => {
  const isPink = theme.id === "pink";
  const isLight = theme.id === "light";
  return StyleSheet.create({
    sidebarContainer: {
      flex: 1,
      backgroundColor: isAmoled ? "#000000" : (isLight ? "#ffffff" : isPink ? "#fdf2f8" : "#111214"),
      borderRightWidth: 1,
      borderRightColor: isAmoled ? "#222222" : (isLight ? "rgba(0,0,0,0.08)" : isPink ? "rgba(219,39,119,0.12)" : "rgba(255,255,255,0.08)"),
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isAmoled ? "#1a1a1a" : (isLight ? "rgba(0,0,0,0.06)" : isPink ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.06)"),
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    userAvatarMini: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.accent || "#5865F2",
      justifyContent: "center",
      alignItems: "center",
    },
    userAvatarMiniImg: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    headerTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 20,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isAmoled ? "#1a1a1a" : (isLight ? "rgba(0,0,0,0.04)" : isPink ? "rgba(219,39,119,0.08)" : "rgba(255,255,255,0.06)"),
    },
    searchBarContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isAmoled ? "#1a1a1a" : (isLight ? "rgba(0,0,0,0.04)" : isPink ? "rgba(219,39,119,0.08)" : "rgba(255,255,255,0.04)"),
    },
    searchBarInputBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isAmoled ? "#111111" : (isLight ? "#f0f2f5" : isPink ? "#fce7f3" : "rgba(255,255,255,0.06)"),
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 36,
    },
    searchBarInput: {
      flex: 1,
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 13,
      fontFamily: "Josefin Sans",
      outlineStyle: "none" as any,
    },
    listContainer: {
      paddingVertical: 4,
    },
    chatItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isAmoled ? "#111111" : (isLight ? "rgba(0,0,0,0.03)" : isPink ? "rgba(219,39,119,0.08)" : "rgba(255,255,255,0.03)"),
    },
    chatItemActive: {
      backgroundColor: isAmoled ? "#1a1d24" : (isLight ? "#e8f0fe" : isPink ? "rgba(244,114,182,0.22)" : "rgba(88,101,242,0.18)"),
      borderLeftWidth: 3,
      borderLeftColor: theme.accent || "#5865F2",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarFallback: {
      backgroundColor: isAmoled ? "#222" : (isLight ? "#e4e6eb" : isPink ? "#fce7f3" : "rgba(255,255,255,0.08)"),
      justifyContent: "center",
      alignItems: "center",
    },
    chatContent: {
      flex: 1,
      marginLeft: 12,
    },
    chatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
    },
    chatName: {
      fontSize: 15,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
      color: isAmoled ? "#ffffff" : theme.text,
      flex: 1,
      marginRight: 6,
    },
    chatNameUnread: {
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    chatTime: {
      fontSize: 11,
      fontFamily: "Josefin Sans",
      color: theme.textMuted,
    },
    messageRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lastMessage: {
      fontSize: 13,
      fontFamily: "Josefin Sans",
      color: theme.textMuted,
      flex: 1,
    },
    lastMessageUnread: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    badge: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: theme.accent || "#5865F2",
      marginLeft: 6,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyText: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
      marginTop: 12,
    },
    emptySubtext: {
      color: theme.textMuted,
      fontSize: 13,
      fontFamily: "Josefin Sans",
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalView: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: isAmoled ? "#111111" : (isLight ? "#ffffff" : isPink ? "#fdf2f8" : (theme.surface || "#1e1f22")),
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: isAmoled ? "#222" : (isPink ? "rgba(219,39,119,0.2)" : "rgba(255,255,255,0.1)"),
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
      color: isAmoled ? "#ffffff" : theme.text,
      marginBottom: 14,
    },
    modeToggle: {
      flexDirection: "row",
      backgroundColor: isAmoled ? "#222" : (isPink ? "#fce7f3" : isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"),
      borderRadius: 12,
      padding: 3,
      marginBottom: 14,
    },
    modeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    modeBtnActive: {
      backgroundColor: theme.accent || "#5865F2",
    },
    modeBtnText: {
      fontSize: 13,
      color: theme.textMuted,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    modeBtnTextActive: {
      color: "#ffffff",
      fontFamily: "Josefin Sans",
    },
    errorText: {
      color: "#f43f5e",
      fontSize: 13,
      fontFamily: "Josefin Sans",
      marginBottom: 10,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.textMuted,
      fontFamily: "Josefin Sans",
      marginBottom: 10,
    },
    modalInput: {
      backgroundColor: isAmoled ? "#1a1a1a" : (isLight ? "#f0f2f5" : isPink ? "#fce7f3" : "rgba(255,255,255,0.06)"),
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: "Josefin Sans",
      color: isAmoled ? "#ffffff" : theme.text,
      marginBottom: 14,
      outlineStyle: "none" as any,
    },
    addMemberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    addMemberBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.accent || "#5865F2",
      justifyContent: "center",
      alignItems: "center",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 8,
    },
    modalButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: isAmoled ? "#222" : (isPink ? "#fce7f3" : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"),
    },
    cancelButtonText: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 13,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    startButton: {
      backgroundColor: theme.accent || "#5865F2",
    },
    startButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
  });
};
