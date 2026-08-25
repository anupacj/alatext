import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  SafeAreaView, Platform, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { User, Search, MessageSquare, Plus, Users, X, Check, Settings } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function Home() {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<{ id: string; username: string }[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [notificationPref, setNotificationPref] = useState('concealed_limited');

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("notification_preference").eq("id", user.id).single().then(({ data }) => {
        if (data?.notification_preference) setNotificationPref(data.notification_preference);
      });
    }
  }, [user]);

  const saveNotificationPref = async (val: string) => {
    setNotificationPref(val);
    const { error } = await supabase.from("profiles").update({ notification_preference: val }).eq("id", user!.id);
    if (!error) {
      alert("Notification preference updated successfully!");
    } else {
      alert("Failed to update preference.");
    }
  };

  const fetchChats = useCallback(async () => {
    if (!user) return;
    try {
      const cacheKey = `user_${user.id}_chats`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setChats(prev => prev.length === 0 ? JSON.parse(cached) : prev);
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
              profiles ( username, display_name, avatar_url )
            )
          )
        `)
        .eq("user_id", user.id);
      if (error) throw error;

      // For each chat, fetch last message
      const formatted = await Promise.all((data || []).map(async (item: any) => {
        const chat = item.chats;
        if (!chat) return null;
        let chatName = chat.name || "Chat";
        let chatAvatar = chat.avatar_url;
        if (!chat.is_group && chat.chat_participants) {
          const other = chat.chat_participants.find((p: any) => p.user_id !== user.id)?.profiles;
          if (other) { chatName = other.display_name || other.username; chatAvatar = other.avatar_url; }
        }
        const { data: lastMsgData } = await supabase
          .from("messages")
          .select("content, type, created_at")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const lastMsg = lastMsgData?.[0];
        const lastMsgText = lastMsg
          ? lastMsg.type === "image" ? "📷 Image" : lastMsg.content
          : "Tap to view messages...";
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
      }));
      const valid = formatted.filter(Boolean) as any[];
      valid.sort((a, b) => b.timestamp - a.timestamp);
      
      setChats(valid);
      AsyncStorage.setItem(`user_${user.id}_chats`, JSON.stringify(valid)).catch(() => {});
    } catch (e) { console.error("Error fetching chats", e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { 
    fetchChats(); 
    if (user) {
      import("../../lib/push").then(m => m.registerPushNotifications(user.id));
    }
  }, [fetchChats, user]);

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
      router.push({ pathname: "/chat", params: { id: newChatId, name: tp.username } });
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
      router.push({ pathname: "/chat", params: { id: newChatId, name: groupName.trim() } });
    } catch (e: any) { setSearchError(e.message || "An error occurred."); }
    finally { setSearchLoading(false); }
  };

  const renderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity style={styles.chatItem} activeOpacity={0.7}
      onPress={() => router.push({ pathname: "/chat", params: { id: item.id, name: item.name, avatar: item.avatar || "" } })}>
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
          <Text style={[styles.chatTime, item.unread > 0 && { color: theme.text, fontWeight: "bold" }]}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unread > 0 && <View style={styles.badge}></View>}
        </View>
      </View>
    </TouchableOpacity>
  ), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.userAvatarMini}><User size={16} color="#fff" /></View>
            <Text style={styles.headerTitle}>ala chat</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsModalVisible(true)}><Settings size={20} color={theme.textMuted} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}><Search size={20} color={theme.textMuted} /></TouchableOpacity>
          </View>
        </View>
        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.accent} /></View>
        ) : chats.length === 0 ? (
          <View style={styles.centerContainer}>
            <MessageSquare size={64} color={theme.textMuted} />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to start texting!</Text>
          </View>
        ) : (
          <FlatList data={chats} keyExtractor={item => item.id} renderItem={renderItem}
            contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false} />
        )}
        <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setModalVisible(true)}>
          <Plus size={32} color="#ffffff" />
        </TouchableOpacity>

        <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={resetModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>{mode === "dm" ? "Start a Chat" : "New Group"}</Text>

              {/* Mode toggle */}
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
                    <View style={styles.chipsContainer}>
                      {groupMembers.map(m => (
                        <View key={m.id} style={styles.chip}>
                          <Text style={styles.chipText}>{m.username}</Text>
                          <TouchableOpacity onPress={() => setGroupMembers(prev => prev.filter(gm => gm.id !== m.id))}>
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
                    <TouchableOpacity style={[styles.modalButton, styles.startButton]} onPress={handleCreateGroup}
                      disabled={searchLoading || !groupName.trim() || groupMembers.length === 0}>
                      {searchLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.startButtonText}>Create</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
        <Modal animationType="fade" transparent visible={settingsModalVisible} onRequestClose={() => setSettingsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={styles.modalTitle}>App Settings</Text>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)}><X size={24} color={theme.textMuted} /></TouchableOpacity>
              </View>
              
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>Notifications</Text>
              
              <TouchableOpacity 
                style={[styles.modeBtn, { marginBottom: 8, justifyContent: "flex-start", padding: 12 }, notificationPref === "concealed_limited" && styles.modeBtnActive]} 
                onPress={() => saveNotificationPref("concealed_limited")}
              >
                <Text style={[styles.modeBtnText, notificationPref === "concealed_limited" && styles.modeBtnTextActive]}>?? Concealed & Limited (1/hr)</Text>
                <Text style={{ color: notificationPref === "concealed_limited" ? "#e0e1e5" : theme.textMuted, fontSize: 12, marginTop: 4 }}>Shows "Potato delivery". Max 1 notification per hour.</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modeBtn, { justifyContent: "flex-start", padding: 12 }, notificationPref === "unconcealed_limitless" && styles.modeBtnActive]} 
                onPress={() => saveNotificationPref("unconcealed_limitless")}
              >
                <Text style={[styles.modeBtnText, notificationPref === "unconcealed_limitless" && styles.modeBtnTextActive]}>?? Unconcealed & Limitless</Text>
                <Text style={{ color: notificationPref === "unconcealed_limitless" ? "#e0e1e5" : theme.textMuted, fontSize: 12, marginTop: 4 }}>Shows the actual message. No cooldown limit.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, { justifyContent: "flex-start", padding: 12, marginTop: 8 }]} onPress={async () => { if (typeof window !== "undefined" && "Notification" in window) { if (Notification.permission === "denied") { alert("Your browser is blocking notifications! Click the padlock icon next to the URL, change Notifications to Allow, and refresh the page."); } else { const perm = await Notification.requestPermission(); if (perm === "granted") alert("Notifications enabled!"); } } }}>
                <Text style={styles.modeBtnText}>?? Request / Check Notification Permission</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.surface },
  container: { flex: 1, backgroundColor: theme.surface, maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: Platform.OS === "web" ? 1 : 0, borderRightWidth: Platform.OS === "web" ? 1 : 0, borderColor: theme.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  userAvatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent, marginRight: 12, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: theme.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.border, justifyContent: "center", alignItems: "center" },
  listContainer: { paddingTop: 8, paddingBottom: 120 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyText: { color: theme.text, fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySubtext: { color: theme.textMuted, fontSize: 14, marginTop: 8 },
  chatItem: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: theme.background },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  chatContent: { flex: 1, justifyContent: "center" },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  chatName: { color: (theme.id === "light" || theme.id === "pink") ? "#000000" : theme.text, fontSize: 17, fontWeight: "600" },
  chatNameUnread: { color: (theme.id === "light" || theme.id === "pink") ? "#000000" : theme.text, fontWeight: "900" },
  chatTime: { color: theme.textMuted, fontSize: 12, fontWeight: "500" },
  messageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { color: theme.textMuted, fontSize: 15, flex: 1, paddingRight: 16 },
  lastMessageUnread: { color: theme.text, fontWeight: "800" },
  badge: { backgroundColor: "#f23f43", borderRadius: 4, width: 8, height: 8, alignSelf: "center", marginLeft: 8 },
  badgeText: { color: theme.text, fontSize: 12, fontWeight: "bold" },
  fab: { position: "absolute", bottom: 100, right: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalView: { width: "100%", maxWidth: 400, backgroundColor: theme.background, borderRadius: 8, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  modeToggle: { flexDirection: "row", backgroundColor: theme.border, borderRadius: 8, padding: 4, marginBottom: 20 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6, gap: 6 },
  modeBtnActive: { backgroundColor: theme.accent },
  modeBtnText: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
  modeBtnTextActive: { color: theme.text },
  modalSubtitle: { color: theme.textMuted, fontSize: 14, marginBottom: 16, textAlign: "center" },
  errorText: { color: "#f23f43", fontSize: 13, marginBottom: 12, textAlign: "center" },
  modalInput: { backgroundColor: theme.border, color: theme.text, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  addMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  addMemberBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: theme.text, fontSize: 14 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, minWidth: 80, alignItems: "center" },
  cancelButton: { backgroundColor: "transparent" },
  cancelButtonText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  startButton: { backgroundColor: theme.accent },
  startButtonText: { color: theme.text, fontSize: 14, fontWeight: "600" },
});







