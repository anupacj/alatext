import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, FlatList, TextInput, ActivityIndicator, Platform } from "react-native";
import { X, UserPlus, LogOut, Search } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";

export default function ChatInfoModal({ visible, onClose, chatId, isGroup, targetUser, currentUserId }: any) {
  const router = useRouter();
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add member states
  const [addingMember, setAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (visible && isGroup) {
      fetchParticipants();
    } else {
      setLoading(false);
    }
  }, [visible, isGroup]);

  const fetchParticipants = async () => {
    setLoading(true);
    const { data } = await supabase.from("chat_participants").select("user_id, profiles(username, avatar_url, bio)").eq("chat_id", chatId);
    if (data) {
      setParticipants(data.map(p => ({ user_id: p.user_id, ...p.profiles })));
    }
    setLoading(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${text}%`).limit(10);
    // filter out existing members
    if (data) {
      const existingIds = new Set(participants.map(p => p.user_id));
      setSearchResults(data.filter(u => !existingIds.has(u.id)));
    }
    setSearchLoading(false);
  };

  const addMember = async (userId: string) => {
    await supabase.from("chat_participants").insert({ chat_id: chatId, user_id: userId });
    setAddingMember(false);
    setSearchQuery("");
    fetchParticipants();
  };

  const leaveGroup = async () => {
    if (Platform.OS === 'web' && !window.confirm("Leave this group?")) return;
    await supabase.from("chat_participants").delete().eq("chat_id", chatId).eq("user_id", currentUserId);
    onClose();
    router.replace("/");
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}><X size={24} color="#b5bac1" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{isGroup ? "Group Info" : "Profile"}</Text>
          <View style={{ width: 24 }} />
        </View>

        {isGroup ? (
          <View style={{ flex: 1 }}>
            {addingMember ? (
              <View style={styles.addMemberContainer}>
                <View style={styles.searchBar}>
                  <Search size={20} color="#949ba4" />
                  <TextInput 
                    style={styles.searchInput} 
                    placeholder="Search username to add..." 
                    placeholderTextColor="#949ba4" 
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setAddingMember(false)}>
                    <Text style={{ color: "#5865F2" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                {searchLoading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.userRow} onPress={() => addMember(item.id)}>
                        <Image source={{ uri: item.avatar_url || "https://ui-avatars.com/api/?name=U" }} style={styles.avatar} />
                        <Text style={styles.username}>{item.username}</Text>
                        <UserPlus size={20} color="#23a559" />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => setAddingMember(true)}>
                    <UserPlus size={20} color="#fff" />
                    <Text style={styles.actionText}>Add Member</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: "rgba(244, 63, 94, 0.1)" }]} onPress={leaveGroup}>
                    <LogOut size={20} color="#f43f5e" />
                    <Text style={[styles.actionText, { color: "#f43f5e" }]}>Leave Group</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Members ({participants.length})</Text>
                {loading ? <ActivityIndicator /> : (
                  <FlatList
                    data={participants}
                    keyExtractor={item => item.user_id}
                    renderItem={({ item }) => (
                      <View style={styles.userRow}>
                        <Image source={{ uri: item.avatar_url || "https://ui-avatars.com/api/?name=U" }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.username}>{item.username}</Text>
                          {item.bio && <Text style={styles.bioText} numberOfLines={1}>{item.bio}</Text>}
                        </View>
                      </View>
                    )}
                  />
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.dmProfile}>
            <Image source={{ uri: targetUser?.avatar_url || "https://ui-avatars.com/api/?name=U" }} style={styles.hugeAvatar} />
            <Text style={styles.hugeUsername}>{targetUser?.username}</Text>
            {targetUser?.bio && (
              <View style={styles.bioBox}>
                <Text style={styles.bioTitle}>About Me</Text>
                <Text style={styles.bioTextLarge}>{targetUser.bio}</Text>
              </View>
            )}
            <Text style={styles.joinedText}>
              Joined on {new Date(targetUser?.created_at || Date.now()).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#313338" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  headerTitle: { color: "#f2f3f5", fontSize: 18, fontWeight: "bold" },
  actionRow: { flexDirection: "row", padding: 16, gap: 12 },
  actionButton: { flex: 1, flexDirection: "row", backgroundColor: "#5865F2", padding: 12, borderRadius: 8, justifyContent: "center", alignItems: "center", gap: 8 },
  actionText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { color: "#b5bac1", fontSize: 14, fontWeight: "bold", paddingHorizontal: 16, paddingBottom: 8 },
  userRow: { flexDirection: "row", alignItems: "center", padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  username: { color: "#f2f3f5", fontSize: 16, fontWeight: "600" },
  bioText: { color: "#949ba4", fontSize: 13, marginTop: 2 },
  addMemberContainer: { flex: 1, padding: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1f22", borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 16 },
  searchInput: { flex: 1, color: "#dbdee1", fontSize: 15, paddingHorizontal: 8, outlineStyle: "none" as any },
  dmProfile: { flex: 1, alignItems: "center", padding: 24, paddingTop: 40 },
  hugeAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  hugeUsername: { color: "#f2f3f5", fontSize: 24, fontWeight: "bold", marginBottom: 24 },
  bioBox: { width: "100%", backgroundColor: "#1e1f22", padding: 16, borderRadius: 8, marginBottom: 16 },
  bioTitle: { color: "#b5bac1", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", marginBottom: 8 },
  bioTextLarge: { color: "#dbdee1", fontSize: 15, lineHeight: 22 },
  joinedText: { color: "#949ba4", fontSize: 13, marginTop: 16 },
});
