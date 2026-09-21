import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Image, ScrollView, Platform, TextInput } from "react-native";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import { X, Upload, Trash2, Image as ImageIcon, AlertTriangle, Bell, Sparkles, Heart, Moon, Sun, Check, RefreshCw, Layers, Edit3 } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadImageToR2, deleteFileFromR2ByUrl } from "../lib/r2";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import { isFeatureEnabled, UserProfile } from "../lib/features";
import { useTheme } from "../context/ThemeContext";
import {
  WallpaperSlot,
  WallpaperDeckConfig,
  DEFAULT_SLOTS,
  createDefaultDeck,
  loadDeckFromLocal,
  saveDeckToLocal,
  fetchDeckFromCloud,
  persistDeckToCloud,
  broadcastDeckUpdate,
  getActiveSlot,
  MoodTriggerType,
} from "../utils/wallpaperDeck";

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
  { label: "Indigo", color: "#5865F2" },
  { label: "Rose", color: "#f43f5e" },
  { label: "Blush", color: "#fb7185" },
  { label: "Coral", color: "#fb923c" },
  { label: "Peach", color: "#fbbf24" },
  { label: "Mint", color: "#34d399" },
  { label: "Sky", color: "#38bdf8" },
  { label: "Lavender", color: "#a78bfa" },
  { label: "Lilac", color: "#c084fc" },
  { label: "Mauve", color: "#e879f9" },
];

const RECEIVED_COLORS = [
  { label: "Charcoal", color: "#2b2d31" },
  { label: "Slate", color: "#374151" },
  { label: "Navy", color: "#1e3a5f" },
  { label: "Plum", color: "#3b1f4f" },
  { label: "Forest", color: "#14532d" },
  { label: "Stone", color: "#44403c" },
  { label: "Blush", color: "#881337" },
  { label: "Ocean", color: "#164e63" },
];

const BUBBLE_SHAPES = [
  { label: "Round", value: "round", radius: 18 },
  { label: "Soft", value: "soft", radius: 10 },
  { label: "Sharp", value: "sharp", radius: 4 },
];

const THEMES = [
  { label: "🌸 Cherry Blossom", name: "cherry", sent: "#f4a5c0", received: "#3b1f30", bg: "#1a0a14" },
  { label: "🌙 Midnight", name: "midnight", sent: "#7c3aed", received: "#1e1b4b", bg: "#0f0a1e" },
  { label: "🍭 Cotton Candy", name: "candy", sent: "#f472b6", received: "#312e81", bg: "#1e1027" },
  { label: "🌿 Garden", name: "garden", sent: "#34d399", received: "#14532d", bg: "#052e16" },
  { label: "🌊 Ocean", name: "ocean", sent: "#38bdf8", received: "#164e63", bg: "#0c1a2e" },
  { label: "🦇 Noir", name: "noir", sent: "#d4af37", received: "#1c1c1c", bg: "#0a0a0a" },
];

const DOODLE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "✨ Sparkles", value: "sparkles" },
  { label: "💕 Hearts", value: "hearts" },
  { label: "⭐ Stars", value: "stars" },
  { label: "❄️ Snow", value: "snow" },
  { label: "🌸 Petals", value: "petals" },
];

