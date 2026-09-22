import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Image, ScrollView, Platform, TextInput, useWindowDimensions } from "react-native";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import {
  X, Upload, Trash2, Image as ImageIcon, AlertTriangle, Bell, Sparkles, Heart,
  Moon, Sun, Check, RefreshCw, Layers, Edit3, Camera, RotateCcw, User, Lock,
  Volume2, Play, Pause, Music, Plus, Palette, FolderPlus,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadImageToR2, uploadChatAvatarToR2, uploadCustomChimeToR2, deleteFileFromR2ByUrl } from "../lib/r2";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import { isFeatureEnabled, UserProfile } from "../lib/features";
import { useTheme } from "../context/ThemeContext";
import {
  WallpaperSlot,
  WallpaperGroup,
  WallpaperDeckConfig,
  DEFAULT_SLOTS,
  DEFAULT_GROUPS,
  createDefaultDeck,
  normalizeDeck,
  getAllSlots,
  getActiveSlot,
  getActiveGroup,
  getSmartBubbleColors,
  loadDeckFromLocal,
  saveDeckToLocal,
  fetchDeckFromCloud,
  persistDeckToCloud,
  broadcastDeckUpdate,
  MoodTriggerType,
} from "../utils/wallpaperDeck";
import {
  persistChatAvatarToCloud,
  broadcastChatAvatarUpdate,
  loadChatAvatarsFromLocal,
  fetchChatAvatarsFromCloud,
} from "../utils/chatAvatar";
import {
  SOUND_PRESETS,
  getSoundConfig,
  saveSoundConfig,
  playNotificationChime,
  SoundConfig,
} from "../utils/soundManager";

const FONTS = [
  { name: "System", value: "system" },
  { name: "Serif", value: "serif" },
  { name: "Monospace", value: "monospace" },
  { name: "Cursive", value: "cursive" },
  { name: "Arial", value: "Arial" },
  { name: "Georgia", value: "Georgia" },
  { name: "Verdana", value: "Verdana" },
];

const BUBBLE_COLORS = [
  // Signature & Indigo
  { label: "Indigo", color: "#5865F2" },
  { label: "Royal", color: "#4f46e5" },
  { label: "Ultraviolet", color: "#7c3aed" },
  { label: "Neon Cyan", color: "#06b6d4" },
  { label: "Sky", color: "#38bdf8" },

  // Nature & Mountain Greens
  { label: "Sage Mountain", color: "#2e6f40" },
  { label: "Deep Pine", color: "#166534" },
  { label: "Forest", color: "#15803d" },
  { label: "Moss", color: "#4d7c0f" },
  { label: "Mint Cream", color: "#34d399" },
  { label: "Matcha", color: "#84cc16" },

  // Warm & Crimson
  { label: "Crimson Sun", color: "#b91c1c" },
  { label: "Ruby", color: "#dc2626" },
  { label: "Rose", color: "#f43f5e" },
  { label: "Dusty Rose", color: "#fb7185" },
  { label: "Coral", color: "#fb923c" },
  { label: "Terracotta", color: "#c2410c" },
  { label: "Sunset Amber", color: "#d97706" },
  { label: "Peach", color: "#fbbf24" },

  // Pastels & Purples
  { label: "Lavender Mist", color: "#a78bfa" },
  { label: "Lilac", color: "#c084fc" },
  { label: "Mauve", color: "#e879f9" },
  { label: "Berry", color: "#a21caf" },

  // Monochrome & Minimal
  { label: "Onyx", color: "#18181b" },
  { label: "Graphite", color: "#3f3f46" },
  { label: "Slate", color: "#475569" },
  { label: "Frost Silver", color: "#64748b" },
];

const RECEIVED_COLORS = [
  { label: "Dark Charcoal", color: "#2b2d31" },
  { label: "Frost Granite", color: "#272e39" },
  { label: "Deep Slate", color: "#1e293b" },
  { label: "Midnight Navy", color: "#0f172a" },
  { label: "Pine Shadow", color: "#14291e" },
  { label: "Moss Tint", color: "#1e2f24" },
  { label: "Crimson Wine", color: "#351a21" },
  { label: "Rose Velvet", color: "#3d1421" },
  { label: "Plum Twilight", color: "#2a1538" },
  { label: "Dark Amber", color: "#29211a" },
  { label: "Ocean Abyss", color: "#132838" },
  { label: "Midnight Velvet", color: "#1e1b4b" },
];

const BUBBLE_SHAPES = [
  { label: "Round", value: "round", radius: 18 },
  { label: "Soft", value: "soft", radius: 10 },
  { label: "Sharp", value: "sharp", radius: 4 },
];

const THEMES = [
  { name: "Default", sent: "#5865F2", received: "#2b2d31", label: "Discord Classic" },
  { name: "Mountain Red Sun", sent: "#2e6f40", received: "#272e39", label: "Red Sun Mountain" },
  { name: "Sakura", sent: "#fb7185", received: "#3b1f2b", label: "Sakura Blossom" },
  { name: "Cyberpunk", sent: "#06b6d4", received: "#1e1b4b", label: "Neon Night" },
  { name: "Sunset", sent: "#f97316", received: "#3b1f1f", label: "Golden Dusk" },
  { name: "Forest", sent: "#10b981", received: "#1a2e22", label: "Emerald Canopy" },
  { name: "Midnight", sent: "#6366f1", received: "#18181b", label: "Midnight Sky" },
  { name: "Rose", sent: "#f43f5e", received: "#2e1218", label: "Crimson Velvet" },
  { name: "Ocean", sent: "#0ea5e9", received: "#0f2027", label: "Deep Sea" },
  { name: "Monochrome", sent: "#3f3f46", received: "#18181b", label: "Minimal Onyx" },
];

const SEND_EMOJI_PRESETS = [
  { label: "Default", emoji: "" },
  { label: "🔥 Fire", emoji: "🔥" },
  { label: "❤️ Heart", emoji: "❤️" },
  { label: "⚡ Bolt", emoji: "⚡" },
  { label: "✨ Sparkles", emoji: "✨" },
  { label: "🕊️ Dove", emoji: "🕊️" },
  { label: "💬 Bubble", emoji: "💬" },
  { label: "🎯 Target", emoji: "🎯" },
  { label: "🌸 Sakura", emoji: "🌸" },
  { label: "💌 Letter", emoji: "💌" },
  { label: "👾 Arcade", emoji: "👾" },
  { label: "🍕 Pizza", emoji: "🍕" },
];

export const FONT_OPTIONS = [
  { label: "System Default", value: "system" },
  { label: "Josefin Sans", value: "Josefin Sans" },
  { label: "Cinzel", value: "Cinzel" },
  { label: "Playfair", value: "Playfair Display" },
  { label: "Caveat", value: "Caveat" },
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Pacifico", value: "Pacifico" },
  { label: "Shadows Light", value: "Shadows Into Light" },
  { label: "Indie Flower", value: "Indie Flower" },
  { label: "Permanent Marker", value: "Permanent Marker" },
  { label: "Satisfy", value: "Satisfy" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Sacramento", value: "Sacramento" },
  { label: "Press Start 2P", value: "Press Start 2P" },
  { label: "VT323", value: "VT323" },
  { label: "Monoton", value: "Monoton" },
  { label: "Bungee", value: "Bungee" },
  { label: "Bungee Shade", value: "Bungee Shade" },
  { label: "Faster One", value: "Faster One" },
  { label: "Freckle Face", value: "Freckle Face" },
  { label: "Creepster", value: "Creepster" },
  { label: "Nosifer", value: "Nosifer" },
  { label: "Eater", value: "Eater" },
  { label: "Sedgwick Ave", value: "Sedgwick Ave" },
  { label: "Cabin Sketch", value: "Cabin Sketch" },
  { label: "Special Elite", value: "Special Elite" },
  { label: "Orbitron", value: "Orbitron" },
  { label: "Audiowide", value: "Audiowide" },
  { label: "Megrim", value: "Megrim" },
  { label: "Poiret One", value: "Poiret One" },
  { label: "Comfortaa", value: "Comfortaa" },
  { label: "Righteous", value: "Righteous" },
  { label: "Fredoka", value: "Fredoka" },
  { label: "Abril Fatface", value: "Abril Fatface" },
  { label: "DM Serif", value: "DM Serif Display" },
  { label: "Space Grotesk", value: "Space Grotesk" },
  { label: "Silkscreen", value: "Silkscreen" },
];

export type SettingsTab = "profile" | "appearance" | "wallpaper" | "sound" | "danger";

export const SETTINGS_TABS: { id: SettingsTab; label: string; icon: any; subtitle: string }[] = [
  { id: "profile", label: "Secret PFP & Name", icon: Lock, subtitle: "Chat photo & nickname" },
  { id: "appearance", label: "Themes & Bubbles", icon: Sparkles, subtitle: "Colors, shapes & fonts" },
  { id: "wallpaper", label: "Wallpaper Deck", icon: Layers, subtitle: "Collections, moods & effects" },
  { id: "sound", label: "Sounds & Icons", icon: Volume2, subtitle: "Chimes & send button" },
  { id: "danger", label: "Alerts & Danger", icon: AlertTriangle, subtitle: "Broadcast & delete" },
];

interface ChatSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  targetUser?: any;
  currentSettings?: any;
  onSettingsSaved?: (newSettings: any) => void;
  onSendAlert?: (alertData: { title: string; message: string; actionText: string; cancelText: string }) => void;
  myProfile?: UserProfile | null;
  publicFeatures?: string[];
  chatAvatars?: { [userId: string]: string | null };
  onChatAvatarUpdated?: (userId: string, newUrl: string | null) => void;
}

