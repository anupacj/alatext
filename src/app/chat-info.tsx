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
  Settings,
  LogOut,
  MessageSquare,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AudioPlayerBubble from "../components/AudioPlayerBubble";
import { supabase } from "../lib/supabase";
import { uploadImageToR2, deleteFileFromR2ByUrl, getThumbnailUrl } from "../lib/r2";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAlaPin } from "../context/AlaPinContext";
import { ZoomableImageViewer } from "../components/ZoomableImageViewer";
import ChatSettingsModal from "../components/ChatSettingsModal";
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

type ActiveTab = "media" | "memories" | "notes" | "members" | "settings";
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
  const targetUserIdParam = (params.targetUserId as string) || "";
  const targetUsernameParam = (params.targetUsername as string) || "";
  const targetDisplayNameParam = (params.targetDisplayName as string) || "";
  const targetNicknameParam = (params.targetNickname as string) || "";
  const targetAvatarParam = (params.targetAvatar as string) || "";
  const targetBioParam = (params.targetBio as string) || "";
  const groupNameParam = (params.groupName as string) || "";
  const groupAvatarParam = (params.groupAvatar as string) || "";

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
  const wallpaperUrlParam = (params.wallpaperUrl as string) || "";
  const [wallpaperUrl, setWallpaperUrl] = useState<string>(wallpaperUrlParam);

  useEffect(() => {
    if (!wallpaperUrl && chatId) {
      AsyncStorage.getItem(`chat_${chatId}_settings`).then(raw => {
        if (raw) {
          try {
            const s = JSON.parse(raw);
            if (s?.wallpaper_url) setWallpaperUrl(s.wallpaper_url);
          } catch (e) {}
        }
      });
    }
  }, [chatId, wallpaperUrl]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(isGroupParam ? "members" : "media");
  const [loading, setLoading] = useState(true);
  const [chatData, setChatData] = useState<any>(null);
  const [isGroup, setIsGroup] = useState(isGroupParam);
  const [partnerUser, setPartnerUser] = useState<any>(() => {
    if (targetUserIdParam || targetUsernameParam) {
      return {
        id: targetUserIdParam,
        username: targetUsernameParam,
        display_name: targetDisplayNameParam || targetUsernameParam,
        avatar_url: targetAvatarParam || null,
        bio: targetBioParam || null,
      };
    }
    return null;
  });
  const [partnerNickname, setPartnerNickname] = useState<string>(targetNicknameParam || targetDisplayNameParam || targetUsernameParam);
  const [customAvatar, setCustomAvatar] = useState<string | null>(targetAvatarParam || null);
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
  const [groupNameInput, setGroupNameInput] = useState(groupNameParam || "Group Chat");
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);

  // Add Member to Group states
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  // Group Settings Modal
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const loadChatDetails = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);

    try {
      let effectiveUserId = currentUserId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id || "";
      }

      // 1. Fetch chat row
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (chat) {
        setChatData(chat);
        setIsGroup(!!chat.is_group);
        if (chat.name) setGroupNameInput(chat.name);
      }

      // 2. Fetch raw participants for this chat
      let rawParts: any[] = [];
      const { data: pData, error: pErr } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("chat_id", chatId);

      if (!pErr && Array.isArray(pData) && pData.length > 0) {
        rawParts = pData;
      } else {
        // Fallback in case select("*") had an issue
        const { data: pSimple } = await supabase
          .from("chat_participants")
          .select("user_id")
          .eq("chat_id", chatId);
        if (Array.isArray(pSimple) && pSimple.length > 0) {
          rawParts = pSimple;
        }
      }

      // 3. Fetch profiles for all participants directly from profiles table
      const userIds = rawParts.map((p: any) => p.user_id).filter(Boolean);
      const profMap = new Map<string, any>();

      if (userIds.length > 0) {
        try {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, bio, created_at, updated_at")
            .in("id", userIds);

          if (!profErr && Array.isArray(profs)) {
            profs.forEach((pr) => profMap.set(pr.id, pr));
          }
        } catch (e) {
          console.error("Failed to fetch participant profiles:", e);
        }
      }

      const isGroupChat = !!chat?.is_group || isGroupParam;

      // 4. If DM: extract partner info & anniversary
      if (!isGroupChat) {
        const myPart = rawParts.find((p: any) => p.user_id === effectiveUserId);
        if (myPart) {
          if (myPart.anniversary_date) setAnniversaryDate(myPart.anniversary_date);
          if (myPart.partner_nickname || myPart.nickname) {
            setPartnerNickname(myPart.partner_nickname || myPart.nickname);
          }
        }

        const partnerPart =
          rawParts.find((p: any) => p.user_id !== effectiveUserId) ||
          (targetUserIdParam ? rawParts.find((p: any) => p.user_id === targetUserIdParam) : null) ||
          rawParts[0];

        if (partnerPart) {
          if (partnerPart.custom_avatar_url) setCustomAvatar(partnerPart.custom_avatar_url);
          if (partnerPart.anniversary_date) setAnniversaryDate(partnerPart.anniversary_date);

          const partnerProf = profMap.get(partnerPart.user_id);
          if (partnerProf) {
            setPartnerUser(partnerProf);
          }
        } else if (targetUserIdParam) {
          const partnerProf = profMap.get(targetUserIdParam);
          if (partnerProf) setPartnerUser(partnerProf);
        }
      }

      // 5. If Group: format and set group participants
      if (isGroupChat) {
        const formatted = rawParts.map((p: any) => {
          const pr = profMap.get(p.user_id) || {};
          return {
            user_id: p.user_id,
            username: pr.username || "user",
            display_name: pr.display_name || pr.username || "Member",
            avatar_url: p.custom_avatar_url || pr.avatar_url || null,
            bio: pr.bio || null,
            updated_at: pr.updated_at || null,
          };
        });
        setGroupParticipants(formatted);
      }
    } catch (e) {
      console.error("Failed to load chat details:", e);
    } finally {
      setLoading(false);
    }
  }, [chatId, currentUserId, isGroupParam, targetUserIdParam]);

  // Load Shared Media (images, videos, voice notes)
  const loadSharedMedia = useCallback(async () => {
    if (!chatId) return;
    setLoadingMedia(true);

    const isMediaMsg = (m: any) => {
      if (!m) return false;
      if (m.type === "image" || m.type === "video" || m.type === "audio") return true;
      const str = m.text || m.content || "";
      if (
        typeof str === "string" &&
        (str.includes("/chat-images/") ||
          str.includes("/chat-videos/") ||
          str.includes("/audio-messages/") ||
          str.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|m4a|mp3|ogg)(\?.*)?$/i))
      ) {
        return true;
      }
      return false;
    };

    const resolveType = (m: any) => {
      if (m.type === "image" || m.type === "video" || m.type === "audio") return m.type;
      const str = m.text || m.content || "";
      if (typeof str === "string") {
        if (str.includes("/chat-videos/") || str.match(/\.(mp4|webm)(\?.*)?$/i)) return "video";
        if (str.includes("/audio-messages/") || str.match(/\.(m4a|mp3|ogg|wav)(\?.*)?$/i)) return "audio";
      }
      return "image";
    };

    // 1. Instant local cache load
    try {
      const cachedRaw = await AsyncStorage.getItem(`chat_${chatId}_messages`);
      if (cachedRaw) {
        const cachedMsgs = JSON.parse(cachedRaw);
        if (Array.isArray(cachedMsgs)) {
          const localMedia = cachedMsgs
            .filter(isMediaMsg)
            .map((m: any) => ({
              id: m.id,
              content: m.text || m.content,
              type: resolveType(m),
              created_at: m.created_at || (m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString()),
              sender_id: m.sender_id || (m.isMe ? currentUserId : ""),
            }));
          if (localMedia.length > 0) {
            setSharedMedia(localMedia);
          }
        }
      }
    } catch (e) {
      console.error("Local media load error:", e);
    }

    // 2. Fetch clean messages from Supabase
    try {
      let { data, error } = await supabase
        .from("messages")
        .select("id, content, type, created_at, sender_id")
        .eq("chat_id", chatId)
        .in("type", ["image", "video", "audio"])
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from("messages")
          .select("id, content, type, created_at, sender_id")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (fallback.data && fallback.data.length > 0) {
          const mediaRows = fallback.data
            .filter(isMediaMsg)
            .map((m: any) => ({
              ...m,
              type: resolveType(m),
            }));
          if (mediaRows.length > 0) {
            data = mediaRows;
          }
        }
      }

      if (data && data.length > 0) {
        setSharedMedia(data);
      }
    } catch (e) {
      console.error("Failed to load shared media:", e);
    } finally {
      setLoadingMedia(false);
    }
  }, [chatId, currentUserId]);

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
    const activeUid = currentUserId || user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!activeUid) return;
    setSavingMemory(true);
    try {
      await addMemory(chatId, activeUid, {
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
    if (Platform.OS === "web" && typeof window !== "undefined") {
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
    const activeUid = currentUserId || user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!activeUid) return;
    setSavingNote(true);
    try {
      await saveNote(chatId, activeUid, {
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
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmDelete = window.confirm("Delete this note?");
      if (!confirmDelete) return;
    }
    await deleteNote(chatId, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setNoteModalVisible(false);
  };

  // Group ownership check
  const isOwner = useMemo(() => {
    if (!isGroup) return false;
    if (chatData?.created_by) return chatData.created_by === currentUserId;
    if (groupParticipants.length > 0) return groupParticipants[0].user_id === currentUserId;
    return true;
  }, [isGroup, chatData?.created_by, currentUserId, groupParticipants]);

  // Group Avatar Upload
  const handlePickGroupAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadingGroupAvatar(true);
        const asset = result.assets[0];
        const mimeType = asset.mimeType || "image/jpeg";
        const uploadedUrl = await uploadImageToR2(`groups/${chatId}/${Date.now()}`, asset.base64!, mimeType);

        const { error } = await supabase
          .from("chats")
          .update({ avatar_url: uploadedUrl })
          .eq("id", chatId);

        if (!error) {
          setChatData((prev: any) => ({ ...prev, avatar_url: uploadedUrl }));
        }
      }
    } catch (e) {
      console.error("Failed to pick/upload group avatar:", e);
    } finally {
      setUploadingGroupAvatar(false);
    }
  };

  // Group Name Save
  const handleSaveGroupName = async () => {
    if (!groupNameInput.trim()) return;
    try {
      const { error } = await supabase
        .from("chats")
        .update({ name: groupNameInput.trim() })
        .eq("id", chatId);
      if (!error) {
        setChatData((prev: any) => ({ ...prev, name: groupNameInput.trim() }));
        setIsEditingGroupName(false);
      }
    } catch (e) {
      console.error("Failed to update group name:", e);
    }
  };

  // Search users to add to group
  const handleSearchUsers = async (query: string) => {
    setMemberSearchQuery(query);
    if (!query.trim()) {
      setMemberSearchResults([]);
      return;
    }
    setSearchingMembers(true);
    try {
      const existingIds = groupParticipants.map((p) => p.user_id);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${query.trim()}%`)
        .limit(15);

      if (data) {
        const filtered = data.filter((u: any) => !existingIds.includes(u.id));
        setMemberSearchResults(filtered);
      }
    } catch (e) {
      console.error("Failed to search members:", e);
    } finally {
      setSearchingMembers(false);
    }
  };

  // Add Member
  const handleAddMember = async (selectedUser: any) => {
    if (!chatId || !selectedUser) return;
    setAddingMemberId(selectedUser.id);
    try {
      const { error } = await supabase
        .from("chat_participants")
        .insert([{ chat_id: chatId, user_id: selectedUser.id }]);
      if (error) throw error;

      // System notification message
      const adderName = user?.user_metadata?.display_name || user?.user_metadata?.username || "Admin";
      const addedName = selectedUser.display_name || selectedUser.username || "User";
      await supabase.from("messages").insert([{
        chat_id: chatId,
        sender_id: currentUserId,
        content: `${adderName} added ${addedName} to the group.`,
        type: "text",
      }]);

      setGroupParticipants((prev) => [
        ...prev,
        {
          user_id: selectedUser.id,
          username: selectedUser.username,
          display_name: selectedUser.display_name || selectedUser.username,
          avatar_url: selectedUser.avatar_url || null,
          bio: null,
        },
      ]);
      setMemberSearchResults((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setAddMemberModalVisible(false);
      setMemberSearchQuery("");
    } catch (e: any) {
      console.error("Failed to add member:", e);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(e.message || "Could not add member.");
      }
    } finally {
      setAddingMemberId(null);
    }
  };

  // Remove Member
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!chatId || !memberUserId) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmKick = window.confirm(`Remove ${memberName} from this group?`);
      if (!confirmKick) return;
    }
    try {
      const { error } = await supabase
        .from("chat_participants")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", memberUserId);
      if (error) throw error;

      await supabase.from("messages").insert([{
        chat_id: chatId,
        sender_id: currentUserId,
        content: `${memberName} was removed from the group.`,
        type: "text",
      }]);

      setGroupParticipants((prev) => prev.filter((p) => p.user_id !== memberUserId));
    } catch (e: any) {
      console.error("Failed to remove member:", e);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!chatId || !currentUserId) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmLeave = window.confirm("Are you sure you want to leave this group?");
      if (!confirmLeave) return;
    }
    try {
      const { error } = await supabase
        .from("chat_participants")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", currentUserId);
      if (error) throw error;

      const myName = user?.user_metadata?.display_name || user?.user_metadata?.username || "A member";
      await supabase.from("messages").insert([{
        chat_id: chatId,
        sender_id: currentUserId,
        content: `${myName} left the group.`,
        type: "text",
      }]);

      router.replace("/(tabs)");
    } catch (e: any) {
      console.error("Failed to leave group:", e);
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!chatId) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmDelete = window.confirm(
        "Are you SURE you want to delete this group permanently? All messages and media will be removed for everyone."
      );
      if (!confirmDelete) return;
    }
    try {
      await supabase.from("messages").delete().eq("chat_id", chatId);
      await supabase.from("chat_participants").delete().eq("chat_id", chatId);
      await supabase.from("chats").delete().eq("id", chatId);

      router.replace("/(tabs)");
    } catch (e: any) {
      console.error("Failed to delete group:", e);
    }
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
      {/* Absolute Blurred Wallpaper Background */}
      {wallpaperUrl ? (
        <Image
          source={{ uri: wallpaperUrl }}
          style={StyleSheet.absoluteFill}
          blurRadius={Platform.OS === "web" ? 32 : 24}
          resizeMode="cover"
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isAmoled
              ? "rgba(0, 0, 0, 0.88)"
              : theme.isDark !== false
              ? "rgba(10, 13, 20, 0.82)"
              : "rgba(246, 248, 252, 0.85)",
            backdropFilter: "blur(36px) saturate(180%)",
            WebkitBackdropFilter: "blur(36px) saturate(180%)",
          } as any,
        ]}
      />

      {/* Top Header - Safe from mobile notch */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color={isAmoled ? "#ffffff" : theme.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topHeaderCenter}>
          <Text style={styles.topHeaderTitle} numberOfLines={1}>
            {isGroup ? (chatData?.name || "Group Details") : (partnerNickname || partnerUser?.display_name || partnerUser?.username || "Contact Info")}
          </Text>
        </View>

        <View style={{ width: 68 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sleek Floating Glass Profile / Group Card */}
        <View style={styles.heroCard}>
          {isGroup ? (
            <TouchableOpacity
              style={styles.heroAvatarContainer}
              onPress={handlePickGroupAvatar}
              activeOpacity={0.85}
              disabled={uploadingGroupAvatar}
            >
              <Image
                source={{
                  uri:
                    chatData?.avatar_url ||
                    groupAvatarParam ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      chatData?.name || groupNameParam || "Group"
                    )}&background=5865F2&color=fff`,
                }}
                style={styles.heroAvatar}
              />
              <View style={styles.avatarCameraBadge}>
                {uploadingGroupAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Camera size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.heroAvatarContainer}>
              <Image
                source={{
                  uri:
                    customAvatar ||
                    partnerUser?.avatar_url ||
                    targetAvatarParam ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      partnerNickname ||
                        partnerUser?.display_name ||
                        partnerUser?.username ||
                        targetDisplayNameParam ||
                        targetUsernameParam ||
                        "Chat"
                    )}&background=5865F2&color=fff`,
                }}
                style={styles.heroAvatar}
              />
              {customAvatar && (
                <View style={styles.secretAvatarBadge}>
                  <Lock size={11} color="#ffffff" style={{ marginRight: 3 }} />
                  <Text style={styles.secretAvatarBadgeText}>Secret PFP</Text>
                </View>
              )}
            </View>
          )}

          {isGroup ? (
            isEditingGroupName ? (
              <View style={styles.inlineEditNameRow}>
                <TextInput
                  style={styles.inlineEditInput}
                  value={groupNameInput}
                  onChangeText={setGroupNameInput}
                  placeholder="Group Name"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
                <TouchableOpacity style={styles.inlineEditConfirmBtn} onPress={handleSaveGroupName}>
                  <Check size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineEditCancelBtn} onPress={() => setIsEditingGroupName(false)}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.groupTitleRow}>
                <Text style={styles.heroDisplayName} numberOfLines={1}>
                  {chatData?.name || groupNameParam || "Group Chat"}
                </Text>
                <TouchableOpacity
                  style={styles.editNameBtn}
                  onPress={() => {
                    setGroupNameInput(chatData?.name || groupNameParam || "");
                    setIsEditingGroupName(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit3 size={15} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            )
          ) : (
            <Text style={styles.heroDisplayName} numberOfLines={1}>
              {partnerNickname ||
                partnerUser?.display_name ||
                partnerUser?.username ||
                targetDisplayNameParam ||
                targetUsernameParam ||
                "Chat Partner"}
            </Text>
          )}

          {isGroup ? (
            <Text style={styles.groupMemberCountSubtitle}>
              {groupParticipants.length} {groupParticipants.length === 1 ? "member" : "members"}
            </Text>
          ) : (
            <>
              {(partnerUser?.username || targetUsernameParam) ? (
                <View style={styles.handleBadge}>
                  <Text style={styles.heroHandle}>@{partnerUser?.username || targetUsernameParam}</Text>
                </View>
              ) : null}

              {(partnerUser?.bio || targetBioParam) ? (
                <Text style={styles.heroBio}>"{partnerUser?.bio || targetBioParam}"</Text>
              ) : null}

              {daysTogether !== null && (
                <View style={styles.anniversaryPill}>
                  <Heart size={13} color="#ec4899" fill="#ec4899" />
                  <Text style={styles.anniversaryPillText}>{daysTogether} Days Together</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Main Floating Glass Segmented Tabs */}
        {isGroup ? (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "members" && styles.tabButtonActiveMedia]}
              onPress={() => setActiveTab("members")}
              activeOpacity={0.8}
            >
              <Users size={16} color={activeTab === "members" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "members" && styles.tabButtonTextActive]}>
                Members
              </Text>
              <View style={[styles.tabBadge, activeTab === "members" && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === "members" && styles.tabBadgeTextActive]}>
                  {groupParticipants.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "media" && styles.tabButtonActiveNotes]}
              onPress={() => setActiveTab("media")}
              activeOpacity={0.8}
            >
              <ImageIcon size={16} color={activeTab === "media" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "media" && styles.tabButtonTextActive]}>
                Media
              </Text>
              <View style={[styles.tabBadge, activeTab === "media" && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === "media" && styles.tabBadgeTextActive]}>
                  {sharedMedia.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "settings" && styles.tabButtonActiveNeutral]}
              onPress={() => setActiveTab("settings")}
              activeOpacity={0.8}
            >
              <Settings size={16} color={activeTab === "settings" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "settings" && styles.tabButtonTextActive]}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "media" && styles.tabButtonActiveMedia]}
              onPress={() => setActiveTab("media")}
              activeOpacity={0.8}
            >
              <ImageIcon size={16} color={activeTab === "media" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "media" && styles.tabButtonTextActive]}>
                Media
              </Text>
              <View style={[styles.tabBadge, activeTab === "media" && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === "media" && styles.tabBadgeTextActive]}>
                  {sharedMedia.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "memories" && styles.tabButtonActiveMemories]}
              onPress={() => setActiveTab("memories")}
              activeOpacity={0.8}
            >
              <Heart size={16} color={activeTab === "memories" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "memories" && styles.tabButtonTextActive]}>
                Memories
              </Text>
              <View style={[styles.tabBadge, activeTab === "memories" && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === "memories" && styles.tabBadgeTextActive]}>
                  {memories.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "notes" && styles.tabButtonActiveNotes]}
              onPress={() => setActiveTab("notes")}
              activeOpacity={0.8}
            >
              <FileText size={16} color={activeTab === "notes" ? "#ffffff" : theme.textMuted} />
              <Text style={[styles.tabButtonText, activeTab === "notes" && styles.tabButtonTextActive]}>
                Notes & Vault
              </Text>
              <View style={[styles.tabBadge, activeTab === "notes" && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === "notes" && styles.tabBadgeTextActive]}>
                  {notes.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* GROUP TAB: MEMBERS                                        */}
        {/* ========================================================= */}
        {isGroup && activeTab === "members" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionActionBar}>
              <Text style={styles.sectionHeading}>
                Participants ({groupParticipants.length})
              </Text>
              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={() => {
                  setMemberSearchQuery("");
                  setMemberSearchResults([]);
                  setAddMemberModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <UserPlus size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addPrimaryBtnText}>Add Member</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.memberListContainer}>
              {groupParticipants.map((member) => {
                const isMemberOwner = chatData?.created_by ? member.user_id === chatData.created_by : member.user_id === groupParticipants[0]?.user_id;
                const isMe = member.user_id === currentUserId;

                return (
                  <View key={member.user_id} style={styles.memberCard}>
                    <Image
                      source={{
                        uri:
                          member.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            member.display_name || member.username || "User"
                          )}&background=5865F2&color=fff`,
                      }}
                      style={styles.memberAvatar}
                    />

                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.display_name || member.username}
                          {isMe ? " (You)" : ""}
                        </Text>
                        {isMemberOwner ? (
                          <View style={styles.roleBadgeOwner}>
                            <Crown size={11} color="#fbbf24" style={{ marginRight: 3 }} />
                            <Text style={styles.roleBadgeOwnerText}>Owner</Text>
                          </View>
                        ) : (
                          <View style={styles.roleBadgeMember}>
                            <Text style={styles.roleBadgeMemberText}>Member</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberUsername}>@{member.username}</Text>
                    </View>

                    <View style={styles.memberActions}>
                      {!isMe && (
                        <TouchableOpacity
                          style={styles.memberActionBtn}
                          onPress={() => {
                            router.push({
                              pathname: "/chat",
                              params: {
                                targetUserId: member.user_id,
                                targetDisplayName: member.display_name || member.username,
                                targetUsername: member.username,
                                targetAvatar: member.avatar_url || "",
                              },
                            });
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MessageSquare size={16} color={theme.accent || "#5865F2"} />
                        </TouchableOpacity>
                      )}

                      {!isMe && isOwner && (
                        <TouchableOpacity
                          style={[styles.memberActionBtn, styles.memberActionBtnDanger]}
                          onPress={() => handleRemoveMember(member.user_id, member.display_name || member.username)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <UserMinus size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

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
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mediaVideoCard}
                        onPress={() => {
                          if (Platform.OS === "web" && typeof window !== "undefined") {
                            window.open(item.content, "_blank");
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Video size={28} color="#fff" />
                        <Text style={styles.mediaVideoText} numberOfLines={1}>Video Clip</Text>
                        <Text style={styles.mediaDateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </TouchableOpacity>
                    );
                  }

                  if (item.type === "audio") {
                    return (
                      <View key={item.id} style={styles.mediaAudioCard}>
                        <AudioPlayerBubble audioUrl={item.content} isMe={item.sender_id === currentUserId} />
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={styles.mediaDateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
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
        {/* GROUP TAB: SETTINGS & DANGER ZONE                         */}
        {/* ========================================================= */}
        {isGroup && activeTab === "settings" && (
          <View style={styles.tabContentContainer}>
            {/* Customization Tile */}
            <View style={styles.settingsSectionCard}>
              <Text style={styles.settingsSectionTitle}>Appearance & Wallpaper</Text>
              <Text style={styles.settingsSectionSubtitle}>
                Customize background wallpapers and bubble contrast for this group.
              </Text>
              <TouchableOpacity
                style={styles.settingsActionRow}
                onPress={() => setSettingsModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.settingsRowLeft}>
                  <View style={styles.settingsIconBox}>
                    <Settings size={18} color="#ffffff" />
                  </View>
                  <View>
                    <Text style={styles.settingsRowTitle}>Group Customization</Text>
                    <Text style={styles.settingsRowSub}>Wallpapers, blur & Amoled contrast</Text>
                  </View>
                </View>
                <ArrowLeft size={16} color={theme.textMuted} style={{ transform: [{ rotate: "180deg" }] }} />
              </TouchableOpacity>
            </View>

            {/* Info Card */}
            <View style={styles.settingsSectionCard}>
              <Text style={styles.settingsSectionTitle}>Group Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Members</Text>
                <Text style={styles.infoValue}>{groupParticipants.length}</Text>
              </View>
              {chatData?.created_at && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created On</Text>
                  <Text style={styles.infoValue}>
                    {new Date(chatData.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Danger Zone */}
            <View style={[styles.settingsSectionCard, styles.dangerSectionCard]}>
              <Text style={[styles.settingsSectionTitle, { color: "#f43f5e" }]}>Danger Zone</Text>

              <TouchableOpacity
                style={styles.dangerRowBtn}
                onPress={handleLeaveGroup}
                activeOpacity={0.8}
              >
                <LogOut size={16} color="#f43f5e" style={{ marginRight: 8 }} />
                <Text style={styles.dangerRowBtnText}>Leave Group</Text>
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity
                  style={[styles.dangerRowBtn, styles.dangerRowBtnSolid]}
                  onPress={handleDeleteGroup}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={[styles.dangerRowBtnText, { color: "#ffffff" }]}>Delete Group Forever</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: MEMORIES (1-ON-1 ONLY)                             */}
        {/* ========================================================= */}
        {!isGroup && activeTab === "memories" && (
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
                  Right-click (PC) or long-press (Mobile) any message or photo in chat and choose "Save to Memories 💕", or tap "Add Memory"!
                </Text>
              </View>
            ) : (
              <View style={styles.memoriesTimeline}>
                {memories.map((mem) => (
                  <View key={mem.id} style={styles.memoryCard}>
                    {mem.media_url && mem.media_type === "audio" ? (
                      <View style={{ padding: 14, backgroundColor: "rgba(0,0,0,0.15)" }}>
                        <AudioPlayerBubble audioUrl={mem.media_url} isMe={false} />
                      </View>
                    ) : mem.media_url ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setSelectedViewerImage(mem.media_url!)}
                      >
                        <Image source={{ uri: mem.media_url }} style={styles.memoryCardImage} />
                      </TouchableOpacity>
                    ) : null}

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
        {/* TAB 3: NOTES & VAULT (1-ON-1 ONLY)                        */}
        {/* ========================================================= */}
        {!isGroup && activeTab === "notes" && (
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

      {/* ========================================================= */}
      {/* MODAL: ADD GROUP MEMBER                                   */}
      {/* ========================================================= */}
      <Modal
        visible={addMemberModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members to Group</Text>
              <TouchableOpacity onPress={() => setAddMemberModalVisible(false)}>
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 18 }}>
              <View style={styles.searchBox}>
                <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username..."
                  placeholderTextColor={theme.textMuted}
                  value={memberSearchQuery}
                  onChangeText={handleSearchUsers}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchingMembers && <ActivityIndicator size="small" color={theme.accent} />}
              </View>

              <ScrollView style={{ maxHeight: 300, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                {memberSearchResults.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <Text style={{ color: theme.textMuted, fontSize: 13, fontFamily: "Josefin Sans", textAlign: "center" }}>
                      {memberSearchQuery.trim() ? "No users found" : "Type a username above to search for people to add."}
                    </Text>
                  </View>
                ) : (
                  memberSearchResults.map((u) => (
                    <View key={u.id} style={styles.searchUserRow}>
                      <Image
                        source={{
                          uri:
                            u.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              u.display_name || u.username
                            )}&background=5865F2&color=fff`,
                        }}
                        style={styles.searchUserAvatar}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.searchUserName} numberOfLines={1}>
                          {u.display_name || u.username}
                        </Text>
                        <Text style={styles.searchUserHandle}>@{u.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addUserBtn}
                        onPress={() => handleAddMember(u)}
                        disabled={addingMemberId === u.id}
                        activeOpacity={0.8}
                      >
                        {addingMemberId === u.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <UserPlus size={14} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.addUserBtnText}>Add</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group Settings & Customization Modal */}
      {isGroup && (
        <ChatSettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
          chatId={chatId}
          userId={currentUserId}
          isGroup={true}
          onSettingsSaved={(newSettings: any) => {
            if (newSettings?.wallpaper_url) setWallpaperUrl(newSettings.wallpaper_url);
          }}
        />
      )}

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
  const isDark = theme.isDark ?? (theme.id !== "light" && theme.id !== "pink");
  const cardBg = isAmoled
    ? "rgba(14, 14, 18, 0.72)"
    : isDark
    ? "rgba(22, 26, 36, 0.65)"
    : "rgba(255, 255, 255, 0.72)";

  const borderCol = isAmoled
    ? "rgba(255, 255, 255, 0.10)"
    : isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)";

  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: isAmoled ? "#000000" : theme.background,
    },
    topHeader: {
      paddingTop: Platform.OS === "ios" ? 54 : Platform.OS === "android" ? 44 : 20,
      paddingBottom: 14,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
      backgroundColor: isAmoled
        ? "rgba(0, 0, 0, 0.75)"
        : isDark
        ? "rgba(16, 20, 28, 0.75)"
        : "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      zIndex: 10,
    } as any,
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: isAmoled ? "rgba(255,255,255,0.08)" : "rgba(255, 255, 255, 0.12)",
      borderWidth: 1,
      borderColor: borderCol,
    },
    backButtonText: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    topHeaderCenter: {
      flex: 1,
      alignItems: "center",
      marginHorizontal: 12,
    },
    topHeaderTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    scrollContent: {
      paddingBottom: 60,
      alignItems: "center",
    },
    heroCard: {
      width: isDesktop ? 680 : "92%",
      marginTop: 20,
      padding: 22,
      borderRadius: 24,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
      alignItems: "center",
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    } as any,
    heroAvatarContainer: {
      position: "relative",
      marginBottom: 12,
    },
    heroAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: theme.accent || "#5865F2",
    },
    secretAvatarBadge: {
      position: "absolute",
      bottom: -4,
      alignSelf: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "#ffffff",
    },
    secretAvatarBadgeText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    heroDisplayName: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 4,
      fontFamily: "Josefin Sans",
    },
    handleBadge: {
      marginTop: 4,
      backgroundColor: "rgba(88, 101, 242, 0.12)",
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(88, 101, 242, 0.25)",
    },
    heroHandle: {
      color: theme.accent || "#5865F2",
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    heroBio: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 20,
      lineHeight: 19,
      fontStyle: "italic",
      fontFamily: "Josefin Sans",
    },
    anniversaryPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      backgroundColor: "rgba(236, 72, 153, 0.12)",
      borderColor: "rgba(236, 72, 153, 0.3)",
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 16,
    },
    anniversaryPillText: {
      color: "#ec4899",
      fontSize: 12,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    tabBar: {
      flexDirection: "row",
      width: isDesktop ? 680 : "92%",
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 5,
      marginTop: 16,
      borderWidth: 1,
      borderColor: borderCol,
      gap: 6,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
    } as any,
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 13,
      gap: 6,
    },
    tabButtonActiveMedia: {
      backgroundColor: theme.accent || "#5865F2",
      shadowColor: theme.accent || "#5865F2",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    tabButtonActiveMemories: {
      backgroundColor: "#ec4899",
      shadowColor: "#ec4899",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    tabButtonActiveNotes: {
      backgroundColor: "#3b82f6",
      shadowColor: "#3b82f6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    tabButtonText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    tabButtonTextActive: {
      color: "#ffffff",
      fontWeight: "800",
      fontFamily: "Josefin Sans",
    },
    tabBadge: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: 10,
    },
    tabBadgeActive: {
      backgroundColor: "rgba(255, 255, 255, 0.28)",
    },
    tabBadgeText: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: "800",
      fontFamily: "Josefin Sans",
    },
    tabBadgeTextActive: {
      color: "#ffffff",
      fontFamily: "Josefin Sans",
    },
    tabContentContainer: {
      width: isDesktop ? 680 : "92%",
      marginTop: 18,
    },
    filterChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
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
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    } as any,
    filterChipActive: {
      backgroundColor: isAmoled ? "#ffffff" : (theme.accent || "#5865F2"),
      borderColor: isAmoled ? "#ffffff" : (theme.accent || "#5865F2"),
    },
    filterChipText: {
      color: isAmoled ? "#a1a1aa" : theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    filterChipTextActive: {
      color: isAmoled ? "#000000" : "#ffffff",
      fontWeight: "700",
      fontFamily: "Josefin Sans",
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
      borderWidth: 1,
      borderColor: borderCol,
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
      fontFamily: "Josefin Sans",
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
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    } as any,
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
      fontFamily: "Josefin Sans",
    },
    mediaDateText: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 2,
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
    },
    emptyStateSub: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 6,
      maxWidth: 320,
      lineHeight: 18,
      fontFamily: "Josefin Sans",
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
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    } as any,
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
      fontFamily: "Josefin Sans",
    },
    anniversarySub: {
      color: theme.textMuted,
      fontSize: 13,
      marginTop: 2,
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    } as any,
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
      fontFamily: "Josefin Sans",
    },
    memoryCardCaption: {
      color: isAmoled ? "#e2e8f0" : theme.text,
      fontSize: 14,
      marginTop: 8,
      lineHeight: 20,
      fontFamily: "Josefin Sans",
    },
    memoryCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
    },
    memoryCardDate: {
      color: theme.textMuted,
      fontSize: 12,
      fontFamily: "Josefin Sans",
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
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    } as any,
    vaultToggleBtnActive: {
      borderColor: "rgba(16, 185, 129, 0.4)",
      backgroundColor: "rgba(16, 185, 129, 0.1)",
    },
    vaultToggleBtnText: {
      color: "#fbbf24",
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
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
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    } as any,
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
      fontFamily: "Josefin Sans",
    },
    noteCardContent: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "Josefin Sans",
    },
    noteCardDate: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 12,
      fontFamily: "Josefin Sans",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    } as any,
    modalCard: {
      width: isDesktop ? 520 : "100%",
      maxHeight: "85%",
      backgroundColor: isAmoled ? "#121214" : theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: borderCol,
      overflow: "hidden",
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
    } as any,
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
      fontFamily: "Josefin Sans",
    },
    inputLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 12,
      marginBottom: 6,
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
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
      fontFamily: "Josefin Sans",
    },
    avatarCameraBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.accent || "#5865F2",
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: isAmoled ? "#000000" : "#ffffff",
    },
    groupTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    editNameBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    inlineEditNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
      maxWidth: 320,
    },
    inlineEditInput: {
      flex: 1,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: theme.accent || "#5865F2",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    inlineEditConfirmBtn: {
      backgroundColor: "#10b981",
      padding: 8,
      borderRadius: 10,
    },
    inlineEditCancelBtn: {
      backgroundColor: "rgba(244, 63, 94, 0.8)",
      padding: 8,
      borderRadius: 10,
    },
    groupMemberCountSubtitle: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 4,
      fontFamily: "Josefin Sans",
    },
    tabButtonActiveNeutral: {
      backgroundColor: isAmoled ? "#27272a" : (isDark ? "#2a2d3d" : "#e2e8f0"),
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    memberListContainer: {
      gap: 10,
    },
    memberCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: cardBg,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderCol,
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
    } as any,
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    memberUsername: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 2,
      fontFamily: "Josefin Sans",
    },
    roleBadgeOwner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(251, 191, 36, 0.16)",
      borderColor: "rgba(251, 191, 36, 0.35)",
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
    },
    roleBadgeOwnerText: {
      color: "#fbbf24",
      fontSize: 10,
      fontWeight: "800",
      fontFamily: "Josefin Sans",
    },
    roleBadgeMember: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
    },
    roleBadgeMemberText: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    memberActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    memberActionBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    memberActionBtnDanger: {
      backgroundColor: "rgba(244, 63, 94, 0.12)",
    },
    settingsSectionCard: {
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: borderCol,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    } as any,
    settingsSectionTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 15,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
      marginBottom: 4,
    },
    settingsSectionSubtitle: {
      color: theme.textMuted,
      fontSize: 12,
      fontFamily: "Josefin Sans",
      marginBottom: 14,
    },
    settingsActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isAmoled ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
      padding: 12,
      borderRadius: 14,
    },
    settingsRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    settingsIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.accent || "#5865F2",
      alignItems: "center",
      justifyContent: "center",
    },
    settingsRowTitle: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    settingsRowSub: {
      color: theme.textMuted,
      fontSize: 11,
      fontFamily: "Josefin Sans",
      marginTop: 2,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
    },
    infoLabel: {
      color: theme.textMuted,
      fontSize: 13,
      fontFamily: "Josefin Sans",
    },
    infoValue: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    dangerSectionCard: {
      borderColor: "rgba(244, 63, 94, 0.25)",
      backgroundColor: isAmoled ? "rgba(244, 63, 94, 0.06)" : "rgba(244, 63, 94, 0.04)",
    },
    dangerRowBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(244, 63, 94, 0.4)",
      marginTop: 10,
      backgroundColor: "transparent",
    },
    dangerRowBtnSolid: {
      backgroundColor: "#f43f5e",
      borderColor: "#f43f5e",
    },
    dangerRowBtnText: {
      color: "#f43f5e",
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 14,
      fontFamily: "Josefin Sans",
    },
    searchUserRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
    },
    searchUserAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    searchUserName: {
      color: isAmoled ? "#ffffff" : theme.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    searchUserHandle: {
      color: theme.textMuted,
      fontSize: 11,
      fontFamily: "Josefin Sans",
    },
    addUserBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
    },
    addUserBtnText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
  });
}
