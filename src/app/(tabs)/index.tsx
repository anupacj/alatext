import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  SafeAreaView, Platform, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { User, Search, MessageSquare, Plus, Users, X, Check } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function Home() {
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

  const fetchChats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(`
          chat_id,
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
          ? lastMsg.type === "image" ? "?? Image" : lastMsg.content
          : "Tap to view messages...";
        const lastMsgTime = lastMsg
          ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";
        return { id: chat.id, name: chatName, avatar: chatAvatar || null, lastMessage: lastMsgText, time: lastMsgTime, unread: 0, isGroup: chat.is_group };
      }));
      setChats(formatted);
    } catch (e) { console.error("Error fetching chats", e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

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
          {item.isGroup ? <Users size={24} color="#b5bac1" /> : <User size={24} color="#b5bac1" />}
        </View>
      )}
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>}
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
          <TouchableOpacity style={styles.iconButton}><Search size={20} color="#b5bac1" /></TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator size="large" color="#5865F2" /></View>
        ) : chats.length === 0 ? (
          <View style={styles.centerContainer}>
            <MessageSquare size={64} color="#4f545c" />
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
                  <User size={16} color={mode === "dm" ? "#fff" : "#949ba4"} />
                  <Text style={[styles.modeBtnText, mode === "dm" && styles.modeBtnTextActive]}>Direct</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, mode === "group" && styles.modeBtnActive]} onPress={() => { setMode("group"); setSearchError(""); }}>
                  <Users size={16} color={mode === "group" ? "#fff" : "#949ba4"} />
                  <Text style={[styles.modeBtnText, mode === "group" && styles.modeBtnTextActive]}>Group</Text>
                </TouchableOpacity>
              </View>

              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

              {mode === "dm" ? (
                <>
                  <Text style={styles.modalSubtitle}>Enter your friend&apos;s exact username.</Text>
                  <TextInput style={styles.modalInput} placeholder="Username (e.g. jdoe123)" placeholderTextColor="#949ba4"
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
                  <TextInput style={styles.modalInput} placeholder="Group name" placeholderTextColor="#949ba4"
                    value={groupName} onChangeText={setGroupName} />
                  <View style={styles.addMemberRow}>
                    <TextInput style={[styles.modalInput, { flex: 1, marginBottom: 0 }]} placeholder="Add member username"
                      placeholderTextColor="#949ba4" value={memberInput} onChangeText={setMemberInput} autoCapitalize="none" />
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
                            <X size={14} color="#b5bac1" style={{ marginLeft: 4 }} />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#2b2d31" },
  container: { flex: 1, backgroundColor: "#2b2d31", maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: Platform.OS === "web" ? 1 : 0, borderRightWidth: Platform.OS === "web" ? 1 : 0, borderColor: "#1e1f22" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, backgroundColor: "#2b2d31", borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  userAvatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#5865F2", marginRight: 12, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#f2f3f5", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1e1f22", justifyContent: "center", alignItems: "center" },
  listContainer: { paddingTop: 8, paddingBottom: 120 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyText: { color: "#f2f3f5", fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySubtext: { color: "#949ba4", fontSize: 14, marginTop: 8 },
  chatItem: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: "#313338" },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  chatContent: { flex: 1, justifyContent: "center" },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  chatName: { color: "#f2f3f5", fontSize: 17, fontWeight: "600" },
  chatTime: { color: "#949ba4", fontSize: 12, fontWeight: "500" },
  messageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { color: "#949ba4", fontSize: 15, flex: 1, paddingRight: 16 },
  lastMessageUnread: { color: "#dbdee1", fontWeight: "500" },
  badge: { backgroundColor: "#f23f43", borderRadius: 12, paddingHorizontal: 6, height: 20, minWidth: 20, justifyContent: "center", alignItems: "center" },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "bold" },
  fab: { position: "absolute", bottom: 100, right: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: "#5865F2", justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalView: { width: "100%", maxWidth: 400, backgroundColor: "#313338", borderRadius: 8, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  modalTitle: { color: "#f2f3f5", fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  modeToggle: { flexDirection: "row", backgroundColor: "#1e1f22", borderRadius: 8, padding: 4, marginBottom: 20 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6, gap: 6 },
  modeBtnActive: { backgroundColor: "#5865F2" },
  modeBtnText: { color: "#949ba4", fontSize: 14, fontWeight: "600" },
  modeBtnTextActive: { color: "#ffffff" },
  modalSubtitle: { color: "#b5bac1", fontSize: 14, marginBottom: 16, textAlign: "center" },
  errorText: { color: "#f23f43", fontSize: 13, marginBottom: 12, textAlign: "center" },
  modalInput: { backgroundColor: "#1e1f22", color: "#dbdee1", borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  addMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  addMemberBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#5865F2", justifyContent: "center", alignItems: "center" },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "#2b2d31", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: "#f2f3f5", fontSize: 14 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, minWidth: 80, alignItems: "center" },
  cancelButton: { backgroundColor: "transparent" },
  cancelButtonText: { color: "#f2f3f5", fontSize: 14, fontWeight: "600" },
  startButton: { backgroundColor: "#5865F2" },
  startButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
});