const SEND_EMOJI_PRESETS = [
  { label: "Default", emoji: "" },
  { label: "🚀 Rocket", emoji: "🚀" },
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
  { label: "System", value: "system" },
  { label: "BenchNine", value: "BenchNine" },
  { label: "Playwrite BR", value: "Playwrite BR" },
  { label: "Playwrite DE LA", value: "Playwrite DE LA" },
  { label: "Handjet", value: "Handjet" },
  { label: "Rum Raisin", value: "Rum Raisin" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Raleway", value: "Raleway" },
  { label: "Outfit", value: "Outfit" },
  { label: "Elsie", value: "Elsie" },
  { label: "Lobster Two", value: "Lobster Two" },
  { label: "Josefin Sans", value: "Josefin Sans" },
  { label: "Changa One", value: "Changa One" },
  { label: "Caveat", value: "Caveat" },
  { label: "Cinzel", value: "Cinzel" },
  { label: "Concert One", value: "Concert One" },
  { label: "Nothing You Could Do", value: "Nothing You Could Do" },
  { label: "Chewy", value: "Chewy" },
  { label: "La Belle Aurore", value: "La Belle Aurore" },
  { label: "Balsamiq Sans", value: "Balsamiq Sans" },
  { label: "Sacramento", value: "Sacramento" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Parisienne", value: "Parisienne" },
  { label: "Alex Brush", value: "Alex Brush" },
  { label: "Comfortaa", value: "Comfortaa" },
  { label: "Sniglet", value: "Sniglet" },
  { label: "DynaPuff", value: "DynaPuff" },
  { label: "Patrick Hand", value: "Patrick Hand" },
  { label: "Cormorant", value: "Cormorant Garamond" },
  { label: "DM Serif", value: "DM Serif Display" },
  { label: "Space Grotesk", value: "Space Grotesk" },
  { label: "Silkscreen", value: "Silkscreen" },
];

interface ChatSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  targetUser?: any;
  currentSettings: any;
  onSettingsSaved: (newSettings: any) => void;
  onSendAlert?: (alert: { title: string; message: string; actionText: string; cancelText: string }) => void;
  myProfile?: UserProfile | null;
  publicFeatures?: string[];
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
}: ChatSettingsModalProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<WallpaperDeckConfig>(() => createDefaultDeck(currentSettings?.wallpaper_url, userId));
  const [selectedSlotId, setSelectedSlotId] = useState<string>("slot_1");
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

  useEffect(() => {
    if (!visible || !chatId || !userId) return;

    let syncChannel: any = null;
    if (userId && (myProfileProp === undefined || publicFeaturesProp === undefined)) {
      supabase.from("profiles").select("*").eq("id", userId).single().then(({ data }) => {
        if (data) setInternalProfile(data);
      });
      supabase.from("app_settings").select("value").eq("key", "public_features").single().then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) setInternalPublicFeatures(data.value);
      });

      syncChannel = supabase.channel("app_settings_sync");
      syncChannel
        .on("broadcast", { event: "settings_updated" }, (payload: any) => {
          if (payload.payload?.publicFeatures) {
            setInternalPublicFeatures(payload.payload.publicFeatures);
          }
          if (payload.payload?.userId === userId && payload.payload?.awardedFeatures) {
            setInternalProfile((prev: any) => ({ ...prev, awarded_features: payload.payload.awardedFeatures }));
          }
        })
        .subscribe();
    }

    if (targetUser) {
      setPartnerUser(targetUser);
      setPartnerNickname(targetUser.nickname || currentSettings?.nickname || "");
    }

    // Fetch nickname I set for my partner from my own participant row
    supabase.from("chat_participants")
      .select("nickname")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data && data.nickname) {
          setPartnerNickname(data.nickname);
        }
      });

    // Fetch nickname my partner set for ME from partner's participant row
    supabase.from("chat_participants")
      .select("user_id, nickname")
      .eq("chat_id", chatId)
      .neq("user_id", userId)
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          setPartnerUser((prev: any) => ({ ...prev, ...data[0] }));
          if (data[0].nickname) {
            setMyNicknameFromPartner(data[0].nickname);
          }
        }
      });

    return () => {
      if (syncChannel) {
        try { supabase.removeChannel(syncChannel); } catch (e) {}
      }
    };
  }, [visible, userId, chatId, targetUser]);

  useEffect(() => {
    if (visible && currentSettings) {
      setWallpaperUrl(currentSettings.wallpaper_url || null);
      setDim(currentSettings.wallpaper_dim || 0);
      setBlur(currentSettings.wallpaper_blur || 0);
      setZoom(currentSettings.wallpaper_zoom || 1);
      setFontFamily(currentSettings.font_family || "system");
      setBubbleColorSent(currentSettings.bubble_color_sent || "#5865F2");
      setBubbleColorReceived(currentSettings.bubble_color_received || "#2b2d31");
      setBubbleShape(currentSettings.bubble_shape || "round");
      setGradientEnabled(currentSettings.bubble_gradient_enabled || false);
      setGradientColor2(currentSettings.bubble_gradient_color2 || "#a78bfa");
      setWallpaperDoodle(currentSettings.wallpaper_doodle || "none");
      setAnniversaryDate(currentSettings.anniversary_date || null);
      setSendButtonEmoji(currentSettings.send_button_emoji || "");
      if (currentSettings.nickname || currentSettings.partner_nickname) {
        setPartnerNickname(currentSettings.nickname || currentSettings.partner_nickname);
      }

      // Load wallpaper deck from local cache and cloud
      if (chatId) {
        loadDeckFromLocal(chatId).then(localDeck => {
          if (localDeck) {
            setDeck(localDeck);
            setSelectedSlotId(localDeck.activeSlotId || "slot_1");
            const active = getActiveSlot(localDeck);
            if (active.url) {
              setWallpaperUrl(active.url);
              setDim(active.dim);
              setBlur(active.blur);
              setZoom(active.zoom);
            }
          }
        });
        fetchDeckFromCloud(chatId).then(cloudDeck => {
          if (cloudDeck) {
            setDeck(cloudDeck);
            setSelectedSlotId(cloudDeck.activeSlotId || "slot_1");
            saveDeckToLocal(chatId, cloudDeck);
            const active = getActiveSlot(cloudDeck);
            if (active.url) {
              setWallpaperUrl(active.url);
              setDim(active.dim);
              setBlur(active.blur);
              setZoom(active.zoom);
            }
          }
        });
      }
    }
  }, [visible, currentSettings, chatId]);

  const applyTheme = useCallback((selectedTheme: typeof THEMES[0]) => {
    setBubbleColorSent(selectedTheme.sent);
    setBubbleColorReceived(selectedTheme.received);
    setGradientEnabled(false);
  }, []);

  const selectedSlot = useMemo(() => {
    return deck.slots.find(s => s.id === selectedSlotId) || deck.slots[0];
  }, [deck.slots, selectedSlotId]);

  const updateSlot = useCallback((slotId: string, patch: Partial<WallpaperSlot>) => {
    setDeck(prev => {
      const newSlots = prev.slots.map(s => s.id === slotId ? { ...s, ...patch } : s);
      const isCurrentActive = prev.activeSlotId === slotId;
      const updatedDeck = { ...prev, slots: newSlots, updatedAt: Date.now(), updatedBy: userId };
      if (isCurrentActive) {
        if (patch.url !== undefined) setWallpaperUrl(patch.url);
        if (patch.dim !== undefined) setDim(patch.dim);
        if (patch.blur !== undefined) setBlur(patch.blur);
        if (patch.zoom !== undefined) setZoom(patch.zoom);
        // Instant broadcast for partner
        broadcastDeckUpdate(chatId, userId, updatedDeck);
      }
      saveDeckToLocal(chatId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const handleSelectSlot = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
  }, []);

  const handleSetActiveSlot = useCallback((slotId: string) => {
    setDeck(prev => {
      const slot = prev.slots.find(s => s.id === slotId) || prev.slots[0];
      const updatedDeck = { ...prev, activeSlotId: slotId, updatedAt: Date.now(), updatedBy: userId };
      setWallpaperUrl(slot.url);
      setDim(slot.dim);
      setBlur(slot.blur);
      setZoom(slot.zoom);
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

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
          const updatedSlots = prev.slots.map(s => s.id === slotId ? { ...s, url } : s);
          const isCurrentActive = prev.activeSlotId === slotId;
          const updatedDeck = { ...prev, slots: updatedSlots, updatedAt: Date.now(), updatedBy: userId };
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
      const updatedSlots = prev.slots.map(s => s.id === slotId ? { ...s, url: null } : s);
      const isCurrentActive = prev.activeSlotId === slotId;
      const updatedDeck = { ...prev, slots: updatedSlots, updatedAt: Date.now(), updatedBy: userId };
      if (isCurrentActive) {
        setWallpaperUrl(null);
      }
      saveDeckToLocal(chatId, updatedDeck);
      persistDeckToCloud(chatId, userId, updatedDeck);
      broadcastDeckUpdate(chatId, userId, updatedDeck);
      return updatedDeck;
    });
  }, [chatId, userId]);

  const saveSettings = async () => {
    setLoading(true);
    try {
      const newNick = partnerNickname.trim() || null;
      const activeSlot = getActiveSlot(deck);
      const updates: any = {
        wallpaper_url: activeSlot.url,
        wallpaper_dim: activeSlot.dim,
        wallpaper_blur: activeSlot.blur,
        wallpaper_zoom: activeSlot.zoom,
        font_family: fontFamily,
        bubble_color_sent: bubbleColorSent,
        bubble_color_received: bubbleColorReceived,
        bubble_shape: bubbleShape,
        bubble_gradient_enabled: gradientEnabled,
        bubble_gradient_color2: gradientColor2,
        wallpaper_doodle: wallpaperDoodle,
        anniversary_date: anniversaryDate,
        send_button_emoji: sendButtonEmoji || "",
        nickname: newNick,
      };

      try {
        const cached = await AsyncStorage.getItem(`chat_${chatId}_settings`);
        const merged = { ...(cached ? JSON.parse(cached) : {}), ...updates };
        await AsyncStorage.setItem(`chat_${chatId}_settings`, JSON.stringify(merged));
      } catch (e) {}

      // Persist full deck and notify partner
      await saveDeckToLocal(chatId, deck);
      await persistDeckToCloud(chatId, userId, deck);
      broadcastDeckUpdate(chatId, userId, deck);

      try {
        const { error } = await supabase.from("chat_participants").update(updates).eq("chat_id", chatId).eq("user_id", userId);
        if (error) {
          const { send_button_emoji, ...restUpdates } = updates;
          await supabase.from("chat_participants").update(restUpdates).eq("chat_id", chatId).eq("user_id", userId);
        }
      } catch (e) {
        console.error(e);
      }

      onSettingsSaved(updates);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDeleteChat = async () => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm("Are you sure you want to delete this chat forever? This removes all messages, media, and history for BOTH people. This cannot be undone.");
      if (!confirmDelete) return;
    }
    
    setLoading(true);
    try {
      const { data: images } = await supabase.from("messages").select("content").eq("chat_id", chatId).eq("type", "image");
      if (images && images.length > 0) {
        for (const msg of images) {
          if (msg.content) await deleteFileFromR2ByUrl(msg.content);
        }
      }

      const { error } = await supabase.rpc("delete_chat_completely", { p_chat_id: chatId });
      if (error) {
        console.error("RPC failed, falling back to manual delete", error);
        await supabase.from("messages").delete().eq("chat_id", chatId);
        await supabase.from("chat_participants").delete().eq("chat_id", chatId);
        await supabase.from("chats").delete().eq("id", chatId);
      }

      onClose();
      router.replace("/(tabs)");
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') alert("Failed to delete chat completely.");
    } finally {
      setLoading(false);
    }
  };

  const shapeRadius = BUBBLE_SHAPES.find(s => s.value === bubbleShape)?.radius ?? 18;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chat Customization</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* PARTNER NICKNAME SECTION */}
            <Text style={styles.sectionTitle}>🏷️ Chat Partner Nickname</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8 }}>
              Set a custom nickname for {partnerUser?.profiles?.username ? `@${partnerUser.profiles.username}` : "your chat partner"}.
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                fontSize: 15,
                marginBottom: 12,
              }}
              placeholder={`Nickname for ${partnerUser?.profiles?.username || "partner"}`}
              placeholderTextColor={theme.textMuted}
              value={partnerNickname}
              onChangeText={setPartnerNickname}
            />

            {myNicknameFromPartner ? (
              <View style={{ backgroundColor: "rgba(88,101,242,0.15)", borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: "rgba(88,101,242,0.3)" }}>
                <Text style={{ color: theme.accent || "#5865F2", fontSize: 13, fontWeight: "600" }}>
                  ✨ {partnerUser?.profiles?.username || "Partner"} set your nickname to: "{myNicknameFromPartner}"
                </Text>
              </View>
            ) : <View style={{ marginBottom: 12 }} />}
            <Text style={styles.sectionTitle}>✨ Themes</Text>
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

            {/* BUBBLE COLORS */}
            <Text style={styles.sectionTitle}>💬 Sent Bubble Color</Text>
            <View style={styles.colorGrid}>
              {BUBBLE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.color}
                  onPress={() => setBubbleColorSent(c.color)}
                  style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorSent === c.color && styles.colorSwatchSelected]}
                />
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>📩 Received Bubble Color</Text>
            <View style={styles.colorGrid}>
              {RECEIVED_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.color}
                  onPress={() => setBubbleColorReceived(c.color)}
                  style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorReceived === c.color && styles.colorSwatchSelected]}
                />
              ))}
            </View>

            {/* GRADIENT */}
            <View style={styles.toggleRow}>
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
                      key={c.color}
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

            {/* BUBBLE SHAPE */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🫧 Bubble Shape</Text>
            <View style={styles.shapeRow}>
              {BUBBLE_SHAPES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.shapeOption, bubbleShape === s.value && styles.shapeOptionSelected]}
                  onPress={() => setBubbleShape(s.value)}
                >
                  <View style={[styles.shapeSampleBubble, { borderRadius: s.radius, backgroundColor: bubbleColorSent }]} />
                  <Text style={[styles.shapeLabel, bubbleShape === s.value && { color: theme.text }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* FONTS */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🔤 Font Style</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {FONT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.shapeOption, { width: 100, marginRight: 8, paddingVertical: 10 }, fontFamily === opt.value && styles.shapeOptionSelected]}
                  onPress={() => setFontFamily(opt.value)}
                >
                  <Text
                    style={[
                      styles.shapeLabel,
                      { fontFamily: opt.value === "system" ? undefined : opt.value },
                      fontFamily === opt.value && { color: theme.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* WALLPAPER DECK & SHARED SLOTS */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>🖼️ Wallpaper Deck (Shared)</Text>
              <View style={styles.syncBadge}>
                <Sparkles size={12} color="#10b981" />
                <Text style={styles.syncBadgeText}>Partner Sync Active</Text>
              </View>
            </View>

            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
              5 shared themed slots. Name your themes and customize wallpapers together in real time.
            </Text>

            {/* Horizontal Deck Slots Carousel */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {deck.slots.map((slot, idx) => {
                const isSelected = slot.id === selectedSlotId;
                const isActive = slot.id === deck.activeSlotId;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.deckSlotCard,
                      isSelected && styles.deckSlotCardSelected,
                    ]}
                    onPress={() => handleSelectSlot(slot.id)}
                    activeOpacity={0.8}
                  >
                    {slot.url ? (
                      <Image source={{ uri: slot.url }} style={styles.deckSlotThumb} />
                    ) : (
                      <View style={styles.deckSlotThumbEmpty}>
                        <ImageIcon size={22} color={theme.textMuted} />
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

                    {/* Bottom slot name & mood pill */}
                    <View style={styles.deckSlotFooter}>
                      <Text style={styles.deckSlotName} numberOfLines={1}>{slot.name || `Slot ${idx + 1}`}</Text>
                      {slot.mood && slot.mood !== "none" && (
                        <Text style={styles.deckSlotMoodTag}>
                          {slot.mood === "love" ? "❤️ Love" : slot.mood === "night" ? "🌙 Night" : "☀️ Day"}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Slot Customization Box */}
            <View style={styles.slotCustomizerBox}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.slotNumberTitle, { color: theme.text }]}>
                    Slot #{deck.slots.findIndex(s => s.id === selectedSlotId) + 1}
                  </Text>
                  {selectedSlot.id === deck.activeSlotId ? (
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

              {/* Editable Name */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.sliderLabel}>Theme / Slot Name (Shared)</Text>
                <View style={styles.slotNameInputRow}>
                  <Edit3 size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.alertInput, { flex: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                    value={selectedSlot.name}
                    onChangeText={(val) => updateSlot(selectedSlot.id, { name: val })}
                    placeholder="Give this wallpaper theme a name"
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
                    <Text style={[styles.actionBtnText, { color: "#f23f43" }]}>Clear Slot</Text>
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
                      minimumTrackTintColor={theme.accent}
                      maximumTrackTintColor={theme.border}
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
                      minimumTrackTintColor={theme.accent}
                      maximumTrackTintColor={theme.border}
                    />
                  </View>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>Zoom ({selectedSlot.zoom.toFixed(1)}x)</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={1}
                      maximumValue={2.5}
                      value={selectedSlot.zoom}
                      onValueChange={(val) => updateSlot(selectedSlot.id, { zoom: val })}
                      minimumTrackTintColor={theme.accent}
                      maximumTrackTintColor={theme.border}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Smart Auto-Change Toggles */}
            <View style={styles.smartOptionsContainer}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.toggleLabel}>Auto-Mood Dynamic Wallpaper</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                    Shifts to Romantic slot when sweet messages are sent, and Night slot late at night.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, deck.autoMoodEnabled && styles.toggleOn]}
                  onPress={() => {
                    const newAuto = !deck.autoMoodEnabled;
                    setDeck(prev => {
                      const updated = { ...prev, autoMoodEnabled: newAuto, updatedAt: Date.now(), updatedBy: userId };
                      saveDeckToLocal(chatId, updated);
                      persistDeckToCloud(chatId, userId, updated);
                      broadcastDeckUpdate(chatId, userId, updated);
                      return updated;
                    });
                  }}
                >
                  <View style={[styles.toggleThumb, deck.autoMoodEnabled && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.toggleLabel}>Rotate Each Chat Visit</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                    Cycles to your next named slot whenever you enter the chat for a fresh aesthetic.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, deck.autoRotateEnabled && styles.toggleOn]}
                  onPress={() => {
                    const newRotate = !deck.autoRotateEnabled;
                    setDeck(prev => {
                      const updated = { ...prev, autoRotateEnabled: newRotate, updatedAt: Date.now(), updatedBy: userId };
                      saveDeckToLocal(chatId, updated);
                      persistDeckToCloud(chatId, userId, updated);
                      broadcastDeckUpdate(chatId, userId, updated);
                      return updated;
                    });
                  }}
                >
                  <View style={[styles.toggleThumb, deck.autoRotateEnabled && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            </View>
            
            {isFeatureEnabled("wallpapers", activeProfile, activePublicFeatures) && (
              <>
                <Text style={[styles.sliderLabel, { marginBottom: 12 }]}>Doodle Overlay</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {DOODLE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.shapeOption, { width: 80, marginRight: 8, paddingVertical: 10 }, wallpaperDoodle === opt.value && styles.shapeOptionSelected]}
                      onPress={() => setWallpaperDoodle(opt.value)}
                    >
                      <Text style={[styles.shapeLabel, wallpaperDoodle === opt.value && { color: theme.text }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* CHAT PARTNER NICKNAME */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🏷️ Chat Partner Nickname</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 10 }}>
              Set a custom nickname for {partnerUser?.display_name || partnerUser?.username || "your chat partner"}. Only visible to you.
            </Text>
            <TextInput
              style={[styles.alertInput, { fontSize: 15, paddingVertical: 10, paddingHorizontal: 14 }]}
              value={partnerNickname}
              onChangeText={setPartnerNickname}
              placeholder={`Nickname for ${partnerUser?.display_name || partnerUser?.username || "partner"}`}
              placeholderTextColor={theme.textMuted}
              maxLength={30}
            />
            {myNicknameFromPartner ? (
              <View style={{ marginTop: 8, padding: 10, backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                <Text style={{ color: theme.accent || "#5865F2", fontSize: 12, fontWeight: "600" }}>
                  💡 {partnerUser?.display_name || partnerUser?.username || "Partner"} set your nickname to: "{myNicknameFromPartner}"
                </Text>
              </View>
            ) : null}

            {/* SEND BUTTON ICON / EMOJI */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🚀 Send Button Icon</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
              Replace your send arrow button with a custom emoji icon for this chat.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {SEND_EMOJI_PRESETS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.shapeOption,
                    { minWidth: 62, marginRight: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center" },
                    sendButtonEmoji === item.emoji && styles.shapeOptionSelected,
                  ]}
                  onPress={() => setSendButtonEmoji(item.emoji)}
                >
                  <Text style={{ fontSize: item.emoji ? 20 : 16 }}>{item.emoji || "➤"}</Text>
                  <Text
                    style={[
                      styles.shapeLabel,
                      { fontSize: 11, marginTop: 4 },
                      sendButtonEmoji === item.emoji && { color: theme.accent, fontWeight: "bold" },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontSize: 13 }}>Or type custom emoji:</Text>
              <TextInput
                style={[styles.alertInput, { width: 70, textAlign: "center", fontSize: 18, paddingVertical: 6 }]}
                value={sendButtonEmoji}
                onChangeText={setSendButtonEmoji}
                placeholder="🛸"
                placeholderTextColor={theme.textMuted}
                maxLength={4}
              />
              {sendButtonEmoji ? (
                <TouchableOpacity onPress={() => setSendButtonEmoji("")} style={{ padding: 6 }}>
                  <Text style={{ color: "#f43f5e", fontSize: 12, fontWeight: "600" }}>Reset to Arrow</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* CUSTOM ALERT TRIGGER BUTTON */}
            {isFeatureEnabled("custom_alerts", activeProfile, activePublicFeatures) && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🚨 Custom Alerts</Text>
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
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChat} disabled={loading}>
              <AlertTriangle size={16} color="#f43f5e" style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Delete Chat Forever</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
                      title: alertTitle.trim() || "ALERT",
                      message: alertMessage.trim(),
                      actionText: alertActionText.trim() || "OK",
                      cancelText: alertCancelText.trim() || "Dismiss",
                    });
                    setLastSentTime(Date.now());
                    alert("Alert broadcasted!");
                    setAlertModalVisible(false);
                  }
                }}
              >
                <Text style={styles.saveBtnText}>Broadcast Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      height: "90%",
      maxWidth: Platform.OS === "web" ? 600 : ("100%" as any),
      width: "100%",
      alignSelf: "center",
      borderWidth: theme.id === "black" ? 0 : 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { color: theme.text, fontSize: 20, fontWeight: "bold", fontFamily: "Josefin Sans" },
    closeBtn: { padding: 4 },
    content: { padding: 20 },
    alertInput: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: "Josefin Sans",
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      marginBottom: 14,
      letterSpacing: 0.5,
      fontFamily: "Josefin Sans",
    },
    themeCard: { alignItems: "center", marginRight: 16, width: 80 },
    themePreview: {
      width: 80,
      height: 56,
      backgroundColor: theme.background,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      padding: 8,
      gap: 4,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    themeBubbleRight: { alignSelf: "flex-end", width: 48, height: 14, borderRadius: 8 },
    themeBubbleLeft: { alignSelf: "flex-start", width: 36, height: 14, borderRadius: 8 },
    themeLabel: { color: theme.textMuted, fontSize: 11, textAlign: "center", fontFamily: "Josefin Sans" },
    colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
    colorSwatch: { width: 36, height: 36, borderRadius: 18 },
    colorSwatchSelected: { borderWidth: 3, borderColor: theme.text },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 16 },
    toggleLabel: { color: theme.text, fontSize: 15, fontWeight: "600", fontFamily: "Josefin Sans" },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: theme.border, justifyContent: "center", paddingHorizontal: 3 },
    toggleOn: { backgroundColor: theme.accent },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
    toggleThumbOn: { alignSelf: "flex-end" },
    gradientPreview: { height: 40, marginBottom: 16, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
    gradientPreviewText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Josefin Sans" },
    shapeRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
    shapeOption: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      backgroundColor: theme.background,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
    },
    shapeOptionSelected: { borderColor: theme.accent, backgroundColor: theme.border },
    shapeSampleBubble: { width: 48, height: 20, marginBottom: 8 },
    shapeLabel: { color: theme.textMuted, fontSize: 13, fontFamily: "Josefin Sans" },
    wallpaperPreviewContainer: { height: 160, borderRadius: 8, overflow: "hidden", backgroundColor: theme.background, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
    previewBox: { flex: 1, width: "100%", height: "100%" },
    previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
    dimOverlay: { ...StyleSheet.absoluteFill },
    emptyPreviewBox: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyText: { color: theme.textMuted, marginTop: 8, fontSize: 14, fontFamily: "Josefin Sans" },
    wallpaperActions: { flexDirection: "row", gap: 12, marginBottom: 20 },
    actionBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 6,
      gap: 8,
    },
    removeBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#f23f43" },
    actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 15, fontFamily: "Josefin Sans" },
    slidersContainer: { backgroundColor: theme.background, borderRadius: 8, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.border },
    sliderRow: { marginBottom: 16 },
    sliderLabel: { color: theme.text, fontSize: 14, marginBottom: 8, fontFamily: "Josefin Sans" },
    slider: { width: "100%", height: 40 },
    fontOptions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    fontOption: { backgroundColor: theme.background, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, borderColor: theme.border },
    fontOptionSelected: { borderColor: theme.accent, backgroundColor: theme.border },
    fontOptionText: { color: theme.textMuted, fontSize: 16 },
    fontOptionTextSelected: { color: theme.text, fontWeight: "bold" },
    alertTriggerBtn: {
      backgroundColor: "#f23f43",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 8,
    },
    alertTriggerBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
    modalSubOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
    modalSubContainer: {
      width: "100%",
      maxWidth: 440,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
      borderWidth: theme.id === "black" ? 0 : 1,
      borderColor: theme.border,
    },
    modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, justifyContent: "center", alignItems: "center" },
    syncBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.3)",
    },
    syncBadgeText: {
      color: "#10b981",
      fontSize: 11,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    deckSlotCard: {
      width: 108,
      height: 148,
      borderRadius: 10,
      marginRight: 10,
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.border,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    deckSlotCardSelected: {
      borderColor: theme.accent,
      transform: [{ scale: 1.02 }],
    },
    deckSlotThumb: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    deckSlotThumbEmpty: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    deckSlotHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 6,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    deckSlotNumber: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "800",
      fontFamily: "Josefin Sans",
    },
    activeDotBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(16, 185, 129, 0.95)",
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
    },
    activeDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: "#fff",
    },
    activeDotText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    deckSlotFooter: {
      padding: 6,
      backgroundColor: "rgba(0,0,0,0.72)",
    },
    deckSlotName: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    deckSlotMoodTag: {
      color: "#e2e8f0",
      fontSize: 9,
      fontWeight: "600",
      marginTop: 2,
      fontFamily: "Josefin Sans",
    },
    slotCustomizerBox: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    slotNumberTitle: {
      fontSize: 16,
      fontWeight: "bold",
      fontFamily: "Josefin Sans",
    },
    currentActiveBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    setAsActiveBtn: {
      backgroundColor: theme.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    setAsActiveBtnText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
      fontFamily: "Josefin Sans",
    },
    slotNameInputRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    moodOptionPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    moodOptionPillSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    moodOptionText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "600",
      fontFamily: "Josefin Sans",
    },
    smartOptionsContainer: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surface },
    saveBtn: { backgroundColor: "#23a559", paddingVertical: 14, borderRadius: 6, alignItems: "center" },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    deleteBtn: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
      backgroundColor: "rgba(244, 63, 94, 0.1)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(244, 63, 94, 0.2)",
    },
    deleteBtnText: { color: "#f43f5e", fontSize: 14, fontWeight: "600" },
  });