export default function ChatSettingsModal({
  visible,
  onClose,
  chatId,
  userId,
  targetUser,
  currentSettings,
  onSettingsSaved,
  onSendAlert,
  myProfile: myProfileProp,
  publicFeatures: publicFeaturesProp,
  chatAvatars,
  onChatAvatarUpdated,
}: ChatSettingsModalProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<WallpaperDeckConfig>(() => createDefaultDeck(currentSettings?.wallpaper_url, userId));
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => deck.activeGroupId || deck.groups?.[0]?.id || "group_art");
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => deck.activeSlotId || "slot_mountain_red_sun");
  const [autoMatchBubbles, setAutoMatchBubbles] = useState<boolean>(() => deck.autoMatchBubbles !== false);
  const [personalColorOverride, setPersonalColorOverride] = useState<boolean>(() => !!currentSettings?.personal_color_override);

  const [wallpaperUrl, setWallpaperUrl] = useState(currentSettings?.wallpaper_url || null);
  const [dim, setDim] = useState(currentSettings?.wallpaper_dim || 0);
  const [blur, setBlur] = useState(currentSettings?.wallpaper_blur || 0);
  const [zoom, setZoom] = useState(currentSettings?.wallpaper_zoom || 1);
  const [fontFamily, setFontFamily] = useState(currentSettings?.font_family || "system");
  const [bubbleColorSent, setBubbleColorSent] = useState(currentSettings?.bubble_color_sent || "#5865F2");
  const [bubbleColorReceived, setBubbleColorReceived] = useState(currentSettings?.bubble_color_received || "#2b2d31");
  const [bubbleShape, setBubbleShape] = useState(currentSettings?.bubble_shape || "round");
  const [gradientEnabled, setGradientEnabled] = useState(currentSettings?.bubble_gradient_enabled || false);
  const [gradientColor2, setGradientColor2] = useState(currentSettings?.bubble_gradient_color2 || "#a78bfa");
  const [wallpaperDoodle, setWallpaperDoodle] = useState(currentSettings?.wallpaper_doodle || "none");
  const [anniversaryDate, setAnniversaryDate] = useState(currentSettings?.anniversary_date || null);
  const [sendButtonEmoji, setSendButtonEmoji] = useState(currentSettings?.send_button_emoji || "");

  // New Group Modal
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("📁");

  // Chat-Specific Profile Photo (Chat PFP) state
  const [myChatAvatar, setMyChatAvatar] = useState<string | null>(() => chatAvatars?.[userId] || null);
  const [partnerChatAvatar, setPartnerChatAvatar] = useState<string | null>(() => (targetUser?.id ? chatAvatars?.[targetUser.id] : null) || null);
  const [uploadingChatAvatar, setUploadingChatAvatar] = useState(false);

  // Custom Alert Popup Modal State
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertActionText, setAlertActionText] = useState("");
  const [alertCancelText, setAlertCancelText] = useState("");
  const [lastSentTime, setLastSentTime] = useState(0);

  const [internalProfile, setInternalProfile] = useState<UserProfile | null>(null);
  const [internalPublicFeatures, setInternalPublicFeatures] = useState<string[]>([]);

  const activeProfile = myProfileProp !== undefined ? myProfileProp : internalProfile;
  const activePublicFeatures = publicFeaturesProp !== undefined ? publicFeaturesProp : internalPublicFeatures;

  const [partnerUser, setPartnerUser] = useState<any>(targetUser || null);
  const [partnerNickname, setPartnerNickname] = useState(targetUser?.nickname || currentSettings?.nickname || "");
  const [myNicknameFromPartner, setMyNicknameFromPartner] = useState("");

  // Sounds & Chimes State
  const [soundConfig, setSoundConfig] = useState<SoundConfig>({
    soundId: "discord_classic",
    customUrl: null,
    volume: 0.85,
    enabled: true,
  });
  const [playingPresetId, setPlayingPresetId] = useState<string | null>(null);
  const [uploadingChime, setUploadingChime] = useState(false);

  useEffect(() => {
    getSoundConfig().then(setSoundConfig);
  }, []);

  const handleSelectSound = async (presetId: string, customUrl?: string | null) => {
    const updated: SoundConfig = {
      ...soundConfig,
      soundId: presetId,
      customUrl: customUrl || null,
    };
    setSoundConfig(updated);
    await saveSoundConfig(updated);
  };

  const handleTestSound = (presetId: string, url?: string) => {
    setPlayingPresetId(presetId);
    playNotificationChime(presetId, url);
    setTimeout(() => setPlayingPresetId(null), 1200);
  };

  const handleUploadCustomChime = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        setUploadingChime(true);
        const asset = result.assets[0];
        const publicUrl = await uploadCustomChimeToR2(userId, asset.base64!, asset.mimeType || "audio/mp3");
        await handleSelectSound("custom", publicUrl);
      }
    } catch (e) {
      console.error("Failed to upload chime:", e);
      if (Platform.OS === "web") alert("Failed to upload custom audio.");
    } finally {
      setUploadingChime(false);
    }
  };

  const pickAndUploadChatAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setUploadingChatAvatar(true);
        const mimeType = asset.mimeType || "image/jpeg";
        if (!asset.base64) throw new Error("Could not read image data");
        const url = await uploadChatAvatarToR2(chatId, userId, asset.base64, mimeType);
        
        setMyChatAvatar(url);
        if (onChatAvatarUpdated) onChatAvatarUpdated(userId, url);
        await persistChatAvatarToCloud(chatId, userId, url);
        broadcastChatAvatarUpdate(chatId, userId, url);
      }
    } catch (e) {
      console.error("Failed to upload secret chat avatar", e);
      if (Platform.OS === "web") alert("Failed to upload secret chat photo.");
    } finally {
      setUploadingChatAvatar(false);
    }
  };

  const removeChatAvatar = async () => {
    try {
      setUploadingChatAvatar(true);
      if (myChatAvatar) {
        await deleteFileFromR2ByUrl(myChatAvatar).catch(() => {});
      }
      setMyChatAvatar(null);
      if (onChatAvatarUpdated) onChatAvatarUpdated(userId, null);
      await persistChatAvatarToCloud(chatId, userId, null);
      broadcastChatAvatarUpdate(chatId, userId, null);
    } catch (e) {
      console.error("Failed to remove secret chat avatar", e);
    } finally {
      setUploadingChatAvatar(false);
    }
  };

  // Sync internal chatAvatars if props change
  useEffect(() => {
    if (chatAvatars) {
      if (chatAvatars[userId] !== undefined) setMyChatAvatar(chatAvatars[userId]);
      if (targetUser?.id && chatAvatars[targetUser.id] !== undefined) setPartnerChatAvatar(chatAvatars[targetUser.id]);
    }
  }, [chatAvatars, userId, targetUser?.id]);

  useEffect(() => {
    if (visible && chatId) {
      loadDeckFromLocal(chatId).then(localDeck => {
        if (localDeck) {
          const norm = normalizeDeck(localDeck, currentSettings?.wallpaper_url, userId);
          setDeck(norm);
          setSelectedGroupId(norm.activeGroupId);
          setSelectedSlotId(norm.activeSlotId);
        }
      });
      fetchDeckFromCloud(chatId).then(cloudDeck => {
        if (cloudDeck) {
          const norm = normalizeDeck(cloudDeck, currentSettings?.wallpaper_url, userId);
          setDeck(norm);
          setSelectedGroupId(norm.activeGroupId);
          setSelectedSlotId(norm.activeSlotId);
        }
      });

      if (currentSettings) {
        if (currentSettings.wallpaper_url !== undefined) setWallpaperUrl(currentSettings.wallpaper_url || null);
        if (currentSettings.wallpaper_dim !== undefined) setDim(currentSettings.wallpaper_dim);
        if (currentSettings.wallpaper_blur !== undefined) setBlur(currentSettings.wallpaper_blur);
        if (currentSettings.wallpaper_zoom !== undefined) setZoom(currentSettings.wallpaper_zoom);
        if (currentSettings.font_family) setFontFamily(currentSettings.font_family);
        if (currentSettings.bubble_color_sent) setBubbleColorSent(currentSettings.bubble_color_sent);
        if (currentSettings.bubble_color_received) setBubbleColorReceived(currentSettings.bubble_color_received);
        if (currentSettings.bubble_shape) setBubbleShape(currentSettings.bubble_shape);
        if (currentSettings.bubble_gradient_enabled !== undefined) setGradientEnabled(currentSettings.bubble_gradient_enabled);
        if (currentSettings.bubble_gradient_color2) setGradientColor2(currentSettings.bubble_gradient_color2);
        if (currentSettings.wallpaper_doodle) setWallpaperDoodle(currentSettings.wallpaper_doodle);
        if (currentSettings.anniversary_date) setAnniversaryDate(currentSettings.anniversary_date);
        if (currentSettings.send_button_emoji !== undefined) setSendButtonEmoji(currentSettings.send_button_emoji || "");
        if (currentSettings.personal_color_override !== undefined) setPersonalColorOverride(!!currentSettings.personal_color_override);
        if (currentSettings.auto_match_bubbles !== undefined) setAutoMatchBubbles(currentSettings.auto_match_bubbles !== false);
        if (currentSettings.partner_nickname !== undefined) setPartnerNickname(currentSettings.partner_nickname || "");
        else if (currentSettings.nickname !== undefined) setPartnerNickname(currentSettings.nickname || "");
      }

      // Fetch what the partner nicknamed us
      if (targetUser?.id) {
        supabase.from("chat_participants").select("partner_nickname, nickname").eq("chat_id", chatId).eq("user_id", targetUser.id).single().then(({ data }) => {
          if (data) {
            const nick = data.partner_nickname || data.nickname;
            if (nick) setMyNicknameFromPartner(nick);
          }
        });
      }
    }
  }, [visible, currentSettings, chatId, userId, targetUser?.id]);

  const activeGroup = useMemo(() => {
    return (deck.groups || []).find(g => g.id === selectedGroupId) || deck.groups?.[0] || DEFAULT_GROUPS[0];
  }, [deck.groups, selectedGroupId]);

  const selectedSlot = useMemo(() => {
    const all = getAllSlots(deck.groups || []);
    return all.find(s => s.id === selectedSlotId) || activeGroup.slots?.[0] || all[0];
  }, [deck.groups, selectedSlotId, activeGroup]);

  const applyTheme = useCallback((selectedTheme: typeof THEMES[0]) => {
    setBubbleColorSent(selectedTheme.sent);
    setBubbleColorReceived(selectedTheme.received);
    setGradientEnabled(false);
    setAutoMatchBubbles(false);
  }, []);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    const targetGroup = (deck.groups || []).find(g => g.id === groupId);
    if (targetGroup && targetGroup.slots && targetGroup.slots.length > 0) {
      setSelectedSlotId(targetGroup.slots[0].id);
    }
  }, [deck.groups]);

  const handleSetActiveSlot = useCallback((slotId: string) => {
    setDeck(prev => {
      const allSlots = getAllSlots(prev.groups || []);
      const slot = allSlots.find(s => s.id === slotId) || allSlots[0];
      const targetGroup = (prev.groups || []).find(g => g.slots?.some(s => s.id === slotId));
      const activeGroupId = targetGroup?.id || prev.activeGroupId;

      const smartColors = getSmartBubbleColors(slot);
      if (autoMatchBubbles && !personalColorOverride) {
        setBubbleColorSent(smartColors.sent);
        setBubbleColorReceived(smartColors.received);
      }

      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        activeSlotId: slotId,
        activeGroupId,
        autoMatchBubbles,
        updatedAt: Date.now(),
        updatedBy: userId,
      };

      setWallpaperUrl(slot.url);
      setDim(slot.dim);
      setBlur(slot.blur);
      setZoom(slot.zoom);

      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId, autoMatchBubbles, personalColorOverride]);

  const updateSlot = useCallback((slotId: string, patch: Partial<WallpaperSlot>) => {
    setDeck(prev => {
      const updatedGroups = (prev.groups || []).map(g => ({
        ...g,
        slots: g.slots.map(s => s.id === slotId ? { ...s, ...patch } : s),
      }));
      const allSlots = getAllSlots(updatedGroups);
      const isCurrentActive = prev.activeSlotId === slotId;
      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        groups: updatedGroups,
        slots: allSlots,
        updatedAt: Date.now(),
        updatedBy: userId,
      };
      if (isCurrentActive) {
        if (patch.url !== undefined) setWallpaperUrl(patch.url);
        if (patch.dim !== undefined) setDim(patch.dim);
        if (patch.blur !== undefined) setBlur(patch.blur);
        if (patch.zoom !== undefined) setZoom(patch.zoom);
        broadcastDeckUpdate(chatId, userId, updatedDeck);
      }
      saveDeckToLocal(chatId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const handleAddNewSlotToGroup = useCallback((groupId: string) => {
    setDeck(prev => {
      const targetGroup = (prev.groups || []).find(g => g.id === groupId);
      if (!targetGroup) return prev;
      const newSlotIndex = (targetGroup.slots?.length || 0) + 1;
      const newSlot: WallpaperSlot = {
        id: `slot_${groupId}_${Date.now()}`,
        name: `Wallpaper ${newSlotIndex}`,
        url: null,
        dim: 0,
        blur: 0,
        zoom: 1,
        mood: "none",
        groupId,
        isCustom: true,
      };
      const updatedGroups = prev.groups.map(g => g.id === groupId ? { ...g, slots: [...g.slots, newSlot] } : g);
      const allSlots = getAllSlots(updatedGroups);
      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        groups: updatedGroups,
        slots: allSlots,
        updatedAt: Date.now(),
        updatedBy: userId,
      };
      setSelectedSlotId(newSlot.id);
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return;
    const newGroupId = `group_user_${Date.now()}`;
    const initialSlot: WallpaperSlot = {
      id: `slot_${newGroupId}_1`,
      name: "First Wallpaper",
      url: null,
      dim: 0,
      blur: 0,
      zoom: 1,
      mood: "none",
      groupId: newGroupId,
      isCustom: true,
    };
    const newGroup: WallpaperGroup = {
      id: newGroupId,
      name: newGroupName.trim(),
      icon: newGroupIcon || "📁",
      description: "Custom user collection",
      slots: [initialSlot],
    };

    setDeck(prev => {
      const updatedGroups = [...(prev.groups || []), newGroup];
      const allSlots = getAllSlots(updatedGroups);
      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        groups: updatedGroups,
        slots: allSlots,
        updatedAt: Date.now(),
        updatedBy: userId,
      };
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });

    setSelectedGroupId(newGroupId);
    setSelectedSlotId(initialSlot.id);
    setNewGroupName("");
    setNewGroupModalVisible(false);
  }, [newGroupName, newGroupIcon, chatId, userId]);

  const pickImageForSlot = async (slotId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setLoading(true);
      try {
        const mimeType = asset.mimeType || "image/jpeg";
        if (!asset.base64) throw new Error("Could not read image data");
        const url = await uploadImageToR2(`wallpapers/${chatId}/${userId}-${Date.now()}`, asset.base64, mimeType);
        
        setDeck(prev => {
          const updatedGroups = (prev.groups || []).map(g => ({
            ...g,
            slots: g.slots.map(s => s.id === slotId ? { ...s, url } : s),
          }));
          const allSlots = getAllSlots(updatedGroups);
          const isCurrentActive = prev.activeSlotId === slotId;
          const updatedDeck: WallpaperDeckConfig = {
            ...prev,
            groups: updatedGroups,
            slots: allSlots,
            updatedAt: Date.now(),
            updatedBy: userId,
          };
          if (isCurrentActive) {
            setWallpaperUrl(url);
          }
          saveDeckToLocal(chatId, updatedDeck);
          persistDeckToCloud(chatId, userId, updatedDeck);
          broadcastDeckUpdate(chatId, userId, updatedDeck);
          return updatedDeck;
        });
      } catch (e) { console.error("Failed to upload wallpaper", e); }
      finally { setLoading(false); }
    }
  };

  const removeImageForSlot = useCallback((slotId: string) => {
    setDeck(prev => {
      const updatedGroups = (prev.groups || []).map(g => ({
        ...g,
        slots: g.slots.map(s => s.id === slotId ? { ...s, url: null } : s),
      }));
      const allSlots = getAllSlots(updatedGroups);
      const isCurrentActive = prev.activeSlotId === slotId;
      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        groups: updatedGroups,
        slots: allSlots,
        updatedAt: Date.now(),
        updatedBy: userId,
      };
      if (isCurrentActive) {
        setWallpaperUrl(null);
      }
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const handleDeleteSlot = useCallback((slotId: string) => {
    setDeck(prev => {
      if (prev.activeSlotId === slotId) {
        if (Platform.OS === "web") alert("Cannot delete the currently active wallpaper. Please activate another one first.");
        return prev;
      }
      const updatedGroups = (prev.groups || []).map(g => ({
        ...g,
        slots: g.slots.filter(s => s.id !== slotId),
      }));
      const allSlots = getAllSlots(updatedGroups);
      const updatedDeck: WallpaperDeckConfig = {
        ...prev,
        groups: updatedGroups,
        slots: allSlots,
        updatedAt: Date.now(),
        updatedBy: userId,
      };
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      const firstAvailable = allSlots[0]?.id || "";
      setSelectedSlotId(firstAvailable);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const handleDeleteChat = async () => {
    if (Platform.OS === "web") {
      const confirm = window.confirm("Are you sure you want to permanently delete this chat? This cannot be undone.");
      if (!confirm) return;
    }
    setLoading(true);
    try {
      await supabase.from("messages").delete().eq("chat_id", chatId);
      await supabase.from("chat_participants").delete().eq("chat_id", chatId);
      await supabase.from("chats").delete().eq("id", chatId);
      onClose();
      router.replace("/(tabs)");
    } catch (e) {
      console.error(e);
      if (Platform.OS === "web") alert("Failed to delete chat");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const activeSlot = getActiveSlot(deck);
      const finalWallpaperUrl = activeSlot?.url || wallpaperUrl;

      const payload = {
        chat_id: chatId,
        user_id: userId,
        font_family: fontFamily,
        bubble_color_sent: bubbleColorSent,
        bubble_color_received: bubbleColorReceived,
        bubble_shape: bubbleShape,
        bubble_gradient_enabled: gradientEnabled,
        bubble_gradient_color2: gradientColor2,
        wallpaper_url: finalWallpaperUrl,
        wallpaper_dim: activeSlot?.dim ?? dim,
        wallpaper_blur: activeSlot?.blur ?? blur,
        wallpaper_zoom: activeSlot?.zoom ?? zoom,
        wallpaper_doodle: wallpaperDoodle,
        anniversary_date: anniversaryDate,
        send_button_emoji: sendButtonEmoji,
        auto_match_bubbles: autoMatchBubbles,
        personal_color_override: personalColorOverride,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("chat_participants").upsert(payload, { onConflict: "chat_id,user_id" });

      if (partnerNickname !== (targetUser?.nickname || "")) {
        await supabase
          .from("chat_participants")
          .update({ partner_nickname: partnerNickname || null })
          .eq("chat_id", chatId)
          .eq("user_id", userId);
      }

      await saveDeckToLocal(chatId, deck);
      await persistDeckToCloud(chatId, userId, deck);
      broadcastDeckUpdate(chatId, userId, deck);

      if (onSettingsSaved) {
        onSettingsSaved({
          ...currentSettings,
          ...payload,
          partner_nickname: partnerNickname,
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      if (Platform.OS === "web") alert("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const shapeRadius = BUBBLE_SHAPES.find((s) => s.value === bubbleShape)?.radius || 18;

  // 1. Secret Profile & Identity Tab
  const renderProfileTab = () => (
    <View>
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Lock size={18} color={theme.accent || "#5865F2"} />
          <Text style={styles.sectionCardTitle}>Secret Chat Profile Photo</Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
          Personalize how you appear in this 1-on-1 chat. This photo is strictly private and visible ONLY to you and your partner within this conversation. Outside this chat, your global profile photo remains visible.
        </Text>

        <View style={styles.chatPfpRow}>
          <View style={styles.chatPfpAvatarWrapper}>
            <Image
              source={{ uri: myChatAvatar || activeProfile?.avatar_url || "https://ui-avatars.com/api/?name=U" }}
              style={styles.chatPfpAvatar}
            />
            {!myChatAvatar && (
              <View style={styles.defaultPfpBadge}>
                <Text style={styles.defaultPfpText}>Default Global PFP</Text>
              </View>
            )}
            {myChatAvatar && (
              <View style={styles.secretPfpBadge}>
                <Lock size={10} color="#ffffff" />
                <Text style={styles.secretPfpText}>Secret</Text>
              </View>
            )}
          </View>

          <View style={styles.chatPfpActions}>
            <TouchableOpacity
              style={styles.uploadChatPfpBtn}
              onPress={pickAndUploadChatAvatar}
              disabled={uploadingChatAvatar}
              activeOpacity={0.8}
            >
              {uploadingChatAvatar ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Camera size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.uploadChatPfpText}>
                    {myChatAvatar ? "Change Chat Photo" : "Upload Chat Photo"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {myChatAvatar && (
              <TouchableOpacity
                style={styles.resetChatPfpBtn}
                onPress={removeChatAvatar}
                disabled={uploadingChatAvatar}
                activeOpacity={0.7}
              >
                <RotateCcw size={14} color="#f43f5e" style={{ marginRight: 4 }} />
                <Text style={styles.resetChatPfpText}>Reset to Global PFP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.sectionCard, { marginTop: 14 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 16 }}>🏷️</Text>
          <Text style={styles.sectionCardTitle}>Chat Partner Nickname</Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
          Set a custom nickname for {targetUser?.username || "your partner"}.
        </Text>
        <TextInput
          style={styles.alertInput}
          value={partnerNickname}
          onChangeText={setPartnerNickname}
          placeholder="e.g. My Favorite Person ❤️"
          placeholderTextColor={theme.textMuted}
        />
        {myNicknameFromPartner ? (
          <View style={{ marginTop: 12, padding: 10, backgroundColor: "rgba(99, 102, 241, 0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.2)" }}>
            <Text style={{ color: theme.accent || "#5865F2", fontSize: 13, fontWeight: "600" }}>
              ✨ {partnerUser?.profiles?.username || "Partner"} set your nickname to: "{myNicknameFromPartner}"
            </Text>
          </View>
        ) : <View style={{ marginBottom: 12 }} />}
      </View>
    </View>
  );

  // 2. Themes & Bubbles Tab
  const renderAppearanceTab = () => {
    const activeSlot = getActiveSlot(deck);
    const smartColors = getSmartBubbleColors(activeSlot);
    return (
      <View>
        {/* SMART THEME-MATCHED WALLPAPER BANNER */}
        <View style={styles.smartMatchBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Palette size={18} color="#10b981" />
              <Text style={styles.smartMatchTitle}>🎨 Wallpaper-Matched Theme</Text>
            </View>
            <View style={styles.smartBadgePill}>
              <Text style={styles.smartBadgeText}>{activeSlot.name}</Text>
            </View>
          </View>
          
          <View style={styles.smartPreviewRow}>
            <View style={styles.smartPreviewBubbleCol}>
              <Text style={styles.smartPreviewLabel}>Sent Bubble</Text>
              <View style={[styles.smartColorSwatch, { backgroundColor: smartColors.sent }]}>
                <Text style={styles.smartSwatchHex}>{smartColors.sent}</Text>
              </View>
            </View>
            <View style={styles.smartPreviewBubbleCol}>
              <Text style={styles.smartPreviewLabel}>Received Bubble</Text>
              <View style={[styles.smartColorSwatch, { backgroundColor: smartColors.received }]}>
                <Text style={styles.smartSwatchHex}>{smartColors.received}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <Text style={{ color: theme.textMuted, fontSize: 12, flex: 1, marginRight: 10 }}>
              {autoMatchBubbles
                ? "✓ Auto-updating bubble colors whenever wallpaper changes"
                : "Manual bubble colors active"}
            </Text>
            <TouchableOpacity
              style={[styles.smallTogglePill, autoMatchBubbles && styles.smallTogglePillActive]}
              onPress={() => {
                const nextVal = !autoMatchBubbles;
                setAutoMatchBubbles(nextVal);
                if (nextVal) {
                  setBubbleColorSent(smartColors.sent);
                  setBubbleColorReceived(smartColors.received);
                }
              }}
            >
              <Text style={[styles.smallTogglePillText, autoMatchBubbles && { color: "#fff" }]}>
                {autoMatchBubbles ? "Auto-Match ON" : "Turn ON"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PERSONAL OVERRIDE TOGGLE */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.toggleLabel}>🔒 Personal Color Override</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
              Only apply custom colors to your screen (don't sync onto partner)
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, personalColorOverride && styles.toggleOn]}
            onPress={() => setPersonalColorOverride(!personalColorOverride)}
          >
            <View style={[styles.toggleThumb, personalColorOverride && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </View>

        {/* CURATED THEMES */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>✨ Quick Aesthetic Themes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          {THEMES.map((t) => (
            <TouchableOpacity key={t.name} style={styles.themeCard} onPress={() => applyTheme(t)}>
              <View style={styles.themePreview}>
                <View style={[styles.themeBubbleRight, { backgroundColor: t.sent }]} />
                <View style={[styles.themeBubbleLeft, { backgroundColor: t.received }]} />
              </View>
              <Text style={styles.themeLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SENT BUBBLE COLORS (EXPANDED PALETTE) */}
        <Text style={styles.sectionTitle}>💬 Sent Bubble Color ({BUBBLE_COLORS.length} options)</Text>
        <View style={styles.colorGrid}>
          {BUBBLE_COLORS.map((c) => (
            <TouchableOpacity
              key={c.color + c.label}
              onPress={() => {
                setBubbleColorSent(c.color);
                setAutoMatchBubbles(false);
              }}
              style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorSent === c.color && styles.colorSwatchSelected]}
              accessibilityLabel={c.label}
            />
          ))}
        </View>

        {/* RECEIVED BUBBLE COLORS */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>📩 Received Bubble Color</Text>
        <View style={styles.colorGrid}>
          {RECEIVED_COLORS.map((c) => (
            <TouchableOpacity
              key={c.color + c.label}
              onPress={() => {
                setBubbleColorReceived(c.color);
                setAutoMatchBubbles(false);
              }}
              style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorReceived === c.color && styles.colorSwatchSelected]}
              accessibilityLabel={c.label}
            />
          ))}
        </View>

        {/* GRADIENT */}
        <View style={[styles.toggleRow, { marginTop: 18 }]}>
          <Text style={styles.toggleLabel}>Gradient Bubbles</Text>
          <TouchableOpacity
            style={[styles.toggle, gradientEnabled && styles.toggleOn]}
            onPress={() => setGradientEnabled(!gradientEnabled)}
          >
            <View style={[styles.toggleThumb, gradientEnabled && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </View>
        {gradientEnabled && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Gradient End Color</Text>
            <View style={styles.colorGrid}>
              {BUBBLE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.color + c.label}
                  onPress={() => setGradientColor2(c.color)}
                  style={[styles.colorSwatch, { backgroundColor: c.color }, gradientColor2 === c.color && styles.colorSwatchSelected]}
                />
              ))}
            </View>
            <View style={[styles.gradientPreview, { borderRadius: shapeRadius }]}>
              <Text style={styles.gradientPreviewText}>Preview gradient →</Text>
            </View>
          </>
        )}

        {/* BUBBLE SHAPES */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>📐 Bubble Corner Shape</Text>
        <View style={styles.shapeRow}>
          {BUBBLE_SHAPES.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.shapeBtn, bubbleShape === s.value && styles.shapeBtnSelected]}
              onPress={() => setBubbleShape(s.value)}
            >
              <View style={[styles.shapePreviewBox, { borderRadius: s.radius, backgroundColor: theme.accent || "#5865F2" }]} />
              <Text style={[styles.shapeLabel, bubbleShape === s.value && { color: theme.text, fontWeight: "700" }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FONT FAMILY */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>🔤 Message Font Family</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {FONT_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.fontCard, fontFamily === f.value && styles.fontCardSelected]}
              onPress={() => setFontFamily(f.value)}
            >
              <Text style={[styles.fontCardSample, { fontFamily: f.value }]}>Aa</Text>
              <Text style={[styles.fontCardName, fontFamily === f.value && { color: theme.text, fontWeight: "700" }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // 3. Wallpaper Deck Tab (Multi-Group System)
  const renderWallpaperTab = () => {
    const smartColors = getSmartBubbleColors(selectedSlot);
    const isCurrentlyActive = selectedSlot.id === deck.activeSlotId;

    return (
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>🖼️ Wallpaper Collections (Shared)</Text>
          <View style={styles.syncBadge}>
            <Sparkles size={12} color="#10b981" />
            <Text style={styles.syncBadgeText}>Partner Sync Active</Text>
          </View>
        </View>

        <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
          Select a collection or create your own groups. Switching wallpapers smoothly updates both screens in real time.
        </Text>

        {/* 1. WALLPAPER GROUP SELECTOR PILLS */}
        <View style={styles.groupSelectorBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupScrollContent}>
            {(deck.groups || []).map((group) => {
              const isGroupActive = selectedGroupId === group.id;
              const hasActiveWallpaper = group.slots?.some(s => s.id === deck.activeSlotId);
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.groupPill, isGroupActive && styles.groupPillActive]}
                  onPress={() => handleSelectGroup(group.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupPillIcon}>{group.icon}</Text>
                  <Text style={[styles.groupPillName, isGroupActive && styles.groupPillNameActive]}>
                    {group.name}
                  </Text>
                  <View style={[styles.groupCountBadge, isGroupActive && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <Text style={[styles.groupCountText, isGroupActive && { color: "#fff" }]}>
                      {group.slots?.length || 0}
                    </Text>
                  </View>
                  {hasActiveWallpaper && <View style={styles.activePillDot} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.newGroupBtn}
              onPress={() => setNewGroupModalVisible(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={theme.textMuted} />
              <Text style={styles.newGroupBtnText}>New Collection</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 2. WALLPAPER CAROUSEL FOR SELECTED GROUP */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingHorizontal: 2 }}>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" }}>
              {activeGroup.name} ({activeGroup.slots?.length || 0} wallpapers)
            </Text>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              onPress={() => handleAddNewSlotToGroup(activeGroup.id)}
            >
              <Plus size={14} color={theme.accent || "#5865F2"} />
              <Text style={{ color: theme.accent || "#5865F2", fontSize: 12, fontWeight: "700" }}>Add Wallpaper</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {(activeGroup.slots || []).map((slot, idx) => {
              const isSelected = slot.id === selectedSlotId;
              const isActive = slot.id === deck.activeSlotId;
              const slotColors = getSmartBubbleColors(slot);

              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.deckSlotCard,
                    isSelected && styles.deckSlotCardSelected,
                  ]}
                  onPress={() => setSelectedSlotId(slot.id)}
                  activeOpacity={0.8}
                >
                  {slot.url ? (
                    <Image source={{ uri: slot.url }} style={styles.deckSlotThumb} />
                  ) : (
                    <View style={styles.deckSlotThumbEmpty}>
                      <ImageIcon size={24} color={theme.textMuted} />
                    </View>
                  )}

                  {/* Top status badges */}
                  <View style={styles.deckSlotHeader}>
                    <Text style={styles.deckSlotNumber}>#{idx + 1}</Text>
                    {isActive && (
                      <View style={styles.activeDotBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeDotText}>Active</Text>
                      </View>
                    )}
                  </View>

                  {/* Smart Bubble Colors Indicator */}
                  <View style={styles.deckSlotColorDots}>
                    <View style={[styles.deckSlotColorDot, { backgroundColor: slotColors.sent }]} />
                    <View style={[styles.deckSlotColorDot, { backgroundColor: slotColors.received }]} />
                  </View>

                  {/* Bottom slot name & mood pill */}
                  <View style={styles.deckSlotFooter}>
                    <Text style={styles.deckSlotName} numberOfLines={1}>{slot.name || `Photo ${idx + 1}`}</Text>
                    {slot.mood && slot.mood !== "none" && (
                      <Text style={styles.deckSlotMoodTag}>
                        {slot.mood === "love" ? "❤️ Love" : slot.mood === "night" ? "🌙 Night" : "☀️ Day"}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Quick Add Wallpaper Card */}
            <TouchableOpacity
              style={styles.addSlotCard}
              onPress={() => handleAddNewSlotToGroup(activeGroup.id)}
              activeOpacity={0.7}
            >
              <View style={styles.addSlotCircle}>
                <Plus size={20} color={theme.textMuted} />
              </View>
              <Text style={styles.addSlotText}>Add Photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 3. SELECTED WALLPAPER CUSTOMIZATION BOX */}
        <View style={styles.slotCustomizerBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.slotNumberTitle, { color: theme.text }]}>
                {selectedSlot.name || "Wallpaper Details"}
              </Text>
              {isCurrentlyActive ? (
                <View style={styles.currentActiveBadge}>
                  <Check size={12} color="#10b981" />
                  <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700" }}>Currently Active</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.setAsActiveBtn}
                  onPress={() => handleSetActiveSlot(selectedSlot.id)}
                >
                  <Text style={styles.setAsActiveBtnText}>Set Active</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Paired Smart Bubble Colors */}
          <View style={styles.matchedThemeBox}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.matchedThemeTitle}>🎨 Paired Bubble Colors</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={[styles.colorBubbleChip, { backgroundColor: smartColors.sent }]} />
                  <Text style={styles.colorBubbleChipText}>Sent</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={[styles.colorBubbleChip, { backgroundColor: smartColors.received }]} />
                  <Text style={styles.colorBubbleChipText}>Received</Text>
                </View>
              </View>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 11 }}>
              Activating this wallpaper automatically themes chat bubbles with complementary contrast.
            </Text>
          </View>

          {/* Editable Name */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sliderLabel}>Wallpaper Name</Text>
            <View style={styles.slotNameInputRow}>
              <Edit3 size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.alertInput, { flex: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                value={selectedSlot.name}
                onChangeText={(val) => updateSlot(selectedSlot.id, { name: val })}
                placeholder="Name this wallpaper"
                placeholderTextColor={theme.textMuted}
                maxLength={30}
              />
            </View>
          </View>

          {/* Mood Tag Selector */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sliderLabel}>Mood Trigger (Auto-Detect)</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["none", "love", "night", "day"] as MoodTriggerType[]).map((m) => {
                const isMoodSelected = selectedSlot.mood === m;
                const label = m === "none" ? "None" : m === "love" ? "❤️ Love" : m === "night" ? "🌙 Night" : "☀️ Day";
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.moodOptionPill,
                      isMoodSelected && styles.moodOptionPillSelected,
                    ]}
                    onPress={() => updateSlot(selectedSlot.id, { mood: m })}
                  >
                    <Text style={[styles.moodOptionText, isMoodSelected && { color: "#fff", fontWeight: "700" }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Slot Preview & Upload */}
          <View style={styles.wallpaperPreviewContainer}>
            {selectedSlot.url ? (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: selectedSlot.url }}
                  style={[styles.previewImage, { transform: [{ scale: selectedSlot.zoom }] }]}
                  blurRadius={selectedSlot.blur * 20}
                />
                <View style={[styles.dimOverlay, { backgroundColor: `rgba(0,0,0,${selectedSlot.dim})` }]} />
              </View>
            ) : (
              <View style={styles.emptyPreviewBox}>
                <ImageIcon size={44} color={theme.textMuted} />
                <Text style={styles.emptyText}>Empty Slot — Upload a Photo</Text>
              </View>
            )}
          </View>

          <View style={styles.wallpaperActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => pickImageForSlot(selectedSlot.id)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Upload size={18} color="#fff" />}
              <Text style={styles.actionBtnText}>{selectedSlot.url ? "Change Photo" : "Upload Photo"}</Text>
            </TouchableOpacity>
            {selectedSlot.url && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.removeBtn]}
                onPress={() => removeImageForSlot(selectedSlot.id)}
                disabled={loading}
              >
                <Trash2 size={18} color="#f23f43" />
                <Text style={[styles.actionBtnText, { color: "#f23f43" }]}>Clear Photo</Text>
              </TouchableOpacity>
            )}
            {!isCurrentlyActive && (activeGroup.slots?.length || 0) > 1 && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "rgba(244,63,94,0.08)", borderColor: "rgba(244,63,94,0.2)" }]}
                onPress={() => handleDeleteSlot(selectedSlot.id)}
              >
                <Trash2 size={16} color="#f43f5e" />
                <Text style={[styles.actionBtnText, { color: "#f43f5e" }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sliders if photo present */}
          {selectedSlot.url && (
            <View style={styles.slidersContainer}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Dim ({Math.round(selectedSlot.dim * 100)}%)</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={0.85}
                  value={selectedSlot.dim}
                  onValueChange={(val) => updateSlot(selectedSlot.id, { dim: val })}
                  minimumTrackTintColor={theme.accent || "#5865F2"}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.accent || "#5865F2"}
                />
              </View>

              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Blur ({Math.round(selectedSlot.blur * 100)}%)</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={selectedSlot.blur}
                  onValueChange={(val) => updateSlot(selectedSlot.id, { blur: val })}
                  minimumTrackTintColor={theme.accent || "#5865F2"}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.accent || "#5865F2"}
                />
              </View>

              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Zoom ({selectedSlot.zoom.toFixed(1)}x)</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={2}
                  value={selectedSlot.zoom}
                  onValueChange={(val) => updateSlot(selectedSlot.id, { zoom: val })}
                  minimumTrackTintColor={theme.accent || "#5865F2"}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.accent || "#5865F2"}
                />
              </View>
            </View>
          )}
        </View>

        {/* Session Auto-Rotate & Auto-Mood Automation */}
        <View style={styles.automationBox}>
          <Text style={styles.automationTitle}>⚡ Wallpaper Automations</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.toggleLabel}>Session Auto-Rotate</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Automatically rotate to next wallpaper on fresh chat sessions
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, deck.autoRotateEnabled && styles.toggleOn]}
              onPress={() => {
                setDeck(prev => {
                  const updatedDeck = { ...prev, autoRotateEnabled: !prev.autoRotateEnabled, updatedAt: Date.now(), updatedBy: userId };
                  saveDeckToLocal(chatId, updatedDeck);
                  persistDeckToCloud(chatId, userId, updatedDeck);
                  broadcastDeckUpdate(chatId, userId, updatedDeck);
                  return updatedDeck;
                });
              }}
            >
              <View style={[styles.toggleThumb, deck.autoRotateEnabled && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.toggleLabel}>Mood & Sleepy Byes Auto-Switch</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Automatically switch wallpaper during late nights or romantic messages
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, deck.autoMoodEnabled && styles.toggleOn]}
              onPress={() => {
                setDeck(prev => {
                  const updatedDeck = { ...prev, autoMoodEnabled: !prev.autoMoodEnabled, updatedAt: Date.now(), updatedBy: userId };
                  saveDeckToLocal(chatId, updatedDeck);
                  persistDeckToCloud(chatId, userId, updatedDeck);
                  broadcastDeckUpdate(chatId, userId, updatedDeck);
                  return updatedDeck;
                });
              }}
            >
              <View style={[styles.toggleThumb, deck.autoMoodEnabled && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // 4. Sounds & Send Button Icon Tab
  const renderSoundTab = () => (
    <View>
      <Text style={styles.sectionTitle}>🔔 Notification Sound Chime</Text>
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
        Choose a custom audio chime when messages arrive from your partner.
      </Text>

      <View style={{ gap: 8, marginBottom: 20 }}>
        {SOUND_PRESETS.map((preset) => {
          const isSelected = soundConfig.soundId === preset.id;
          const isPlaying = playingPresetId === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[styles.soundOptionCard, isSelected && styles.soundOptionCardSelected]}
              onPress={() => handleSelectSound(preset.id, preset.url)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={styles.soundPlayPreviewBtn}
                onPress={() => handleTestSound(preset.id, preset.url)}
              >
                {isPlaying ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.soundOptionName, isSelected && { color: theme.accent || "#5865F2", fontWeight: "700" }]}>
                  {preset.name}
                </Text>
                <Text style={styles.soundOptionDesc}>{preset.description}</Text>
              </View>
              {isSelected && <Check size={18} color={theme.accent || "#5865F2"} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
        <TouchableOpacity
          style={styles.uploadSoundBtn}
          onPress={handleUploadCustomChime}
          disabled={uploadingChime}
        >
          {uploadingChime ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Music size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Upload Custom Audio</Text>
            </>
          )}
        </TouchableOpacity>

        {soundConfig.soundId !== "discord_classic" && (
          <TouchableOpacity
            style={styles.resetSoundBtn}
            onPress={() => handleSelectSound("discord_classic")}
          >
            <RotateCcw size={14} color="#f43f5e" style={{ marginRight: 4 }} />
            <Text style={{ color: "#f43f5e", fontSize: 12, fontWeight: "600" }}>Reset Sound</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // 5. Danger Zone & Alerts Tab
  const renderDangerTab = () => (
    <View>
      {isFeatureEnabled("custom_alerts", activeProfile, activePublicFeatures) && (
        <View style={{ marginBottom: 28 }}>
          <Text style={styles.sectionTitle}>🚨 Custom Alerts</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
            Send an instant alert pop-up to online members of this chat.
          </Text>
          <TouchableOpacity
            style={styles.alertTriggerBtn}
            onPress={() => setAlertModalVisible(true)}
            activeOpacity={0.8}
          >
            <Bell size={18} color="#ffffff" />
            <Text style={styles.alertTriggerBtnText}>Create Custom Alert...</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: "#f43f5e" }]}>⚠️ Danger Zone</Text>
      <View style={{ padding: 16, backgroundColor: "rgba(244,63,94,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,63,94,0.25)", marginBottom: 16 }}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", marginBottom: 6 }}>
          Permanently Delete This Conversation
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16 }}>
          Deleting this chat will erase all messages, media links, and custom settings for everyone in this conversation. This action cannot be undone.
        </Text>
        <TouchableOpacity
          style={[styles.deleteBtn, { alignSelf: "flex-start", marginTop: 0 }]}
          onPress={handleDeleteChat}
          disabled={loading}
        >
          <AlertTriangle size={16} color="#f43f5e" style={{ marginRight: 6 }} />
          <Text style={styles.deleteBtnText}>Delete Chat Forever</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Sparkles size={20} color={theme.accent || "#5865F2"} />
              <Text style={styles.title}>Chat Customization</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {isDesktop ? (
            /* DESKTOP IPAD-STYLE HORIZONTAL SPLIT WITH VERTICAL TABS */
            <View style={styles.bodySplit}>
              {/* Left Sidebar Navigation */}
              <View style={styles.sidebar}>
                <View style={styles.tabList}>
                  {SETTINGS_TABS.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[styles.tabItem, isActive && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tabIconBox, isActive && styles.tabIconBoxActive]}>
                          <IconComponent size={16} color={isActive ? "#ffffff" : theme.textMuted} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.tabItemLabel, isActive && styles.tabItemLabelActive]}>
                            {tab.label}
                          </Text>
                          <Text style={[styles.tabItemSubtitle, isActive && styles.tabItemSubtitleActive]} numberOfLines={1}>
                            {tab.subtitle}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.sidebarFooter}>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Right Content Pane */}
              <View style={styles.rightContentArea}>
                <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                  {activeTab === "profile" && renderProfileTab()}
                  {activeTab === "appearance" && renderAppearanceTab()}
                  {activeTab === "wallpaper" && renderWallpaperTab()}
                  {activeTab === "sound" && renderSoundTab()}
                  {activeTab === "danger" && renderDangerTab()}
                  <View style={{ height: 40 }} />
                </ScrollView>

                <View style={styles.contentFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={{ color: theme.textMuted, fontWeight: "600", fontFamily: "Josefin Sans" }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { width: "auto", paddingHorizontal: 28 }]} onPress={saveSettings} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* MOBILE SINGLE-COLUMN VIEW WITH TOP TAB BAR */
            <View style={styles.mobileBody}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileTabBar}>
                {SETTINGS_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.mobileTabPill, isActive && styles.mobileTabPillActive]}
                      onPress={() => setActiveTab(tab.id)}
                    >
                      <Text style={[styles.mobileTabPillText, isActive && styles.mobileTabPillTextActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView style={styles.mobileScrollContent} showsVerticalScrollIndicator={false}>
                {activeTab === "profile" && renderProfileTab()}
                {activeTab === "appearance" && renderAppearanceTab()}
                {activeTab === "wallpaper" && renderWallpaperTab()}
                {activeTab === "sound" && renderSoundTab()}
                {activeTab === "danger" && renderDangerTab()}
                <View style={{ height: 40 }} />
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
                </TouchableOpacity>
                {activeTab === "danger" && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChat} disabled={loading}>
                    <AlertTriangle size={16} color="#f43f5e" style={{ marginRight: 6 }} />
                    <Text style={styles.deleteBtnText}>Delete Chat Forever</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* NEW COLLECTION MODAL POPUP */}
      <Modal visible={newGroupModalVisible} animationType="fade" transparent onRequestClose={() => setNewGroupModalVisible(false)}>
        <View style={styles.modalSubOverlay}>
          <View style={styles.modalSubContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>📁 New Wallpaper Collection</Text>
              <TouchableOpacity onPress={() => setNewGroupModalVisible(false)} style={styles.closeBtn}>
                <X size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
              Create a new category folder to organize wallpapers together with your chat partner.
            </Text>

            <View style={{ gap: 14, marginBottom: 20 }}>
              <View>
                <Text style={styles.sliderLabel}>Collection Name</Text>
                <TextInput
                  style={styles.alertInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="e.g. Travel & Trips, Favorite Memories"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
              </View>

              <View>
                <Text style={styles.sliderLabel}>Collection Icon Emoji</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["📁", "🏔️", "🌸", "🌙", "🌊", "✨", "💖", "☕"].map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiPickBtn,
                        newGroupIcon === emoji && styles.emojiPickBtnSelected,
                      ]}
                      onPress={() => setNewGroupIcon(emoji)}
                    >
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNewGroupModalVisible(false)}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { width: "auto", paddingHorizontal: 22 }]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={styles.saveBtnText}>Create Collection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CUSTOM ALERT MODAL POPUP */}
      <Modal visible={alertModalVisible} animationType="fade" transparent onRequestClose={() => setAlertModalVisible(false)}>
        <View style={styles.modalSubOverlay}>
          <View style={styles.modalSubContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>🚨 Send Custom Alert</Text>
              <TouchableOpacity onPress={() => setAlertModalVisible(false)} style={styles.closeBtn}>
                <X size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
              Pops up immediately on their screen if online. Limit 1 per minute.
            </Text>

            <View style={{ gap: 12, marginBottom: 20 }}>
              <View>
                <Text style={styles.sliderLabel}>Alert Title</Text>
                <TextInput
                  style={styles.alertInput}
                  value={alertTitle}
                  onChangeText={setAlertTitle}
                  placeholder="Alert Title (e.g. Important Notice)"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View>
                <Text style={styles.sliderLabel}>Alert Message</Text>
                <TextInput
                  style={[styles.alertInput, { height: 74, textAlignVertical: "top" }]}
                  multiline
                  value={alertMessage}
                  onChangeText={setAlertMessage}
                  placeholder="Alert Message (e.g. Server maintenance in 5 minutes)"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sliderLabel}>Action Button</Text>
                  <TextInput
                    style={styles.alertInput}
                    value={alertActionText}
                    onChangeText={setAlertActionText}
                    placeholder="e.g. OK"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sliderLabel}>Cancel Button</Text>
                  <TextInput
                    style={styles.alertInput}
                    value={alertCancelText}
                    onChangeText={setAlertCancelText}
                    placeholder="e.g. Dismiss"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAlertModalVisible(false)}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: "#f23f43", paddingHorizontal: 20 },
                  Date.now() - lastSentTime < 60000 && { opacity: 0.5 },
                ]}
                onPress={() => {
                  if (Date.now() - lastSentTime < 60000) {
                    alert(`Wait ${Math.ceil((60000 - (Date.now() - lastSentTime)) / 1000)}s before sending another.`);
                    return;
                  }
                  if (!alertTitle.trim() && !alertMessage.trim()) {
                    alert("Please enter a title or message for the alert.");
                    return;
                  }
                  if (onSendAlert) {
                    onSendAlert({
                      title: alertTitle.trim(),
                      message: alertMessage.trim(),
                      actionText: alertActionText.trim() || "OK",
                      cancelText: alertCancelText.trim() || "Dismiss",
                    });
                    setLastSentTime(Date.now());
                    setAlertModalVisible(false);
                    setAlertTitle("");
                    setAlertMessage("");
                    setAlertActionText("");
                    setAlertCancelText("");
                  }
                }}
              >
                <Text style={styles.saveBtnText}>Broadcast Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const createStyles = (theme: any, isDesktop: boolean = false) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: Platform.OS === "web" ? "rgba(0,0,0,0.48)" : "rgba(0,0,0,0.75)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      justifyContent: isDesktop ? "center" : "flex-end",
      alignItems: isDesktop ? "center" : "stretch",
      padding: isDesktop ? 20 : 0,
    } as any,
    container: {
      backgroundColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(22, 25, 32, 0.80)" : "rgba(255, 255, 255, 0.86)")
        : theme.surface,
      borderRadius: isDesktop ? 22 : 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: isDesktop ? 22 : 0,
      borderBottomRightRadius: isDesktop ? 22 : 0,
      height: isDesktop ? "86%" : "92%",
      maxHeight: isDesktop ? 760 : undefined,
      maxWidth: isDesktop ? 980 : Platform.OS === "web" ? 600 : ("100%" as any),
      width: "100%",
      alignSelf: "center",
      borderWidth: 1,
      borderColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)")
        : theme.border,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      backdropFilter: "blur(32px) saturate(190%)",
      WebkitBackdropFilter: "blur(32px) saturate(190%)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.5,
      shadowRadius: 32,
      elevation: 16,
    } as any,
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Platform.OS === "web" ? "rgba(255, 255, 255, 0.08)" : theme.border,
      backgroundColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(25, 28, 36, 0.65)" : "rgba(255, 255, 255, 0.75)")
        : theme.surface,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    } as any,
    title: { color: theme.text, fontSize: 18, fontWeight: "bold", fontFamily: "Josefin Sans" },
    closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
    bodySplit: {
      flex: 1,
      flexDirection: "row",
      overflow: "hidden",
    },
    sidebar: {
      width: 250,
      borderRightWidth: 1,
      borderRightColor: Platform.OS === "web" ? "rgba(255, 255, 255, 0.08)" : theme.border,
      backgroundColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(16, 18, 24, 0.52)" : "rgba(245, 247, 250, 0.6)")
        : theme.surface,
      padding: 12,
      justifyContent: "space-between",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
    } as any,
    tabList: {
      gap: 6,
    },
    tabItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      cursor: "pointer" as any,
    },
    tabItemActive: {
      backgroundColor: theme.accent || "#5865F2",
    },
    tabIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.06)",
      justifyContent: "center",
      alignItems: "center",
    },
    tabIconBoxActive: {
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    tabItemLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    tabItemLabelActive: {
      color: "#ffffff",
    },
    tabItemSubtitle: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    tabItemSubtitleActive: {
      color: "rgba(255,255,255,0.85)",
    },
    sidebarFooter: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
    },
    rightContentArea: {
      flex: 1,
      backgroundColor: Platform.OS === "web" ? "rgba(0, 0, 0, 0.06)" : theme.background,
      display: "flex",
      flexDirection: "column",
    } as any,
    contentScroll: {
      flex: 1,
      padding: 20,
    },
    contentFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
      backgroundColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(20, 22, 28, 0.7)" : "rgba(255, 255, 255, 0.75)")
        : theme.surface,
      gap: 12,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    } as any,
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    mobileBody: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
    mobileTabBar: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    mobileTabPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
    },
    mobileTabPillActive: {
      backgroundColor: theme.accent || "#5865F2",
    },
    mobileTabPillText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    mobileTabPillTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    mobileScrollContent: {
      flex: 1,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontFamily: "Josefin Sans",
    },
    syncBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 5,
    },
    syncBadgeText: { color: "#10b981", fontSize: 11, fontWeight: "700" },

    // Wallpaper Groups Selector
    groupSelectorBar: {
      marginBottom: 16,
    },
    groupScrollContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    groupPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.05)" : theme.surface,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
      gap: 6,
      cursor: "pointer" as any,
    },
    groupPillActive: {
      backgroundColor: theme.accent || "#5865F2",
      borderColor: theme.accent || "#5865F2",
    },
    groupPillIcon: {
      fontSize: 15,
    },
    groupPillName: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "600",
    },
    groupPillNameActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    groupCountBadge: {
      backgroundColor: "rgba(255,255,255,0.1)",
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
    },
    groupCountText: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: "700",
    },
    activePillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10b981",
    },
    newGroupBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      gap: 4,
      cursor: "pointer" as any,
    },
    newGroupBtnText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },

    // Deck Slots Carousel
    deckSlotCard: {
      width: 130,
      height: 180,
      borderRadius: 14,
      marginRight: 10,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
      position: "relative",
      cursor: "pointer" as any,
    },
    deckSlotCardSelected: {
      borderColor: theme.accent || "#5865F2",
      shadowColor: theme.accent || "#5865F2",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    deckSlotThumb: {
      width: "100%",
      height: "100%",
      position: "absolute",
      resizeMode: "cover",
    },
    deckSlotThumbEmpty: {
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    deckSlotHeader: {
      position: "absolute",
      top: 6,
      left: 6,
      right: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 2,
    },
    deckSlotNumber: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "800",
      backgroundColor: "rgba(0,0,0,0.65)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    activeDotBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#10b981",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      gap: 3,
    },
    activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffffff" },
    activeDotText: { color: "#ffffff", fontSize: 9, fontWeight: "800" },
    deckSlotColorDots: {
      position: "absolute",
      bottom: 40,
      right: 8,
      flexDirection: "row",
      gap: 3,
      backgroundColor: "rgba(0,0,0,0.65)",
      padding: 3,
      borderRadius: 8,
      zIndex: 2,
    },
    deckSlotColorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.4)",
    },
    deckSlotFooter: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.8)",
      padding: 8,
      zIndex: 2,
    },
    deckSlotName: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
    deckSlotMoodTag: { color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 2 },
    addSlotCard: {
      width: 100,
      height: 180,
      borderRadius: 14,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginRight: 10,
      cursor: "pointer" as any,
    },
    addSlotCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.06)",
      justifyContent: "center",
      alignItems: "center",
    },
    addSlotText: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },

    // Customizer Box
    slotCustomizerBox: {
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.04)" : theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
      padding: 16,
      marginBottom: 16,
    },
    slotNumberTitle: { fontSize: 16, fontWeight: "800", fontFamily: "Josefin Sans" },
    currentActiveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 4,
    },
    setAsActiveBtn: {
      backgroundColor: theme.accent || "#5865F2",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      cursor: "pointer" as any,
    },
    setAsActiveBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    matchedThemeBox: {
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.06)" : theme.border,
    },
    matchedThemeTitle: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
    },
    colorBubbleChip: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    colorBubbleChipText: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    slotNameInputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      marginTop: 4,
    },
    moodOptionPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      cursor: "pointer" as any,
    },
    moodOptionPillSelected: {
      backgroundColor: theme.accent || "#5865F2",
      borderColor: theme.accent || "#5865F2",
    },
    moodOptionText: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
    wallpaperPreviewContainer: {
      width: "100%",
      height: 180,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: "#000",
    },
    previewBox: { width: "100%", height: "100%", position: "relative" },
    previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
    dimOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    emptyPreviewBox: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      gap: 8,
    },
    emptyText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
    wallpaperActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
      cursor: "pointer" as any,
    },
    actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    removeBtn: {
      backgroundColor: "rgba(242, 63, 67, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(242, 63, 67, 0.3)",
    },
    slidersContainer: { gap: 12 },
    sliderRow: { gap: 4 },
    sliderLabel: { color: theme.textMuted, fontSize: 12, fontWeight: "700" },
    slider: { width: "100%", height: 36 },

    // Automation Box
    automationBox: {
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 20,
    },
    automationTitle: { color: theme.text, fontSize: 13, fontWeight: "700", marginBottom: 12 },

    // Smart Match Banner in Themes
    smartMatchBanner: {
      backgroundColor: Platform.OS === "web" ? "rgba(16, 185, 129, 0.08)" : theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.25)",
      padding: 16,
      marginBottom: 16,
    },
    smartMatchTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    smartBadgePill: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    smartBadgeText: {
      color: "#10b981",
      fontSize: 11,
      fontWeight: "700",
    },
    smartPreviewRow: {
      flexDirection: "row",
      gap: 12,
    },
    smartPreviewBubbleCol: {
      flex: 1,
      gap: 6,
    },
    smartPreviewLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    smartColorSwatch: {
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    smartSwatchHex: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    smallTogglePill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: theme.border,
      cursor: "pointer" as any,
    },
    smallTogglePillActive: {
      backgroundColor: "#10b981",
      borderColor: "#10b981",
    },
    smallTogglePillText: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },

    // Themes & Color Grids
    themeCard: {
      width: 100,
      marginRight: 10,
      alignItems: "center",
      cursor: "pointer" as any,
    },
    themePreview: {
      width: 80,
      height: 54,
      borderRadius: 12,
      backgroundColor: theme.surface,
      padding: 6,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "space-between",
      marginBottom: 6,
    },
    themeBubbleRight: {
      width: 44,
      height: 16,
      borderRadius: 8,
      alignSelf: "flex-end",
    },
    themeBubbleLeft: {
      width: 44,
      height: 16,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    themeLabel: {
      color: theme.text,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
    },
    colorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    colorSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: "transparent",
      cursor: "pointer" as any,
    },
    colorSwatchSelected: {
      borderColor: "#ffffff",
      transform: [{ scale: 1.15 }],
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    toggleLabel: { color: theme.text, fontSize: 14, fontWeight: "600" },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.border,
      padding: 2,
      cursor: "pointer" as any,
    },
    toggleOn: { backgroundColor: theme.accent || "#5865F2" },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#fff",
    },
    toggleThumbOn: { transform: [{ translateX: 20 }] },
    gradientPreview: {
      height: 48,
      backgroundColor: theme.accent || "#5865F2",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 14,
    },
    gradientPreviewText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    shapeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    shapeBtn: {
      flex: 1,
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.surface,
      gap: 6,
      cursor: "pointer" as any,
    },
    shapeBtnSelected: { borderColor: theme.accent || "#5865F2" },
    shapePreviewBox: { width: 36, height: 26 },
    shapeLabel: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
    fontCard: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 8,
      alignItems: "center",
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.surface,
      minWidth: 90,
      cursor: "pointer" as any,
    },
    fontCardSelected: { borderColor: theme.accent || "#5865F2", backgroundColor: "rgba(88,101,242,0.12)" },
    fontCardSample: { fontSize: 20, color: theme.text, marginBottom: 2 },
    fontCardName: { fontSize: 11, color: theme.textMuted },

    // Sounds
    soundOptionCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.surface,
      cursor: "pointer" as any,
    },
    soundOptionCardSelected: {
      borderColor: theme.accent || "#5865F2",
      backgroundColor: "rgba(88, 101, 242, 0.08)",
    },
    soundPlayPreviewBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent || "#5865F2",
      justifyContent: "center",
      alignItems: "center",
    },
    soundOptionName: { color: theme.text, fontSize: 13, fontWeight: "600" },
    soundOptionDesc: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
    uploadSoundBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      cursor: "pointer" as any,
    },
    resetSoundBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: "rgba(244,63,94,0.08)",
      borderWidth: 1,
      borderColor: "rgba(244,63,94,0.2)",
      cursor: "pointer" as any,
    },

    // Secret Profile Card
    sectionCard: {
      backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.03)" : theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.08)" : theme.border,
      padding: 16,
    },
    sectionCardTitle: { color: theme.text, fontSize: 14, fontWeight: "700", fontFamily: "Josefin Sans" },
    chatPfpRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    chatPfpAvatarWrapper: { position: "relative" },
    chatPfpAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: theme.border },
    defaultPfpBadge: {
      position: "absolute",
      bottom: -6,
      left: -6,
      right: -6,
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingVertical: 2,
      borderRadius: 6,
      alignItems: "center",
    },
    defaultPfpText: { color: "#fff", fontSize: 8, fontWeight: "700" },
    secretPfpBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.accent || "#5865F2",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      gap: 3,
    },
    secretPfpText: { color: "#fff", fontSize: 9, fontWeight: "700" },
    chatPfpActions: { flex: 1, gap: 8 },
    uploadChatPfpBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accent || "#5865F2",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      cursor: "pointer" as any,
    },
    uploadChatPfpText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    resetChatPfpBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      cursor: "pointer" as any,
    },
    resetChatPfpText: { color: "#f43f5e", fontSize: 12, fontWeight: "600" },

    // Custom Alert & Danger
    alertTriggerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      backgroundColor: "#f59e0b",
      borderRadius: 12,
      gap: 8,
      cursor: "pointer" as any,
    },
    alertTriggerBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(244,63,94,0.3)",
      backgroundColor: "rgba(244,63,94,0.1)",
      cursor: "pointer" as any,
    },
    deleteBtnText: { color: "#f43f5e", fontSize: 13, fontWeight: "700" },
    alertInput: {
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      outlineStyle: "none" as any,
    },
    saveBtn: {
      width: "100%",
      backgroundColor: "#22c55e",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      cursor: "pointer" as any,
    },
    saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
      gap: 10,
    },

    // Sub Modal overlays
    modalSubOverlay: {
      flex: 1,
      backgroundColor: Platform.OS === "web" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.8)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    } as any,
    modalSubContainer: {
      width: "100%",
      maxWidth: 480,
      backgroundColor: Platform.OS === "web"
        ? (theme.dark ? "rgba(28, 30, 38, 0.9)" : "rgba(255, 255, 255, 0.95)")
        : theme.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: Platform.OS === "web" ? "rgba(255,255,255,0.12)" : theme.border,
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.5,
      shadowRadius: 30,
      elevation: 20,
    } as any,
    modalCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      cursor: "pointer" as any,
    },
    emojiPickBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer" as any,
    },
    emojiPickBtnSelected: {
      borderColor: theme.accent || "#5865F2",
      backgroundColor: "rgba(88,101,242,0.15)",
    },
  });
