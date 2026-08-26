import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image,
  FlatList, TextInput, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import {
  X, UserPlus, LogOut, Search, Camera, Trash2, Edit3,
  Check, Users, Image as ImageIcon, UserMinus, Crown, ShieldAlert,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { uploadImageToR2, deleteFileFromR2ByUrl } from "../lib/r2";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "expo-router";

interface ChatInfoModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  isGroup: boolean;
  targetUser?: any;
  currentUserId: string;
  onGroupUpdated?: (updated: { name?: string; avatar_url?: string }) => void;
}

export default function ChatInfoModal({
  visible,
  onClose,
  chatId,
  isGroup,
  targetUser,
  currentUserId,
  onGroupUpdated,
}: ChatInfoModalProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [chatData, setChatData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "media">("members");

  // Group Name edit
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Group Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Add member states
  const [addingMember, setAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Shared Media
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchGroupDetails = useCallback(async () => {
    if (!chatId || !isGroup) return;
    setLoading(true);
    try {
      // 1. Fetch chat info
      const { data: chat } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single();
      if (chat) {
        setChatData(chat);
        setGroupName(chat.name || "Group Chat");
      }

      // 2. Fetch participants with profile info
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("user_id, joined_at, profiles(id, username, display_name, avatar_url, bio, updated_at)")
        .eq("chat_id", chatId);
      if (parts) {
        setParticipants(
          parts.map((p: any) => ({
            user_id: p.user_id,
            joined_at: p.joined_at,
            ...p.profiles,
          }))
        );
      }
    } catch (e) {
      console.error("Error fetching group details:", e);
    } finally {
      setLoading(false);
    }
  }, [chatId, isGroup]);

  const fetchSharedMedia = useCallback(async () => {
    if (!chatId) return;
    setLoadingMedia(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, sender_id")
        .eq("chat_id", chatId)
        .eq("type", "image")
        .order("created_at", { ascending: false });
      if (data) setSharedMedia(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMedia(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (visible) {
      if (isGroup) {
        fetchGroupDetails();
        fetchSharedMedia();
      } else {
        setLoading(false);
        fetchSharedMedia();
      }
    }
  }, [visible, isGroup, fetchGroupDetails, fetchSharedMedia]);

  // Pick & upload group avatar
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadingAvatar(true);
        const asset = result.assets[0];
        const mimeType = asset.mimeType || "image/jpeg";
        const publicUrl = await uploadImageToR2(`group-avatars/${chatId}-${Date.now()}`, asset.base64, mimeType);

        // Update chats table
        const { error } = await supabase.from("chats").update({ avatar_url: publicUrl }).eq("id", chatId);
        if (!error) {
          setChatData((prev: any) => ({ ...prev, avatar_url: publicUrl }));
          if (onGroupUpdated) onGroupUpdated({ avatar_url: publicUrl });
        }
      }
    } catch (e) {
      console.error("Failed to upload group avatar:", e);
      if (Platform.OS === "web") alert("Failed to upload group image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save edited group name
  const handleSaveGroupName = async () => {
    if (!groupName.trim() || groupName.trim() === chatData?.name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase.from("chats").update({ name: groupName.trim() }).eq("id", chatId);
      if (!error) {
        setChatData((prev: any) => ({ ...prev, name: groupName.trim() }));
        if (onGroupUpdated) onGroupUpdated({ name: groupName.trim() });
        setIsEditingName(false);
      }
    } catch (e) {
      console.error("Failed to update group name:", e);
    } finally {
      setSavingName(false);
    }
  };

  // Search & add new members
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .ilike("username", `%${text}%`)
        .limit(10);
      if (data) {
        const existingIds = new Set(participants.map((p) => p.user_id));
        setSearchResults(data.filter((u) => !existingIds.has(u.id)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const addMember = async (userId: string) => {
    try {
      await supabase.from("chat_participants").insert({ chat_id: chatId, user_id: userId });
      setAddingMember(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchGroupDetails();
    } catch (e) {
      console.error("Failed to add member:", e);
    }
  };

  // Kick / remove member
  const handleRemoveMember = async (memberUserId: string, memberUsername: string) => {
    if (Platform.OS === "web") {
      const confirmRemove = window.confirm(`Remove @${memberUsername} from this group?`);
      if (!confirmRemove) return;
    }
    try {
      await supabase.from("chat_participants").delete().eq("chat_id", chatId).eq("user_id", memberUserId);
      setParticipants((prev) => prev.filter((p) => p.user_id !== memberUserId));
    } catch (e) {
      console.error("Failed to remove member:", e);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (Platform.OS === "web") {
      const confirmLeave = window.confirm("Are you sure you want to leave this group?");
      if (!confirmLeave) return;
    }
    try {
      await supabase.from("chat_participants").delete().eq("chat_id", chatId).eq("user_id", currentUserId);
      onClose();
      router.replace("/(tabs)");
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Group completely
  const handleDeleteGroup = async () => {
    if (Platform.OS === "web") {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this group forever? All messages and media will be erased for everyone."
      );
      if (!confirmDelete) return;
    }
    try {
      // 1. Delete all images from Cloudflare R2
      const { data: images } = await supabase.from("messages").select("content").eq("chat_id", chatId).eq("type", "image");
      if (images && images.length > 0) {
        for (const msg of images) {
          if (msg.content) await deleteFileFromR2ByUrl(msg.content);
        }
      }
      // 2. Call RPC or delete tables
      const { error } = await supabase.rpc("delete_chat_completely", { p_chat_id: chatId });
      if (error) {
        await supabase.from("messages").delete().eq("chat_id", chatId);
        await supabase.from("chat_participants").delete().eq("chat_id", chatId);
        await supabase.from("chats").delete().eq("id", chatId);
      }
      onClose();
      router.replace("/(tabs)");
    } catch (e) {
      console.error(e);
      if (Platform.OS === "web") alert("Failed to delete group.");
    }
  };

  const isCreator = chatData?.created_by === currentUserId;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isGroup ? "Group Details" : "Contact Info"}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : isGroup ? (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* GROUP PROFILE CARD */}
              <View style={styles.groupCard}>
                <View style={styles.avatarWrapper}>
                  {chatData?.avatar_url ? (
                    <Image source={{ uri: chatData.avatar_url }} style={styles.groupAvatar} />
                  ) : (
                    <View style={[styles.groupAvatarFallback, { backgroundColor: theme.accent }]}>
                      <Users size={44} color="#ffffff" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.avatarBadge} onPress={handlePickAvatar} disabled={uploadingAvatar}>
                    {uploadingAvatar ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Camera size={18} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Group Title / Editor */}
                {isEditingName ? (
                  <View style={styles.editNameRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={groupName}
                      onChangeText={setGroupName}
                      placeholder="Group Name"
                      placeholderTextColor={theme.textMuted}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.accent }]}
                      onPress={handleSaveGroupName}
                      disabled={savingName}
                    >
                      {savingName ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Check size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.border }]}
                      onPress={() => {
                        setIsEditingName(false);
                        setGroupName(chatData?.name || "");
                      }}
                    >
                      <X size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.nameDisplayRow}
                    onPress={() => setIsEditingName(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.groupTitleText} numberOfLines={1}>
                      {chatData?.name || "Group Chat"}
                    </Text>
                    <Edit3 size={16} color={theme.textMuted} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                )}

                <Text style={styles.groupSubInfo}>
                  {participants.length} {participants.length === 1 ? "member" : "members"}
                  {chatData?.created_at && ` • Created ${new Date(chatData.created_at).toLocaleDateString()}`}
                </Text>
              </View>

              {/* ACTION BUTTONS ROW */}
              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={[styles.actionGridBtn, { backgroundColor: theme.surface }]}
                  onPress={() => setAddingMember(true)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: theme.accent }]}>
                    <UserPlus size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionGridLabel}>Add Member</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionGridBtn, { backgroundColor: theme.surface }]}
                  onPress={() => setActiveTab(activeTab === "members" ? "media" : "members")}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: "#3b82f6" }]}>
                    <ImageIcon size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionGridLabel}>
                    {activeTab === "members" ? `Media (${sharedMedia.length})` : "Members"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionGridBtn, { backgroundColor: theme.surface }]}
                  onPress={handleLeaveGroup}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: "rgba(244,63,94,0.15)" }]}>
                    <LogOut size={20} color="#f43f5e" />
                  </View>
                  <Text style={[styles.actionGridLabel, { color: "#f43f5e" }]}>Leave</Text>
                </TouchableOpacity>
              </View>

              {/* TAB CONTENT: MEMBERS vs SHARED MEDIA */}
              {activeTab === "members" ? (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    Group Members ({participants.length})
                  </Text>

                  {participants.map((item) => {
                    const isUserCreator = item.user_id === chatData?.created_by;
                    const isSelf = item.user_id === currentUserId;
                    const isOnline = item.updated_at && Date.now() - new Date(item.updated_at).getTime() < 5 * 60 * 1000;

                    return (
                      <View key={item.user_id} style={styles.memberRow}>
                        <View style={styles.memberAvatarBox}>
                          {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                          ) : (
                            <View style={[styles.memberAvatar, { backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" }]}>
                              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                                {(item.username || "U")[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={[styles.statusDot, { backgroundColor: isOnline ? "#23a559" : "#80848e" }]} />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {item.display_name || item.username}
                            </Text>
                            {isSelf && <Text style={styles.youBadge}>(You)</Text>}
                            {isUserCreator && (
                              <View style={styles.roleBadge}>
                                <Crown size={12} color="#fbbf24" style={{ marginRight: 3 }} />
                                <Text style={styles.roleBadgeText}>Creator</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.memberUsername} numberOfLines={1}>
                            @{item.username}
                          </Text>
                        </View>

                        {/* Kick Member Button (if creator or not self) */}
                        {!isSelf && (isCreator || true) && (
                          <TouchableOpacity
                            style={styles.kickBtn}
                            onPress={() => handleRemoveMember(item.user_id, item.username)}
                            title="Remove Member"
                          >
                            <UserMinus size={18} color="#f43f5e" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Shared Photos & Media ({sharedMedia.length})</Text>
                  {loadingMedia ? (
                    <ActivityIndicator style={{ marginTop: 20 }} />
                  ) : sharedMedia.length === 0 ? (
                    <View style={styles.emptyMediaBox}>
                      <ImageIcon size={40} color={theme.textMuted} />
                      <Text style={styles.emptyMediaText}>No shared photos in this group yet.</Text>
                    </View>
                  ) : (
                    <View style={styles.mediaGrid}>
                      {sharedMedia.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.mediaGridItem}
                          onPress={() => setSelectedImage(m.content)}
                        >
                          <Image source={{ uri: m.content }} style={styles.mediaThumb} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* DANGER ZONE */}
              <View style={[styles.sectionContainer, { marginTop: 12, marginBottom: 40 }]}>
                <TouchableOpacity style={styles.deleteGroupBtn} onPress={handleDeleteGroup}>
                  <Trash2 size={18} color="#f43f5e" style={{ marginRight: 8 }} />
                  <Text style={styles.deleteGroupBtnText}>Delete Group Forever</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* DM CONTACT PROFILE */
            <View style={styles.dmProfile}>
              <Image
                source={{ uri: targetUser?.avatar_url || "https://ui-avatars.com/api/?name=U" }}
                style={styles.hugeAvatar}
              />
              <Text style={styles.hugeUsername}>{targetUser?.display_name || targetUser?.username}</Text>
              <Text style={styles.hugeHandle}>@{targetUser?.username}</Text>

              {targetUser?.bio ? (
                <View style={styles.bioBox}>
                  <Text style={styles.bioTitle}>About</Text>
                  <Text style={styles.bioTextLarge}>{targetUser.bio}</Text>
                </View>
              ) : null}

              <Text style={styles.joinedText}>
                Joined on {new Date(targetUser?.created_at || Date.now()).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* ADD MEMBER MODAL / DRAWER */}
          <Modal
            visible={addingMember}
            animationType="fade"
            transparent
            onRequestClose={() => setAddingMember(false)}
          >
            <View style={styles.searchOverlay}>
              <View style={styles.searchCard}>
                <View style={styles.searchHeader}>
                  <Text style={styles.searchTitle}>Add Member to Group</Text>
                  <TouchableOpacity onPress={() => setAddingMember(false)}>
                    <X size={22} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.searchBar}>
                  <Search size={18} color={theme.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search username (e.g. alex)..."
                    placeholderTextColor={theme.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                    autoCapitalize="none"
                  />
                </View>

                {searchLoading ? (
                  <ActivityIndicator style={{ marginVertical: 20 }} color={theme.accent} />
                ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                  <Text style={styles.noResultsText}>No users found.</Text>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 260 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.searchResultRow} onPress={() => addMember(item.id)}>
                        <Image
                          source={{ uri: item.avatar_url || "https://ui-avatars.com/api/?name=U" }}
                          style={styles.searchAvatar}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.searchResultName}>{item.display_name || item.username}</Text>
                          <Text style={styles.searchResultHandle}>@{item.username}</Text>
                        </View>
                        <View style={[styles.addIconBadge, { backgroundColor: theme.accent }]}>
                          <UserPlus size={16} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>

          {/* FULLSCREEN PHOTO PREVIEW */}
          {selectedImage && (
            <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
              <TouchableOpacity
                style={styles.previewOverlay}
                activeOpacity={1}
                onPress={() => setSelectedImage(null)}
              >
                <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
                <TouchableOpacity style={styles.previewClose} onPress={() => setSelectedImage(null)}>
                  <X size={28} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    container: {
      width: "100%",
      maxWidth: 520,
      height: "90%",
      backgroundColor: theme.background,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerTitle: { color: theme.text, fontSize: 18, fontWeight: "700" },
    closeBtn: { padding: 4 },
    scrollArea: { flex: 1, padding: 16 },
    centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },

    // Group Card
    groupCard: {
      alignItems: "center",
      paddingVertical: 20,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    avatarWrapper: { position: "relative", marginBottom: 14 },
    groupAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: theme.border },
    groupAvatarFallback: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: theme.border },
    avatarBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.surface,
    },
    nameDisplayRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    groupTitleText: { color: theme.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
    groupSubInfo: { color: theme.textMuted, fontSize: 13, marginTop: 4 },
    editNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
    nameInput: {
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 180,
      textAlign: "center",
      outlineStyle: "none" as any,
    },
    smallActionBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },

    // Action Grid
    actionGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
    actionGridBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    actionIconBox: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
    actionGridLabel: { color: theme.text, fontSize: 12, fontWeight: "600" },

    // Section & Members
    sectionContainer: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    sectionTitle: { color: theme.textMuted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    memberAvatarBox: { position: "relative" },
    memberAvatar: { width: 44, height: 44, borderRadius: 22 },
    statusDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.surface },
    memberName: { color: theme.text, fontSize: 15, fontWeight: "700" },
    memberUsername: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    youBadge: { color: theme.accent, fontSize: 12, fontWeight: "700" },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(251, 191, 36, 0.15)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    roleBadgeText: { color: "#fbbf24", fontSize: 10, fontWeight: "700" },
    kickBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(244,63,94,0.1)" },

    // Shared Media
    emptyMediaBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
    emptyMediaText: { color: theme.textMuted, fontSize: 13 },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    mediaGridItem: { width: "31%", aspectRatio: 1, borderRadius: 8, overflow: "hidden", backgroundColor: theme.background },
    mediaThumb: { width: "100%", height: "100%", resizeMode: "cover" },

    // Delete Group
    deleteGroupBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(244,63,94,0.3)",
      backgroundColor: "rgba(244,63,94,0.08)",
    },
    deleteGroupBtnText: { color: "#f43f5e", fontSize: 14, fontWeight: "700" },

    // DM Profile
    dmProfile: { flex: 1, alignItems: "center", padding: 24, paddingTop: 32 },
    hugeAvatar: { width: 110, height: 110, borderRadius: 55, marginBottom: 14, borderWidth: 3, borderColor: theme.border },
    hugeUsername: { color: theme.text, fontSize: 22, fontWeight: "bold" },
    hugeHandle: { color: theme.textMuted, fontSize: 14, marginTop: 2, marginBottom: 20 },
    bioBox: { width: "100%", backgroundColor: theme.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
    bioTitle: { color: theme.textMuted, fontSize: 12, fontWeight: "bold", textTransform: "uppercase", marginBottom: 6 },
    bioTextLarge: { color: theme.text, fontSize: 14, lineHeight: 20 },
    joinedText: { color: theme.textMuted, fontSize: 13, marginTop: 12 },

    // Search Member Modal
    searchOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
    searchCard: { width: "100%", maxWidth: 440, backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.border },
    searchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    searchTitle: { color: theme.text, fontSize: 18, fontWeight: "700" },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 14,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, paddingHorizontal: 8, outlineStyle: "none" as any },
    noResultsText: { color: theme.textMuted, textAlign: "center", marginVertical: 16, fontSize: 14 },
    searchResultRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    searchAvatar: { width: 38, height: 38, borderRadius: 19 },
    searchResultName: { color: theme.text, fontSize: 14, fontWeight: "700" },
    searchResultHandle: { color: theme.textMuted, fontSize: 12 },
    addIconBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },

    // Photo Preview
    previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
    fullImage: { width: "100%", height: "85%" },
    previewClose: { position: "absolute", top: 40, right: 20, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20 },
  });
