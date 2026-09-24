import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  useWindowDimensions,
  Modal,
} from "react-native";
import {
  ArrowLeft,
  Heart,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Video,
  Mic,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Lock,
  Unlock,
  Calendar,
  Users,
  UserPlus,
  UserMinus,
  Crown,
  Camera,
  Pin,
  Play,
  Pause,
  ExternalLink,
  Shield,
  Search,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { uploadImageToR2, deleteFileFromR2ByUrl, getThumbnailUrl } from "../lib/r2";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAlaPin } from "../context/AlaPinContext";
import { ZoomableImageViewer } from "../components/ZoomableImageViewer";
import {
  MemoryItem,
  NoteItem,
  fetchMemories,
  addMemory,
  deleteMemory,
  fetchNotes,
  saveNote,
  deleteNote,
} from "../utils/memoriesAndNotes";

type ActiveTab = "media" | "memories" | "notes";
type MediaFilter = "all" | "images" | "videos" | "audio";

const NOTE_COLORS = [
  "#5865F2", // Indigo
  "#ec4899", // Pink / Rose
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#ef4444", // Crimson
];

export default function ChatInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const chatId = (params.id as string) || "";
  const isGroupParam = params.isGroup === "true";

  const { theme } = useTheme();
  const { user } = useAuth();
  const { isPinEnabled, realPin } = useAlaPin();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const isAmoled = theme.id === "black";

  const styles = useMemo(() => createStyles(theme, isDesktop, isAmoled), [theme, isDesktop, isAmoled]);

  // Current User ID
  const currentUserId = user?.id || "";

  // Core States
  const [activeTab, setActiveTab] = useState<ActiveTab>("media");
  const [loading, setLoading] = useState(true);
  const [chatData, setChatData] = useState<any>(null);
  const [isGroup, setIsGroup] = useState(isGroupParam);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [partnerNickname, setPartnerNickname] = useState<string>("");
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [anniversaryDate, setAnniversaryDate] = useState<string | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<any[]>([]);

  // Shared Media States
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedViewerImage, setSelectedViewerImage] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Memories States
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [newMemoryTitle, setNewMemoryTitle] = useState("");
  const [newMemoryCaption, setNewMemoryCaption] = useState("");
  const [newMemoryImage, setNewMemoryImage] = useState<string | null>(null);
  const [newMemoryDate, setNewMemoryDate] = useState(new Date().toISOString().split("T")[0]);
  const [savingMemory, setSavingMemory] = useState(false);

  // Notes & Vault States
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [noteIsVault, setNoteIsVault] = useState(false);
  const [notePinned, setNotePinned] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Group edit states
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const loadChatDetails = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);

    try {
      // 1. Fetch chat row
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (chat) {
        setChatData(chat);
        setIsGroup(!!chat.is_group);
        setGroupNameInput(chat.name || "Group Chat");
      }

      // 2. Fetch my participant record
      if (currentUserId) {
        const { data: myPart } = await supabase
          .from("chat_participants")
          .select("anniversary_date, nickname, partner_nickname, custom_avatar_url")
          .eq("chat_id", chatId)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (myPart) {
          if (myPart.anniversary_date) setAnniversaryDate(myPart.anniversary_date);
          if (myPart.partner_nickname || myPart.nickname) {
            setPartnerNickname(myPart.partner_nickname || myPart.nickname);
          }
        }
      }

      // 3. If DM, fetch partner's details
      if (!chat?.is_group) {
        const { data: parts } = await supabase
          .from("chat_participants")
          .select("user_id, nickname, partner_nickname, custom_avatar_url, anniversary_date")
          .eq("chat_id", chatId)
          .neq("user_id", currentUserId)
          .limit(1);

        if (parts && parts.length > 0) {
          const partnerPart = parts[0];
          if (partnerPart.custom_avatar_url) setCustomAvatar(partnerPart.custom_avatar_url);
          if (!anniversaryDate && partnerPart.anniversary_date) setAnniversaryDate(partnerPart.anniversary_date);

          const { data: prof } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, bio, created_at, updated_at")
            .eq("id", partnerPart.user_id)
            .single();

          if (prof) setPartnerUser(prof);
        }
      } else {
        // Group: fetch all participants
        const { data: groupParts } = await supabase
          .from("chat_participants")
          .select("user_id, custom_avatar_url, profiles(id, username, display_name, avatar_url, bio, updated_at)")
          .eq("chat_id", chatId);

        if (groupParts && groupParts.length > 0) {
          const formatted = groupParts.map((p: any) => {
            const pr = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles || {};
            return {
              user_id: p.user_id,
              username: pr.username || "user",
              display_name: pr.display_name || pr.username || "user",
              avatar_url: p.custom_avatar_url || pr.avatar_url || null,
              bio: pr.bio || null,
              updated_at: pr.updated_at || null,
            };
          });
          setGroupParticipants(formatted);
        }
      }
    } catch (e) {
      console.error("Failed to load chat details:", e);
    } finally {
      setLoading(false);
    }
  }, [chatId, currentUserId, anniversaryDate]);

  // Load Shared Media (images, videos, voice notes)
  const loadSharedMedia = useCallback(async () => {
    if (!chatId) return;
    setLoadingMedia(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, type, created_at, sender_id, profiles(username, avatar_url)")
        .eq("chat_id", chatId)
        .in("type", ["image", "video", "audio"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSharedMedia(data);
      }
    } catch (e) {
      console.error("Failed to load shared media:", e);
    } finally {
      setLoadingMedia(false);
    }
  }, [chatId]);

  // Load Memories
  const loadMemoriesData = useCallback(async () => {
    if (!chatId) return;
    setLoadingMemories(true);
    try {
      const data = await fetchMemories(chatId);
      setMemories(data);
    } catch (e) {
      console.error("Failed to load memories:", e);
    } finally {
      setLoadingMemories(false);
    }
  }, [chatId]);

  // Load Notes
  const loadNotesData = useCallback(async () => {
    if (!chatId) return;
    setLoadingNotes(true);
    try {
      const data = await fetchNotes(chatId);
      setNotes(data);
    } catch (e) {
      console.error("Failed to load notes:", e);
    } finally {
      setLoadingNotes(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadChatDetails();
    loadSharedMedia();
    loadMemoriesData();
    loadNotesData();

    // Realtime channel for sync
    const channel = supabase
      .channel(`chat_info_${chatId}`)
      .on("broadcast", { event: "memories_updated" }, () => loadMemoriesData())
      .on("broadcast", { event: "notes_updated" }, () => loadNotesData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, loadChatDetails, loadSharedMedia, loadMemoriesData, loadNotesData]);

  // -------------------------------------------------------------
  // CALCULATE ANNIVERSARY / DAYS TOGETHER
  // -------------------------------------------------------------
  const daysTogether = useMemo(() => {
    if (!anniversaryDate) return null;
    const start = new Date(anniversaryDate).getTime();
    const now = Date.now();
    if (isNaN(start)) return null;
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [anniversaryDate]);

  // -------------------------------------------------------------
  // MEMORY CREATION & DELETION
  // -------------------------------------------------------------
  const handlePickMemoryImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || "image/jpeg";
        const url = await uploadImageToR2(`memories/${chatId}/${Date.now()}`, asset.base64!, mimeType);
        setNewMemoryImage(url);
      }
    } catch (e) {
      console.error("Failed to pick memory image:", e);
    }
  };

  const handleSaveMemory = async () => {
    if (!newMemoryTitle.trim() && !newMemoryCaption.trim() && !newMemoryImage) return;
    setSavingMemory(true);
    try {
      await addMemory(chatId, currentUserId, {
        title: newMemoryTitle.trim() || "Cherished Memory",
        caption: newMemoryCaption.trim(),
        media_url: newMemoryImage || null,
        media_type: newMemoryImage ? "image" : "text",
        memory_date: new Date(newMemoryDate).toISOString(),
        sender_name: user?.user_metadata?.username || user?.user_metadata?.name || "Me",
      });
      setMemoryModalVisible(false);
      setNewMemoryTitle("");
      setNewMemoryCaption("");
      setNewMemoryImage(null);
      await loadMemoriesData();
    } catch (e) {
      console.error("Failed to save memory:", e);
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    if (Platform.OS === "web") {
      const confirmDelete = window.confirm("Remove this memory?");
      if (!confirmDelete) return;
    }
    await deleteMemory(chatId, memId);
    setMemories(prev => prev.filter(m => m.id !== memId));
  };

  // -------------------------------------------------------------
  // NOTE CREATION & DELETION
  // -------------------------------------------------------------
  const openNewNoteModal = () => {
    setEditingNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteColor(NOTE_COLORS[0]);
    setNoteIsVault(false);
    setNotePinned(false);
    setNoteModalVisible(true);
  };

  const openEditNoteModal = (note: NoteItem) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color || NOTE_COLORS[0]);
    setNoteIsVault(!!note.is_vault);
    setNotePinned(!!note.pinned);
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await saveNote(chatId, currentUserId, {
        id: editingNote?.id,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        color: noteColor,
        is_vault: noteIsVault,
        pinned: notePinned,
      });
      setNoteModalVisible(false);
      await loadNotesData();
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (Platform.OS === "web") {
      const confirmDelete = window.confirm("Delete this note?");
      if (!confirmDelete) return;
    }
    await deleteNote(chatId, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setNoteModalVisible(false);
  };

  // Filtered Media
  const filteredMedia = useMemo(() => {
    if (mediaFilter === "all") return sharedMedia;
    if (mediaFilter === "images") return sharedMedia.filter(m => m.type === "image");
    if (mediaFilter === "videos") return sharedMedia.filter(m => m.type === "video");
    if (mediaFilter === "audio") return sharedMedia.filter(m => m.type === "audio");
    return sharedMedia;
  }, [sharedMedia, mediaFilter]);

  // Filtered Notes (visible vs locked vault)
  const visibleNotes = useMemo(() => {
    return notes.filter(n => !n.is_vault || vaultUnlocked);
  }, [notes, vaultUnlocked]);

  const vaultCount = useMemo(() => {
    return notes.filter(n => n.is_vault).length;
  }, [notes]);

  // -------------------------------------------------------------
  // RENDER SECTIONS
  // -------------------------------------------------------------
  return (
    <View style={styles.screenContainer}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={isAmoled ? "#ffffff" : theme.text} />
          <Text style={styles.backButtonText}>Back to Chat</Text>
        </TouchableOpacity>

        <View style={styles.topHeaderCenter}>
          <Text style={styles.topHeaderTitle} numberOfLines={1}>
            {isGroup ? (chatData?.name || "Group Details") : (partnerNickname || partnerUser?.display_name || partnerUser?.username || "Contact Info")}
          </Text>
        </View>

        <View style={{ width: 100 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatarContainer}>
            <Image
              source={{ uri: customAvatar || (isGroup ? chatData?.avatar_url : partnerUser?.avatar_url) || "https://ui-avatars.com/api/?name=U" }}
              style={styles.heroAvatar}
            />
            {customAvatar && (
              <View style={styles.secretAvatarBadge}>
                <Lock size={12} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.secretAvatarBadgeText}>Secret PFP</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroDisplayName} numberOfLines={1}>
            {isGroup
              ? (chatData?.name || "Group Chat")
              : (partnerNickname || partnerUser?.display_name || partnerUser?.username || "User")}
          </Text>

          {!isGroup && partnerNickname && partnerUser?.username && (
            <Text style={styles.heroHandle}>@{partnerUser.username}</Text>
          )}

          {!isGroup && !partnerNickname && partnerUser?.username && (
            <Text style={styles.heroHandle}>@{partnerUser.username}</Text>
          )}

          {partnerUser?.bio ? (
            <Text style={styles.heroBio}>{partnerUser.bio}</Text>
          ) : null}

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{sharedMedia.length}</Text>
              <Text style={styles.metricLabel}>Shared Media</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{memories.length}</Text>
              <Text style={styles.metricLabel}>Memories</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{notes.length}</Text>
              <Text style={styles.metricLabel}>Notes & Vault</Text>
            </View>
          </View>
        </View>

        {/* 3 Main Segmented Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "media" && styles.tabButtonActive]}
            onPress={() => setActiveTab("media")}
            activeOpacity={0.8}
          >
            <ImageIcon size={18} color={activeTab === "media" ? theme.accent : theme.textMuted} />
            <Text style={[styles.tabButtonText, activeTab === "media" && styles.tabButtonTextActive]}>
              Shared Media
            </Text>
            {sharedMedia.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{sharedMedia.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "memories" && styles.tabButtonActive]}
            onPress={() => setActiveTab("memories")}
            activeOpacity={0.8}
          >
            <Heart size={18} color={activeTab === "memories" ? "#ec4899" : theme.textMuted} />
            <Text style={[styles.tabButtonText, activeTab === "memories" && { color: "#ec4899", fontWeight: "700" }]}>
              Memories
            </Text>
            {memories.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: "rgba(236, 72, 153, 0.2)" }]}>
                <Text style={[styles.tabBadgeText, { color: "#ec4899" }]}>{memories.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "notes" && styles.tabButtonActive]}
            onPress={() => setActiveTab("notes")}
            activeOpacity={0.8}
          >
            <FileText size={18} color={activeTab === "notes" ? "#3b82f6" : theme.textMuted} />
            <Text style={[styles.tabButtonText, activeTab === "notes" && { color: "#3b82f6", fontWeight: "700" }]}>
              Notes & Vault
            </Text>
            {notes.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: "rgba(59, 130, 246, 0.2)" }]}>
                <Text style={[styles.tabBadgeText, { color: "#3b82f6" }]}>{notes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* TAB 1: SHARED MEDIA                                       */}
        {/* ========================================================= */}
        {activeTab === "media" && (
          <View style={styles.tabContentContainer}>
            {/* Sub-filter chips */}
            <View style={styles.filterChipRow}>
              {(["all", "images", "videos", "audio"] as MediaFilter[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, mediaFilter === filter && styles.filterChipActive]}
                  onPress={() => setMediaFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, mediaFilter === filter && styles.filterChipTextActive]}>
                    {filter === "all" ? "All Media" : filter === "images" ? "Photos" : filter === "videos" ? "Videos" : "Voice Notes"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loadingMedia ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            ) : filteredMedia.length === 0 ? (
              <View style={styles.emptyState}>
                <ImageIcon size={48} color={theme.textMuted} />
                <Text style={styles.emptyStateTitle}>No shared media found</Text>
                <Text style={styles.emptyStateSub}>Photos, videos, and voice notes sent in chat appear here.</Text>
              </View>
            ) : (
              <View style={styles.mediaGrid}>
                {filteredMedia.map((item) => {
                  if (item.type === "image") {
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mediaThumbCard}
                        onPress={() => setSelectedViewerImage(item.content)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: getThumbnailUrl(item.content, 350, 350, 80) }}
                          style={styles.mediaThumbImage}
                        />
                      </TouchableOpacity>
                    );
                  }

                  if (item.type === "video") {
                    return (
                      <View key={item.id} style={styles.mediaVideoCard}>
                        <Video size={28} color="#fff" />
                        <Text style={styles.mediaVideoText} numberOfLines={1}>Video Clip</Text>
                        <Text style={styles.mediaDateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </View>
                    );
                  }

                  if (item.type === "audio") {
                    const isPlaying = playingAudioId === item.id;
                    return (
                      <View key={item.id} style={styles.mediaAudioCard}>
                        <TouchableOpacity
                          style={styles.audioPlayBtn}
                          onPress={() => setPlayingAudioId(isPlaying ? null : item.id)}
                        >
                          {isPlaying ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.mediaAudioTitle}>Voice Note</Text>
                          <Text style={styles.mediaDateText}>{new Date(item.created_at).toLocaleString()}</Text>
                        </View>
                        <Mic size={18} color={theme.accent} />
                      </View>
                    );
                  }

                  return null;
                })}
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: MEMORIES                                           */}
        {/* ========================================================= */}
        {activeTab === "memories" && (
          <View style={styles.tabContentContainer}>
            {/* Romantic Anniversary Banner if set */}
            {anniversaryDate && (
              <View style={styles.anniversaryBanner}>
                <View style={styles.anniversaryIconCircle}>
                  <Heart size={26} color="#ec4899" fill="#ec4899" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.anniversaryTitle}>
                    {daysTogether !== null ? `Day ${daysTogether} Together 💕` : "Special Anniversary"}
                  </Text>
                  <Text style={styles.anniversarySub}>
                    Celebrating your journey since {new Date(anniversaryDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
              </View>
            )}

            {/* Add Memory Button */}
            <View style={styles.sectionActionBar}>
              <Text style={styles.sectionHeading}>Cherished Moments ({memories.length})</Text>
              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={() => setMemoryModalVisible(true)}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addPrimaryBtnText}>Add Memory</Text>
              </TouchableOpacity>
            </View>

            {loadingMemories ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#ec4899" />
              </View>
            ) : memories.length === 0 ? (
              <View style={styles.emptyState}>
                <Heart size={48} color="rgba(236, 72, 153, 0.4)" />
                <Text style={styles.emptyStateTitle}>No memories saved yet</Text>
                <Text style={styles.emptyStateSub}>
                  Right-click any message or photo in chat and choose "Save to Memories", or add one manually!
                </Text>
              </View>
            ) : (
              <View style={styles.memoriesTimeline}>
                {memories.map((mem) => (
                  <View key={mem.id} style={styles.memoryCard}>
                    {mem.media_url && (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setSelectedViewerImage(mem.media_url!)}
                      >
                        <Image source={{ uri: mem.media_url }} style={styles.memoryCardImage} />
                      </TouchableOpacity>
                    )}

                    <View style={styles.memoryCardBody}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={styles.memoryCardTitle} numberOfLines={1}>{mem.title}</Text>
                        <TouchableOpacity onPress={() => handleDeleteMemory(mem.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      </View>

                      {mem.caption ? (
                        <Text style={styles.memoryCardCaption}>{mem.caption}</Text>
                      ) : null}

                      <View style={styles.memoryCardFooter}>
                        <Calendar size={13} color={theme.textMuted} style={{ marginRight: 5 }} />
                        <Text style={styles.memoryCardDate}>
                          {new Date(mem.memory_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: NOTES & VAULT                                      */}
        {/* ========================================================= */}
        {activeTab === "notes" && (
          <View style={styles.tabContentContainer}>
            {/* Notes Control Bar */}
            <View style={styles.vaultActionBar}>
              <TouchableOpacity
                style={[styles.vaultToggleBtn, vaultUnlocked && styles.vaultToggleBtnActive]}
                onPress={() => setVaultUnlocked(prev => !prev)}
                activeOpacity={0.8}
              >
                {vaultUnlocked ? <Unlock size={16} color="#10b981" /> : <Lock size={16} color="#fbbf24" />}
                <Text style={[styles.vaultToggleBtnText, vaultUnlocked && { color: "#10b981" }]}>
                  {vaultUnlocked ? "Vault Unlocked" : `Secret Vault (${vaultCount} locked)`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={openNewNoteModal}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addPrimaryBtnText}>New Note</Text>
              </TouchableOpacity>
            </View>

            {loadingNotes ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : visibleNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={48} color="rgba(59, 130, 246, 0.4)" />
                <Text style={styles.emptyStateTitle}>No notes here yet</Text>
                <Text style={styles.emptyStateSub}>
                  Keep shared to-do lists, links, passwords, and secret notes saved together.
                </Text>
              </View>
            ) : (
              <View style={styles.notesGrid}>
                {visibleNotes.map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    style={[styles.noteCard, { borderLeftColor: note.color || "#5865F2" }]}
                    onPress={() => openEditNoteModal(note)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.noteCardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
                        {note.pinned && <Pin size={14} color="#f59e0b" fill="#f59e0b" />}
                        {note.is_vault && <Lock size={14} color="#a855f7" />}
                        <Text style={styles.noteCardTitle} numberOfLines={1}>{note.title}</Text>
                      </View>
                    </View>

                    <Text style={styles.noteCardContent} numberOfLines={4}>
                      {note.content}
                    </Text>

                    <Text style={styles.noteCardDate}>
                      Updated {new Date(note.updated_at).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL: ADD MEMORY                                         */}
      {/* ========================================================= */}
      <Modal visible={memoryModalVisible} transparent animationType="slide" onRequestClose={() => setMemoryModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save a Cherished Memory 💕</Text>
              <TouchableOpacity onPress={() => setMemoryModalVisible(false)}>
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Memory Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. First Date, Beach Trip, Sweetest Message"
                placeholderTextColor={theme.textMuted}
                value={newMemoryTitle}
                onChangeText={setNewMemoryTitle}
              />

              <Text style={styles.inputLabel}>Date</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                value={newMemoryDate}
                onChangeText={setNewMemoryDate}
              />

              <Text style={styles.inputLabel}>Caption / Memory Story</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: "top" }]}
                placeholder="What made this moment so special?"
                placeholderTextColor={theme.textMuted}
                multiline
                value={newMemoryCaption}
                onChangeText={setNewMemoryCaption}
              />

              <Text style={styles.inputLabel}>Attach Photo</Text>
              {newMemoryImage ? (
                <View style={styles.attachedImagePreviewBox}>
                  <Image source={{ uri: newMemoryImage }} style={styles.attachedImagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewMemoryImage(null)}>
                    <Trash2 size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadImageBtn} onPress={handlePickMemoryImage}>
                  <Camera size={20} color={theme.accent} />
                  <Text style={styles.uploadImageBtnText}>Choose a Photo from Gallery</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.saveModalBtn, savingMemory && { opacity: 0.6 }]}
                onPress={handleSaveMemory}
                disabled={savingMemory}
              >
                {savingMemory ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveModalBtnText}>Save Memory</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT NOTE                                    */}
      {/* ========================================================= */}
      <Modal visible={noteModalVisible} transparent animationType="slide" onRequestClose={() => setNoteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingNote ? "Edit Note" : "Create Note"}</Text>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Note title..."
                placeholderTextColor={theme.textMuted}
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.textInput, { height: 120, textAlignVertical: "top" }]}
                placeholder="Write your note, list, or secret thoughts..."
                placeholderTextColor={theme.textMuted}
                multiline
                value={noteContent}
                onChangeText={setNoteContent}
              />

              {/* Color Selector */}
              <Text style={styles.inputLabel}>Accent Color</Text>
              <View style={styles.colorRow}>
                {NOTE_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorCircle, { backgroundColor: c }, noteColor === c && styles.colorCircleSelected]}
                    onPress={() => setNoteColor(c)}
                  >
                    {noteColor === c && <Check size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.togglePill, notePinned && styles.togglePillActive]}
                  onPress={() => setNotePinned(prev => !prev)}
                >
                  <Pin size={15} color={notePinned ? "#f59e0b" : theme.textMuted} />
                  <Text style={[styles.togglePillText, notePinned && { color: "#f59e0b" }]}>Pin to Top</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.togglePill, noteIsVault && { borderColor: "#a855f7", backgroundColor: "rgba(168, 85, 247, 0.15)" }]}
                  onPress={() => setNoteIsVault(prev => !prev)}
                >
                  <Lock size={15} color={noteIsVault ? "#a855f7" : theme.textMuted} />
                  <Text style={[styles.togglePillText, noteIsVault && { color: "#a855f7" }]}>Secret Vault Note</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveModalBtn, savingNote && { opacity: 0.6 }]}
                onPress={handleSaveNote}
                disabled={savingNote}
              >
                {savingNote ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveModalBtnText}>Save Note</Text>}
              </TouchableOpacity>

              {editingNote && (
                <TouchableOpacity
                  style={styles.deleteModalBtn}
                  onPress={() => handleDeleteNote(editingNote.id)}
                >
                  <Trash2 size={16} color="#f43f5e" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteModalBtnText}>Delete Note</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Image Lightbox */}
      <ZoomableImageViewer
        visible={!!selectedViewerImage}
        imageUrl={selectedViewerImage}
        onClose={() => setSelectedViewerImage(null)}
      />
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET
// -------------------------------------------------------------
function createStyles(theme: any, isDesktop: boolean, isAmoled: boolean) {
  const cardBg = isAmoled
    ? "#101012"
    : theme.id === "light"
    ? "#ffffff"
    : "rgba(255, 255, 255, 0.05)";

  const borderCol = isAmoled
    ? "rgba(255, 255, 255, 0.12)"
    : theme.id === "light"
    ? "rgba(0, 0, 0, 0.08)"
    : "rgba(255, 255, 255, 0.08)";

  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: isAmoled ? "#000000" : theme.background,
    },
    topHeader: {
      height: 60,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
      backgroundColor: isAmoled ? "#09090b" : theme.card,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: isAmoled ? "#161618" : "rgba(255, 255, 255, 0.06)",
    },
    backButtonText: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 14,
      fontWeight: "600",
    },
    topHeaderCenter: {
      flex: 1,
      alignItems: "center",
      marginHorizontal: 16,
    },
    topHeaderTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
    },
    scrollContent: {
      paddingBottom: 60,
      alignItems: "center",
    },
    heroCard: {
      width: isDesktop ? 680 : "92%",
      marginTop: 24,
      padding: 24,
      borderRadius: 24,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
      alignItems: "center",
    },
    heroAvatarContainer: {
      position: "relative",
      marginBottom: 14,
    },
    heroAvatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 3,
      borderColor: theme.accent || "#5865F2",
    },
    secretAvatarBadge: {
      position: "absolute",
      bottom: -6,
      alignSelf: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    secretAvatarBadgeText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "700",
    },
    heroDisplayName: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 6,
    },
    heroHandle: {
      color: theme.accent || "#5865F2",
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2,
    },
    heroBio: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: "center",
      marginTop: 10,
      paddingHorizontal: 20,
      lineHeight: 20,
    },
    metricsBar: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: borderCol,
      width: "100%",
      justifyContent: "space-around",
    },
    metricItem: {
      alignItems: "center",
    },
    metricVal: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 18,
      fontWeight: "800",
    },
    metricLabel: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    metricDivider: {
      width: 1,
      height: 28,
      backgroundColor: borderCol,
    },
    tabBar: {
      flexDirection: "row",
      width: isDesktop ? 680 : "92%",
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 6,
      marginTop: 20,
      borderWidth: 1,
      borderColor: borderCol,
      gap: 6,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 14,
      gap: 8,
    },
    tabButtonActive: {
      backgroundColor: isAmoled ? "rgba(255, 255, 255, 0.12)" : "rgba(88, 101, 242, 0.14)",
    },
    tabButtonText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    tabButtonTextActive: {
      color: theme.accent || "#5865F2",
      fontWeight: "700",
    },
    tabBadge: {
      backgroundColor: "rgba(88, 101, 242, 0.15)",
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
    },
    tabBadgeText: {
      color: theme.accent || "#5865F2",
      fontSize: 11,
      fontWeight: "700",
    },
    tabContentContainer: {
      width: isDesktop ? 680 : "92%",
      marginTop: 20,
    },
    filterChipRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
    },
    filterChipActive: {
      backgroundColor: theme.accent || "#5865F2",
      borderColor: theme.accent || "#5865F2",
    },
    filterChipText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    filterChipTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    mediaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    mediaThumbCard: {
      width: isDesktop ? "31.8%" : "31%",
      aspectRatio: 1,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: isAmoled ? "#161618" : "#2a2b2f",
    },
    mediaThumbImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    mediaVideoCard: {
      width: isDesktop ? "31.8%" : "31%",
      aspectRatio: 1,
      borderRadius: 14,
      backgroundColor: "#18181b",
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
      borderWidth: 1,
      borderColor: borderCol,
    },
    mediaVideoText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
      marginTop: 6,
    },
    mediaAudioCard: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: cardBg,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderCol,
    },
    audioPlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent || "#5865F2",
      alignItems: "center",
      justifyContent: "center",
    },
    mediaAudioTitle: {
      color: isAmoled ? "#fff" : theme.text,
      fontSize: 14,
      fontWeight: "600",
    },
    mediaDateText: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    emptyState: {
      paddingVertical: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyStateTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 12,
    },
    emptyStateSub: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 6,
      maxWidth: 320,
      lineHeight: 18,
    },
    anniversaryBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isAmoled ? "rgba(236, 72, 153, 0.12)" : "rgba(236, 72, 153, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(236, 72, 153, 0.3)",
      borderRadius: 20,
      padding: 16,
      marginBottom: 20,
    },
    anniversaryIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(236, 72, 153, 0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    anniversaryTitle: {
      color: "#ec4899",
      fontSize: 16,
      fontWeight: "800",
    },
    anniversarySub: {
      color: theme.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    sectionActionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionHeading: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
    },
    addPrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    addPrimaryBtnText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "700",
    },
    memoriesTimeline: {
      gap: 16,
    },
    memoryCard: {
      backgroundColor: cardBg,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: borderCol,
    },
    memoryCardImage: {
      width: "100%",
      height: 220,
      resizeMode: "cover",
    },
    memoryCardBody: {
      padding: 16,
    },
    memoryCardTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
      flex: 1,
      marginRight: 10,
    },
    memoryCardCaption: {
      color: isAmoled ? "#e2e8f0" : theme.text,
      fontSize: 14,
      marginTop: 8,
      lineHeight: 20,
    },
    memoryCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
    },
    memoryCardDate: {
      color: theme.textMuted,
      fontSize: 12,
    },
    vaultActionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    vaultToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
    },
    vaultToggleBtnActive: {
      borderColor: "rgba(16, 185, 129, 0.4)",
      backgroundColor: "rgba(16, 185, 129, 0.1)",
    },
    vaultToggleBtnText: {
      color: "#fbbf24",
      fontSize: 13,
      fontWeight: "700",
    },
    notesGrid: {
      flexDirection: isDesktop ? "row" : "column",
      flexWrap: "wrap",
      gap: 12,
    },
    noteCard: {
      width: isDesktop ? "48.8%" : "100%",
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 5,
      borderWidth: 1,
      borderColor: borderCol,
    },
    noteCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    noteCardTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    noteCardContent: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    noteCardDate: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 12,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      width: isDesktop ? 520 : "100%",
      maxHeight: "85%",
      backgroundColor: isAmoled ? "#121214" : theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: borderCol,
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
    },
    modalTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 17,
      fontWeight: "700",
    },
    inputLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 12,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 14,
    },
    attachedImagePreviewBox: {
      position: "relative",
      width: "100%",
      height: 180,
      borderRadius: 14,
      overflow: "hidden",
      marginTop: 4,
    },
    attachedImagePreview: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    removeImageBtn: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: "rgba(244, 63, 94, 0.9)",
      padding: 8,
      borderRadius: 10,
    },
    uploadImageBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.accent || "#5865F2",
      backgroundColor: "rgba(88, 101, 242, 0.05)",
      marginTop: 4,
    },
    uploadImageBtnText: {
      color: theme.accent || "#5865F2",
      fontSize: 14,
      fontWeight: "600",
    },
    colorRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    colorCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    colorCircleSelected: {
      borderWidth: 2,
      borderColor: "#ffffff",
    },
    toggleRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    togglePill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: cardBg,
    },
    togglePillActive: {
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245, 158, 11, 0.1)",
    },
    togglePillText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    saveModalBtn: {
      backgroundColor: theme.accent || "#5865F2",
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 22,
    },
    saveModalBtnText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
    deleteModalBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 10,
    },
    deleteModalBtnText: {
      color: "#f43f5e",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
