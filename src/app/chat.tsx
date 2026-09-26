import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, SafeAreaView, KeyboardAvoidingView, Platform, Pressable,
  LayoutAnimation, UIManager, Modal, ActivityIndicator, PanResponder, Vibration,
  Animated as RNAnimated, Easing, Dimensions, useWindowDimensions, Keyboard,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, withSpring, withDelay, withTiming, withSequence, LinearTransition, interpolate } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Video, Hash, Plus, Send, User, MoreVertical, Trash2, Edit2, X, Check, CheckCheck, Reply, Heart, Smile, Type, Sticker, Users, Mic, Pin, Search, Settings, Info, ChevronUp, ChevronDown, PanelLeftClose, PanelLeftOpen, Download, Copy, ExternalLink, Sparkles, Bold, Italic, Strikethrough, Code, Keyboard as KeyboardIcon, Ghost, FileText } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CustomEmojiPicker from '../components/CustomEmojiPicker';
import { AlaGlassKeyboard } from "../components/AlaGlassKeyboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChatSettingsModal, { FONT_OPTIONS } from '../components/ChatSettingsModal';
import StickerPicker from '../components/StickerPicker';
import { HeartPing } from "../components/HeartPing";
import ShinyText from "../components/ShinyText";
import { DoodleOverlay } from "../components/DoodleOverlay";
import ChatInfoModal from "../components/ChatInfoModal";
import ZoomableImageViewer from "../components/ZoomableImageViewer";
import { tryEnterFullscreen } from "../lib/fullscreen";
import AudioPlayerBubble from "../components/AudioPlayerBubble";
import VideoPlayerBubble from "../components/VideoPlayerBubble";
import VoiceRecorder from "../components/VoiceRecorder";
import ChatSidebar from "../components/ChatSidebar";
import { AppleIntelligenceGlow } from "../components/AppleIntelligenceGlow";
import { FloatingHearts } from "../components/FloatingHearts";
import { SleepyByeBlocker } from "../components/SleepyByeBlocker";
import { ParallaxWallpaper } from "../components/ParallaxWallpaper";
import { detectEndlessByes, countByesInText } from "../lib/byeDetector";
import { isLoveMessage } from "../lib/loveDetector";
import { getDailyByeQuote } from "../lib/sleepyByeQuotes";
import { renderFormattedContent } from "../lib/formatText";
import { supabase } from "../lib/supabase";
import { uploadChatImageToR2, uploadAudioToR2, uploadVideoToR2, uploadBlobToR2 } from "../lib/r2";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isFeatureEnabled, UserProfile } from "../lib/features";
import {
  WallpaperDeckConfig,
  loadDeckFromLocal,
  saveDeckToLocal,
  fetchDeckFromCloud,
  persistDeckToCloud,
  broadcastDeckUpdate,
  getActiveSlot,
  getNextRotatedSlot,
  getSlotByMood,
  createDefaultDeck,
  normalizeDeck,
  mergeDecks,
  getSmartBubbleColors,
  resolveSmartBubbleColors,
} from "../utils/wallpaperDeck";
import {
  ChatAvatarMap,
  loadChatAvatarsFromLocal,
  saveChatAvatarToLocal,
  fetchChatAvatarsFromCloud,
} from "../utils/chatAvatar";
import { tabTitleManager } from "../utils/tabTitleManager";
import { playNotificationChime } from "../utils/soundManager";
import { EmojiAutocomplete, searchEmojis, EmojiMatch } from "../components/EmojiAutocomplete";
import { addMemory, saveNote } from "../utils/memoriesAndNotes";
import {
  NotchConfig,
  DEFAULT_NOTCH_CONFIG,
  subscribeNotchConfig,
  subscribeAudioState,
  DynamicIslandAudioEvent,
} from "../utils/notchConfig";
import {
  DynamicEqualizerBars,
  DynamicTypingDots,
  DynamicCameraGuide,
} from "../components/DynamicIslandVisuals";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAGE_SIZE = 50;

interface Message {
  id: string;
  sender: string;
  sender_id: string;
  text: string;
  type: "text" | "image" | "video" | "audio" | "sticker" | "alert" | "deleted" | "system";
  created_at: string;
  created_at_ts: number;
  time: string;
  avatar: string | null;
  isMe: boolean;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender?: string | null;
  custom_font?: string | null;
  status?: "sending" | "failed" | "sent";
  client_id?: string;
}

function SendingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const int = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".");
    }, 400);
    return () => clearInterval(int);
  }, []);
  return <>{dots}</>;
}

export default function ChatScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";
  const styles = React.useMemo(() => createStyles(isAmoled, theme, isDesktop), [isAmoled, theme, isDesktop]);
  const { id, name, avatar, isGroup: isGroupParam } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const [inputText, setInputText] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [groupChatData, setGroupChatData] = useState<any>(null);
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>(null);
  const [chatAvatars, setChatAvatars] = useState<ChatAvatarMap>({});
  const [wallpaperDeck, setWallpaperDeck] = useState<WallpaperDeckConfig | null>(null);
  const wallpaperDeckRef = useRef<WallpaperDeckConfig | null>(null);
  wallpaperDeckRef.current = wallpaperDeck;
  // showWallpaper must come AFTER chatSettings useState - never show wallpaper in AMOLED
  const showWallpaper = !isAmoled && !!chatSettings?.wallpaper_url;

  // Notch & Dynamic Island state
  const [notchConfig, setNotchConfig] = useState<NotchConfig>(DEFAULT_NOTCH_CONFIG);
  const [audioState, setAudioState] = useState<DynamicIslandAudioEvent>({ isPlaying: false });

  useEffect(() => {
    const unsubNotch = subscribeNotchConfig(cfg => setNotchConfig(cfg));
    const unsubAudio = subscribeAudioState(ev => setAudioState(ev));
    return () => {
      unsubNotch();
      unsubAudio();
    };
  }, []);

  const headerPaddingTop = React.useMemo(() => {
    if (isDesktop) return 16;
    const base = Platform.OS === "ios" ? 52 : 44;
    const offset = notchConfig.topOffset || 0;

    if (notchConfig.mode === "dynamic_island") {
      // Anchors snugly to top around camera cutout
      return Math.max(8, 20 + offset);
    } else if (notchConfig.mode === "floating_breathe") {
      // Drops header down to give open space for camera cutout
      return base + 16 + offset;
    } else if (notchConfig.mode === "edge_dot") {
      return base + 4 + offset;
    } else {
      // Classic
      return base + offset;
    }
  }, [isDesktop, notchConfig.mode, notchConfig.topOffset]);

  const effectivePillHeight = React.useMemo(() => {
    if (!isDesktop && notchConfig.mode === "dynamic_island") {
      return notchConfig.islandHeight || 46;
    }
    return 46;
  }, [isDesktop, notchConfig.mode, notchConfig.islandHeight]);

  const isDynamicIslandActive = !isDesktop && notchConfig.mode === "dynamic_island";
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsername, setTypingUsername] = useState<string | null>(null);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [isGlassKeyboardOpen, setIsGlassKeyboardOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    active: boolean;
    current: number;
    total: number;
    percent: number;
  }>({ active: false, current: 0, total: 0, percent: 0 });
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(isGroupParam === "true");
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const myProfileRef = useRef<UserProfile | null>(null);
  myProfileRef.current = myProfile;
  const [publicFeatures, setPublicFeatures] = useState<string[]>([]);
  const publicFeaturesRef = useRef<string[]>([]);
  publicFeaturesRef.current = publicFeatures;
  const isTargetOnline = targetUser && targetUser.updated_at 
    ? Date.now() - new Date(targetUser.updated_at).getTime() < 45 * 1000 
    : false;

  const formatLastSeenText = (targetUserObj: any, isOnline: boolean) => {
    if (isOnline) return "● Online";
    const lastActive = targetUserObj?.updated_at || targetUserObj?.last_read_at;
    if (!lastActive) return "○ Offline";

    const activeDate = new Date(lastActive);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - activeDate.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "○ Last seen just now";
    if (diffMins < 60) return `○ Last seen ${diffMins}m ago`;
    if (diffHours < 24) return `○ Last seen ${diffHours}h ago`;

    const timeStr = activeDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isYesterday = now.getDate() - activeDate.getDate() === 1 && now.getMonth() === activeDate.getMonth();
    if (isYesterday) return `○ Last seen yesterday at ${timeStr}`;

    return `○ Last seen ${activeDate.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [messageFont, setMessageFont] = useState<string | null>(null);
  const [isShimmerActive, setIsShimmerActive] = useState(false);
  const [emojiMatches, setEmojiMatches] = useState<EmojiMatch[]>([]);
  const [selectedEmojiIdx, setSelectedEmojiIdx] = useState(0);
  const [viewerToast, setViewerToast] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<any>(null);
  const [pingVisible, setPingVisible] = useState(false);
  const [isHeartGlowing, setIsHeartGlowing] = useState(false);
  const [thinkingOfYou, setThinkingOfYou] = useState<{ text: string } | null>(null);
  const [loveGlowActive, setLoveGlowActive] = useState(false);
  const [floatingHeartsActive, setFloatingHeartsActive] = useState(false);
  const heartAnim = useRef(new RNAnimated.Value(1)).current;
  const thinkingAnim = useRef(new RNAnimated.Value(0)).current;
  const heartTimerRef = useRef<any>(null);
  const thinkingTimerRef = useRef<any>(null);
  const loveGlowTimerRef = useRef<any>(null);
  const lastLoveTriggerMsgIdRef = useRef<string | null>(null);
  const lastLoveTriggerTimeRef = useRef<number>(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [myNicknameFromPartner, setMyNicknameFromPartner] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const highlightTimerRef = useRef<any>(null);

  // More ⋮ Animated Dropdown Menu State
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const moreMenuAnim = useRef(new RNAnimated.Value(0)).current;

  // In-Chat Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<{ id: string; text: string; created_at?: string }[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const searchDebounceTimer = useRef<any>(null);
  const pendingScrollTargetRef = useRef<string | null>(null);
  const searchHeaderAnim = useRef(new RNAnimated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  // Desktop sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sleepy Bye Blocker Database-Driven State & Cooldown Tracking
  const [chatBlockedUntil, setChatBlockedUntil] = useState<string | null>(null);
  const [chatBlockQuote, setChatBlockQuote] = useState<string | null>(null);
  const [chatBlockedByMsgId, setChatBlockedByMsgId] = useState<string | null>(null);
  const lastBlockTimeRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const currentChatId = (Array.isArray(id) ? id[0] : id) || "";

  // Realtime subscription and local persistence for chats table to keep both users in sync
  useEffect(() => {
    if (!currentChatId) return;

    // Check if there is an active block in local storage for this chat
    const checkLocal = async () => {
      try {
        let raw: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          raw = window.localStorage.getItem(`@sleepy_bye_block_${currentChatId}`);
        }
        if (!raw) {
          raw = await AsyncStorage.getItem(`@sleepy_bye_block_${currentChatId}`);
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.blockedUntil && new Date(parsed.blockedUntil).getTime() > Date.now()) {
            setChatBlockedUntil(parsed.blockedUntil);
            setChatBlockQuote(parsed.quote || null);
            setChatBlockedByMsgId(parsed.triggeringId || null);
          } else {
            if (Platform.OS === "web" && typeof window !== "undefined") {
              window.localStorage.removeItem(`@sleepy_bye_block_${currentChatId}`);
            }
            await AsyncStorage.removeItem(`@sleepy_bye_block_${currentChatId}`);
          }
        }

        // Restore cooldown state
        let cdRaw: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          cdRaw = window.localStorage.getItem(`@sleepy_bye_cooldown_${currentChatId}`);
        }
        if (!cdRaw) {
          cdRaw = await AsyncStorage.getItem(`@sleepy_bye_cooldown_${currentChatId}`);
        }
        if (cdRaw) {
          const parsedCd = JSON.parse(cdRaw);
          if (parsedCd?.cooldownUntil && parsedCd.cooldownUntil > Date.now()) {
            cooldownUntilRef.current = parsedCd.cooldownUntil;
          }
          if (parsedCd?.lastBlockedAt) {
            lastBlockTimeRef.current = parsedCd.lastBlockedAt;
          }
        }
      } catch {}
    };
    checkLocal();

    const chatChannel = supabase.channel(`chats_realtime_${currentChatId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${currentChatId}` }, (payload: any) => {
        if (payload.new) {
          const isStillBlocked = payload.new.blocked_until && new Date(payload.new.blocked_until).getTime() > Date.now();
          setChatBlockedUntil(isStillBlocked ? payload.new.blocked_until : null);
          setChatBlockQuote(isStillBlocked ? (payload.new.block_quote || null) : null);
          setChatBlockedByMsgId(payload.new.blocked_by_msg_id || null);

          // Sync with local storage
          if (isStillBlocked) {
            const record = { blockedUntil: payload.new.blocked_until, quote: payload.new.block_quote, triggeringId: payload.new.blocked_by_msg_id };
            if (Platform.OS === "web" && typeof window !== "undefined") {
              window.localStorage.setItem(`@sleepy_bye_block_${currentChatId}`, JSON.stringify(record));
            }
            AsyncStorage.setItem(`@sleepy_bye_block_${currentChatId}`, JSON.stringify(record)).catch(() => {});
          } else {
            if (Platform.OS === "web" && typeof window !== "undefined") {
              window.localStorage.removeItem(`@sleepy_bye_block_${currentChatId}`);
            }
            AsyncStorage.removeItem(`@sleepy_bye_block_${currentChatId}`).catch(() => {});
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [currentChatId]);

  // Trigger bye block ONLY on live, real-time message events (never on historical message loads)
  const checkLiveByeTrigger = useCallback((newMsg: any, allMsgs: Message[]) => {
    if (!currentChatId || !newMsg) return;

    // 1. Ignore non-text messages (e.g. system messages like heart ping, alerts, images, calls)
    if (newMsg.type && newMsg.type !== "text") return;

    // 2. CRITICAL: The newly sent/received message itself MUST contain at least one bye!
    // Non-bye messages (heart ping, "hello", emoji, question) NEVER trigger or count!
    const newMsgText = newMsg.text || newMsg.content;
    const byeCountInNewMsg = countByesInText(newMsgText);
    if (byeCountInNewMsg <= 0) return;

    // 3. Must be a live message created within the last 2 minutes
    const msgTime = newMsg.created_at_ts || (newMsg.created_at ? new Date(newMsg.created_at).getTime() : Date.now());
    if (Math.abs(Date.now() - msgTime) > 120 * 1000) return;

    // 4. If currently active block is running, do not re-trigger
    if (chatBlockedUntil && new Date(chatBlockedUntil).getTime() > Date.now()) return;

    // 5. Cooldown shield: If chat was recently blocked or in cooldown, protect conversation from endless loops
    if (cooldownUntilRef.current > Date.now()) return;

    const listToTest = [newMsg, ...allMsgs.filter(m => m.id !== newMsg.id)];
    const detection = detectEndlessByes(listToTest, 5 * 60 * 1000, 3, lastBlockTimeRef.current);
    if (!detection.shouldTrigger || !detection.triggeringMsgId) return;

    // ANTI-LOOP SHIELD:
    if (chatBlockedByMsgId === detection.triggeringMsgId) return;

    Keyboard.dismiss();

    const now = Date.now();
    const COOLDOWN_DURATION = 15 * 60 * 1000; // 15 minutes cooldown
    const newBlockedUntil = new Date(now + 120_000).toISOString();
    const newQuote = getDailyByeQuote();
    const triggeringId = detection.triggeringMsgId;

    lastBlockTimeRef.current = now;
    cooldownUntilRef.current = now + COOLDOWN_DURATION;

    setChatBlockedUntil(newBlockedUntil);
    setChatBlockQuote(newQuote);
    setChatBlockedByMsgId(triggeringId);

    // Save active block and cooldown to local storage
    const blockRecord = { blockedUntil: newBlockedUntil, quote: newQuote, triggeringId };
    const cdRecord = { cooldownUntil: now + COOLDOWN_DURATION, lastBlockedAt: now };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(`@sleepy_bye_block_${currentChatId}`, JSON.stringify(blockRecord));
      window.localStorage.setItem(`@sleepy_bye_cooldown_${currentChatId}`, JSON.stringify(cdRecord));
    }
    AsyncStorage.setItem(`@sleepy_bye_block_${currentChatId}`, JSON.stringify(blockRecord)).catch(() => {});
    AsyncStorage.setItem(`@sleepy_bye_cooldown_${currentChatId}`, JSON.stringify(cdRecord)).catch(() => {});

    supabase.from("chats").update({
      blocked_until: newBlockedUntil,
      block_quote: newQuote,
      blocked_by_msg_id: triggeringId,
    }).eq("id", currentChatId).then(({ error }) => {
      if (error) console.warn("Error updating sleepy block in chats table:", error);
    });

    // Auto-switch to Night wallpaper when sleepy byes detected
    triggerMoodWallpaper("night");
  }, [currentChatId, chatBlockedUntil, chatBlockedByMsgId, targetUser, name]);

  const triggerMoodWallpaper = useCallback((mood: "love" | "night" | "day") => {
    const currentDeck = wallpaperDeckRef.current;
    if (!currentDeck || !currentDeck.autoMoodEnabled || !id || !user) return;
    const targetSlot = getSlotByMood(currentDeck, mood);
    if (!targetSlot || !targetSlot.url) return;
    if (currentDeck.activeSlotId === targetSlot.id) return;

    const updatedDeck: WallpaperDeckConfig = {
      ...currentDeck,
      activeSlotId: targetSlot.id,
      updatedAt: Date.now(),
      updatedBy: user.id,
    };
    setWallpaperDeck(updatedDeck);
    wallpaperDeckRef.current = updatedDeck;
    saveDeckToLocal(id as string, updatedDeck);
    persistDeckToCloud(id as string, user.id, updatedDeck);
    broadcastDeckUpdate(id as string, user.id, updatedDeck);

    setChatSettings((prev: any) => ({
      ...(prev || {}),
      wallpaper_url: targetSlot.url,
      wallpaper_dim: targetSlot.dim,
      wallpaper_blur: targetSlot.blur,
      wallpaper_zoom: targetSlot.zoom,
    }));
  }, [id, user]);

  const triggerLoveGlow = useCallback(() => {
    setLoveGlowActive(true);
    setFloatingHeartsActive(true);
    if (loveGlowTimerRef.current) clearTimeout(loveGlowTimerRef.current);

    // 6.5s screen border glow (between 5 and 7 seconds, longer than thinking of you; NO top pill banner)
    loveGlowTimerRef.current = setTimeout(() => {
      setLoveGlowActive(false);
    }, 6500);
  }, []);

  // Trigger romantic love glow and floating hearts ONLY on fresh live messages
  const checkLiveLoveTrigger = useCallback((newMsg: any) => {
    if (!newMsg) return;

    // 1. Ignore non-text messages
    if (newMsg.type && newMsg.type !== "text") return;

    const msgText = newMsg.text || newMsg.content;
    if (typeof msgText !== "string" || !msgText.trim()) return;

    // 2. Romantic love phrase detection (flexible repeated letters e.g. love youuu, ily, etc.)
    if (!isLoveMessage(msgText)) return;

    // 3. Must be a live message created within the last 15 seconds (never historical messages or reloads)
    const msgTime = newMsg.created_at_ts || (newMsg.created_at ? new Date(newMsg.created_at).getTime() : Date.now());
    if (Math.abs(Date.now() - msgTime) > 15 * 1000) return;

    // 4. Anti-loop shield: never re-trigger on the same message ID
    if (newMsg.id && lastLoveTriggerMsgIdRef.current === newMsg.id) return;

    // 5. Anti-spam cooldown: 10s cooldown to prevent repeated spam
    const now = Date.now();
    if (now - lastLoveTriggerTimeRef.current < 10000) return;

    if (newMsg.id) {
      lastLoveTriggerMsgIdRef.current = newMsg.id;
    }
    lastLoveTriggerTimeRef.current = now;

    // 6. Trigger glow & floating hearts
    triggerLoveGlow();
    triggerMoodWallpaper("love");
  }, [triggerLoveGlow, triggerMoodWallpaper]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      AsyncStorage.getItem("@desktop_sidebar_collapsed").then(val => {
        if (val === "true") setSidebarCollapsed(true);
      }).catch(() => {});
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      AsyncStorage.setItem("@desktop_sidebar_collapsed", String(next)).catch(() => {});
      return next;
    });
  }, []);

  const openMoreMenu = () => {
    setMoreMenuVisible(true);
    RNAnimated.spring(moreMenuAnim, {
      toValue: 1,
      tension: 110,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const closeMoreMenu = () => {
    RNAnimated.timing(moreMenuAnim, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setMoreMenuVisible(false));
  };

  const openSearch = () => {
    closeMoreMenu();
    setIsSearchActive(true);
    setSearchQuery("");
    setSearchMatches([]);
    setCurrentMatchIdx(0);
    setIsSearchingDb(false);
    RNAnimated.timing(searchHeaderAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    });
  };

  const closeSearch = () => {
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    RNAnimated.timing(searchHeaderAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setIsSearchActive(false);
      setSearchQuery("");
      setSearchMatches([]);
      setCurrentMatchIdx(0);
      setIsSearchingDb(false);
      setHighlightedMsgId(null);
    });
  };

  const headerGlassStyle = React.useMemo(() => {
    if (isAmoled) return { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' };
    if (showWallpaper) return { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' };
    if (theme.id === 'light') return { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' };
    if (theme.id === 'pink') return { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' };
    return { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' };
  }, [isAmoled, showWallpaper, theme.id]);

  const headerIconColor = isAmoled ? "#ffffff" : ((theme.id === "light" || theme.id === "pink") ? "#111111" : "#ffffff");
  const headerTextColor = isAmoled ? "#ffffff" : (theme.id === "light" ? "#111111" : theme.id === "pink" ? "#5c0a2e" : "#ffffff");

  const handlePinMessage = useCallback(async (msg: Message | null) => {
    const pinData = msg ? { id: msg.id, text: msg.text, sender: msg.sender } : null;
    setPinnedMessage(pinData);

    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "pin_update",
        payload: { pinnedMessage: pinData },
      });
    }

    if (id) {
      if (pinData) {
        await AsyncStorage.setItem(`chat_${id}_pinned`, JSON.stringify(pinData));
      } else {
        await AsyncStorage.removeItem(`chat_${id}_pinned`);
      }
    }
  }, [id]);

  const activateHeartGlowAndBlink = useCallback(() => {
    setIsHeartGlowing(true);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);

    heartAnim.setValue(1);
    const pulse = RNAnimated.sequence([
      RNAnimated.timing(heartAnim, { toValue: 1.35, duration: 350, useNativeDriver: false }),
      RNAnimated.timing(heartAnim, { toValue: 1, duration: 350, useNativeDriver: false }),
    ]);
    const loop = RNAnimated.loop(pulse, { iterations: 4 });
    loop.start();

    heartTimerRef.current = setTimeout(() => {
      loop.stop();
      RNAnimated.timing(heartAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      setIsHeartGlowing(false);
    }, 3000);
  }, [heartAnim]);

  const showThinkingNotification = useCallback((text: string) => {
    setThinkingOfYou({ text });
    if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);

    thinkingAnim.setValue(0);
    RNAnimated.spring(thinkingAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 7,
      tension: 70,
    }).start();

    thinkingTimerRef.current = setTimeout(() => {
      RNAnimated.timing(thinkingAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: false,
      }).start(() => {
        setThinkingOfYou(null);
      });
    }, 3200);
  }, [thinkingAnim]);

  const triggerHeartPing = useCallback(async () => {
    activateHeartGlowAndBlink();
    const partnerName = targetUser?.nickname || targetUser?.username || name;
    showThinkingNotification(partnerName ? `Thinking of ${partnerName}...` : "Thinking of you...");

    const senderName = user?.user_metadata?.username || myNicknameFromPartner || "Someone";
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "ping",
        payload: {
          sender_id: user?.id,
          sender_name: senderName,
        },
      });
    }
    if (id && user) {
      await supabase.from("messages").insert({
        chat_id: id as string,
        sender_id: user.id,
        content: "❤️ Sent a heart ping! Thinking of you...",
        type: "system",
      });
    }
  }, [activateHeartGlowAndBlink, showThinkingNotification, targetUser, name, user, myNicknameFromPartner, id]);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingDebounceTimeoutRef = useRef<any>(null);
  const typingIdleTimeoutRef = useRef<any>(null);
  const handledResponsesRef = useRef<Set<string>>(new Set());
  const lastTypingSentRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null);
  const profileCache = useRef<Map<string, any>>(new Map());
  const fileInputRef = useRef<any>(null);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (replyingTo || editingMsgId) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [replyingTo, editingMsgId]);

  useEffect(() => {
    if (isGlassKeyboardOpen && !isFeatureEnabled("glass_keyboard", myProfile, publicFeatures)) {
      setIsGlassKeyboardOpen(false);
    }
  }, [isGlassKeyboardOpen, myProfile, publicFeatures]);

  useEffect(() => {
    if (isGlassKeyboardOpen) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isGlassKeyboardOpen]);

  const [viewportBottom, setViewportBottom] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const resetScroll = () => {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0 || document.body.scrollTop !== 0) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    const handleViewport = () => {
      resetScroll();
      if (window.visualViewport) {
        const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
        const visualHeight = window.visualViewport.height;
        const offsetTop = window.visualViewport.offsetTop || 0;

        let diff = layoutHeight - (visualHeight + offsetTop);
        const keyboardHeight = (diff > 40 && diff < 450) ? Math.min(diff, 320) : 0;

        setViewportBottom(keyboardHeight);
        if (keyboardHeight > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        }
      } else {
        setViewportBottom(0);
      }
    };

    const handleFullscreen = () => {
      resetScroll();
      handleViewport();
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewport);
      window.visualViewport.addEventListener("scroll", handleViewport);
    }
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport);
    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("webkitfullscreenchange", handleFullscreen);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewport);
        window.visualViewport.removeEventListener("scroll", handleViewport);
      }
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, []);

  // Close font picker tray when clicking / tapping anywhere outside on Web
  useEffect(() => {
    if (!fontPickerOpen || Platform.OS !== "web" || typeof document === "undefined") return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("#font-picker-tray") || target.closest("#font-picker-trigger")) {
        return;
      }
      setFontPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [fontPickerOpen]);

  // Automatically enter fullscreen when entering a chat
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    // 1. Immediate attempt (in case navigation preserved gesture)
    tryEnterFullscreen();

    // 2. Interaction fallback (in case direct link or refreshed page requires fresh tap)
    const handleFirstTap = () => {
      tryEnterFullscreen();
      window.removeEventListener("pointerdown", handleFirstTap, true);
      window.removeEventListener("keydown", handleFirstTap, true);
    };

    window.addEventListener("pointerdown", handleFirstTap, true);
    window.addEventListener("keydown", handleFirstTap, true);

    return () => {
      window.removeEventListener("pointerdown", handleFirstTap, true);
      window.removeEventListener("keydown", handleFirstTap, true);
    };
  }, []);

  const formatMsg = useCallback((msg: any): Message => {
    const rawTs = msg.created_at ? new Date(msg.created_at).getTime() : Date.now();
    const ts = isNaN(rawTs) ? Date.now() : rawTs;
    const dateObj = new Date(ts);
    const timeStr = isNaN(dateObj.getTime()) ? "" : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const contentText = typeof msg.content === "string" ? msg.content : (msg.content ? JSON.stringify(msg.content) : "");
    const replyContentText = typeof msg.reply_to_content === "string" ? msg.reply_to_content : (msg.reply_to_content ? JSON.stringify(msg.reply_to_content) : null);

    return {
      id: msg.id || `msg-${Math.random()}`,
      sender: msg.profiles?.username || "Unknown",
      sender_id: msg.sender_id || "",
      text: contentText,
      type: msg.type || "text",
      created_at: msg.created_at || new Date().toISOString(),
      created_at_ts: ts,
      time: timeStr,
      avatar: msg.profiles?.avatar_url || null,
      isMe: msg.sender_id === user?.id,
      reply_to_id: msg.reply_to_id || null,
      reply_to_content: replyContentText,
      reply_to_sender: msg.reply_to_sender || null,
      custom_font: msg.custom_font,
    };
  }, [user?.id]);

  // Effect to scroll to target message once gap messages are loaded into state
  useEffect(() => {
    if (pendingScrollTargetRef.current) {
      const targetId = pendingScrollTargetRef.current;
      const idx = messages.findIndex(m => m.id === targetId);
      if (idx !== -1) {
        pendingScrollTargetRef.current = null;
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: idx,
              animated: true,
              viewPosition: 0.5,
            });
          } catch (e) {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: idx,
                animated: true,
                viewPosition: 0.5,
              });
            }, 120);
          }
        }, 60);
      }
    }
  }, [messages]);

  const scrollToAndHighlightMessage = useCallback(async (targetMsgId: string) => {
    if (!targetMsgId) return;

    let targetIndex = messages.findIndex(m => m.id === targetMsgId);

    // If message is not yet loaded in memory (e.g. it's further up in chat history)
    if (targetIndex === -1 && id) {
      try {
        const { data: targetMsg } = await supabase
          .from("messages")
          .select("id, created_at")
          .eq("id", targetMsgId)
          .single();

        if (targetMsg?.created_at) {
          const oldest = messages[messages.length - 1];
          const oldestTime = oldest ? oldest.created_at : new Date().toISOString();

          // Fetch all gap messages between current oldest loaded message and target message
          const { data: gapMessages, error: gapErr } = await supabase
            .from("messages")
            .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)")
            .eq("chat_id", id)
            .lt("created_at", oldestTime)
            .gte("created_at", targetMsg.created_at)
            .neq("type", "deleted")
            .order("created_at", { ascending: false });

          // Also fetch 15 older messages past the target message for scroll context
          const { data: extraOlder } = await supabase
            .from("messages")
            .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)")
            .eq("chat_id", id)
            .lt("created_at", targetMsg.created_at)
            .neq("type", "deleted")
            .order("created_at", { ascending: false })
            .limit(15);

          const allFetched = [...(gapMessages || []), ...(extraOlder || [])];
          if (allFetched.length > 0) {
            const formatted = allFetched.map(formatMsg);
            pendingScrollTargetRef.current = targetMsgId;
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const additions = formatted.filter(m => !existingIds.has(m.id));
              return [...prev, ...additions];
            });
          }
        }
      } catch (err) {
        console.warn("Error fetching older messages for scroll target:", err);
      }
    }

    // Set highlight state
    setHighlightedMsgId(targetMsgId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMsgId(null);
    }, 2500);

    // Scroll to the index if already in memory
    if (targetIndex !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (e) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.5,
          });
        }, 120);
      }
    }
  }, [messages, id, formatMsg]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    const q = text.trim().toLowerCase();

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    if (!q) {
      setIsSearchingDb(false);
      setSearchMatches([]);
      setCurrentMatchIdx(0);
      return;
    }

    // 1. Instant local search across loaded messages
    const local = messages
      .filter(m => m.type !== "deleted" && m.type !== "system" && m.type !== "alert" && m.text && m.text.toLowerCase().includes(q))
      .map(m => ({ id: m.id, text: m.text, created_at: m.created_at }));

    setSearchMatches(local);
    setCurrentMatchIdx(0);

    if (local.length > 0) {
      scrollToAndHighlightMessage(local[0].id);
    }

    // 2. Query Supabase database across the entire conversation history
    setIsSearchingDb(true);
    searchDebounceTimer.current = setTimeout(async () => {
      if (!id) {
        setIsSearchingDb(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, content, created_at, type")
          .eq("chat_id", id)
          .ilike("content", `%${q}%`)
          .neq("type", "deleted")
          .neq("type", "alert")
          .order("created_at", { ascending: false });

        if (!error && data) {
          const dbMatches = data
            .filter((d: any) => d.type !== "system" && d.content)
            .map((d: any) => ({
              id: d.id,
              text: typeof d.content === "string" ? d.content : JSON.stringify(d.content || ""),
              created_at: d.created_at,
            }));

          const seen = new Set<string>();
          const merged: { id: string; text: string; created_at?: string }[] = [];
          for (const item of dbMatches) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          setSearchMatches(merged);
          setCurrentMatchIdx(0);
          if (merged.length > 0) {
            scrollToAndHighlightMessage(merged[0].id);
          }
        }
      } catch (err) {
        console.warn("Search query error:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 250);
  }, [messages, id, scrollToAndHighlightMessage]);

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = currentMatchIdx < searchMatches.length - 1 ? currentMatchIdx + 1 : 0;
    setCurrentMatchIdx(next);
    scrollToAndHighlightMessage(searchMatches[next].id);
  }, [searchMatches, currentMatchIdx, scrollToAndHighlightMessage]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = currentMatchIdx > 0 ? currentMatchIdx - 1 : searchMatches.length - 1;
    setCurrentMatchIdx(prev);
    scrollToAndHighlightMessage(searchMatches[prev].id);
  }, [searchMatches, currentMatchIdx, scrollToAndHighlightMessage]);

  // Browser Tab Title: dynamic base title & unread counter
  useEffect(() => {
    const displayName = targetUser?.nickname || (name as string) || targetUser?.username || "Chat";
    tabTitleManager.setBaseTitle(`${displayName} • Alatext`);
    return () => {
      tabTitleManager.setBaseTitle("Alatext");
      tabTitleManager.clearUnread();
    };
  }, [targetUser?.nickname, targetUser?.username, name]);

  useEffect(() => {
    if (!id || !user) return;
    setMessages([]); setHasMore(true); setEditingMsgId(null); setReplyingTo(null); setHoveredMsg(null);
    setTargetUser(null); setGroupChatData(null); setIsGroup(false); setGroupMemberCount(0);
    setChatSettings(null); setPinnedMessage(null); setMyNicknameFromPartner(null);
    setLoveGlowActive(false); setFloatingHeartsActive(false);
    profileCache.current.clear();

    const sessionToken = `${id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const init = async () => {
      let initialSettings: any = {};
      try {
        const cachedSettings = await AsyncStorage.getItem(`chat_${id}_settings`);
        if (cachedSettings) {
          initialSettings = JSON.parse(cachedSettings);
          setChatSettings(initialSettings);
        }
        const cachedPin = await AsyncStorage.getItem(`chat_${id}_pinned`);
        if (cachedPin) setPinnedMessage(JSON.parse(cachedPin));
      } catch (e) {}

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) setMyProfile(prof);
      const { data: st } = await supabase.from("app_settings").select("value").eq("key", "public_features").single();
      if (st?.value && Array.isArray(st.value)) setPublicFeatures(st.value);

      const { data: mySettings } = await supabase.from("chat_participants").select("*").eq("chat_id", id).eq("user_id", user.id).single();
      const mergedSettings = { ...initialSettings, ...(mySettings || {}) };
      if (!mySettings?.send_button_emoji && initialSettings?.send_button_emoji) {
        mergedSettings.send_button_emoji = initialSettings.send_button_emoji;
      }

      if (mySettings?.custom_avatar_url) {
        setChatAvatars(prev => ({ ...prev, [user.id]: mySettings.custom_avatar_url }));
      }

      // Check partner's settings as fallback if wallpaper isn't in mySettings
      let fallbackWallpaperUrl = mySettings?.wallpaper_url || initialSettings?.wallpaper_url;
      let partnerPartData: any = null;
      if (!fallbackWallpaperUrl) {
        const { data: partnerPart } = await supabase.from("chat_participants").select("wallpaper_url, wallpaper_dim, wallpaper_blur, wallpaper_zoom, wallpaper_deck, custom_avatar_url").eq("chat_id", id).neq("user_id", user.id).limit(1).maybeSingle();
        partnerPartData = partnerPart;
        if (partnerPart?.wallpaper_url) {
          fallbackWallpaperUrl = partnerPart.wallpaper_url;
          if (mergedSettings.wallpaper_url === undefined) {
            mergedSettings.wallpaper_url = partnerPart.wallpaper_url;
            mergedSettings.wallpaper_dim = partnerPart.wallpaper_dim || 0;
            mergedSettings.wallpaper_blur = partnerPart.wallpaper_blur || 0;
            mergedSettings.wallpaper_zoom = partnerPart.wallpaper_zoom || 1;
          }
        }
      }

      // Load or initialize Wallpaper Deck
      let loadedDeck: WallpaperDeckConfig | null = await loadDeckFromLocal(id as string);
      let cloudDeck: WallpaperDeckConfig | null = null;
      if (mySettings?.wallpaper_deck) {
        cloudDeck = normalizeDeck(mySettings.wallpaper_deck, fallbackWallpaperUrl, user.id);
      } else if (partnerPartData?.wallpaper_deck) {
        cloudDeck = normalizeDeck(partnerPartData.wallpaper_deck, fallbackWallpaperUrl, user.id);
      }
      if (!cloudDeck) {
        cloudDeck = await fetchDeckFromCloud(id as string, user.id);
      }
      loadedDeck = mergeDecks(loadedDeck, cloudDeck, fallbackWallpaperUrl, user.id);
      saveDeckToLocal(id as string, loadedDeck);

      // 1. Session Auto-Rotate (if explicitly enabled)
      if (loadedDeck.autoRotateEnabled) {
        const nextSlot = getNextRotatedSlot(loadedDeck);
        if (nextSlot && nextSlot.id !== loadedDeck.activeSlotId) {
          loadedDeck = {
            ...loadedDeck,
            activeSlotId: nextSlot.id,
            updatedAt: Date.now(),
            updatedBy: user.id,
          };
          saveDeckToLocal(id as string, loadedDeck);
          persistDeckToCloud(id as string, user.id, loadedDeck);
          broadcastDeckUpdate(id as string, user.id, loadedDeck);
        }
      }

      setWallpaperDeck(loadedDeck);
      wallpaperDeckRef.current = loadedDeck;
      const activeSlot = getActiveSlot(loadedDeck);
      if (activeSlot) {
        mergedSettings.wallpaper_url = activeSlot.url || null;
        mergedSettings.wallpaper_dim = activeSlot.dim || 0;
        mergedSettings.wallpaper_blur = activeSlot.blur || 0;
        mergedSettings.wallpaper_zoom = activeSlot.zoom || 1;
        if (loadedDeck.autoMatchBubbles !== false && !mergedSettings.personal_color_override) {
          const colors = getSmartBubbleColors(activeSlot);
          mergedSettings.bubble_color_sent = colors.sent;
          mergedSettings.bubble_color_received = colors.received;
          if (activeSlot.url) {
            resolveSmartBubbleColors(activeSlot).then((dyn) => {
              setChatSettings((prev: any) => {
                if (!prev || prev.personal_color_override) return prev;
                if (prev.bubble_color_sent === dyn.sent && prev.bubble_color_received === dyn.received) return prev;
                const updated = { ...prev, bubble_color_sent: dyn.sent, bubble_color_received: dyn.received };
                AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(updated)).catch(() => {});
                return updated;
              });
            });
          }
        }
      }

      setChatSettings(mergedSettings);
      AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(mergedSettings)).catch(() => {});
      const { data: chatData } = await supabase.from("chats").select("*").eq("id", id).single();
      if (chatData) {
        const isStillBlocked = chatData.blocked_until && new Date(chatData.blocked_until).getTime() > Date.now();
        setChatBlockedUntil(isStillBlocked ? chatData.blocked_until : null);
        setChatBlockQuote(isStillBlocked ? (chatData.block_quote || null) : null);
        setChatBlockedByMsgId(chatData.blocked_by_msg_id || null);

        // If block is already expired in DB, clean it up so it never causes stale false triggers
        if (chatData.blocked_until && !isStillBlocked) {
          supabase.from("chats").update({ blocked_until: null }).eq("id", id).then(() => {}, () => {});
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.localStorage.removeItem(`@sleepy_bye_block_${id}`);
          }
          AsyncStorage.removeItem(`@sleepy_bye_block_${id}`).catch(() => {});
        }
      }
      if (chatData?.is_group) {
        setIsGroup(true);
        setGroupChatData(chatData);
        const { count } = await supabase.from("chat_participants").select("*", { count: "exact", head: true }).eq("chat_id", id);
        if (count) setGroupMemberCount(count);
      }
      const { data: parts } = await supabase.from("chat_participants").select("user_id, last_read_at, nickname, custom_avatar_url").eq("chat_id", id).neq("user_id", user.id).limit(1);
      if (parts && parts.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", parts[0].user_id).single();
        const savedNick = mySettings?.nickname || mySettings?.partner_nickname || null;
        if (profile) setTargetUser({ ...profile, last_read_at: parts[0].last_read_at, nickname: savedNick });
        if (parts[0].nickname) setMyNicknameFromPartner(parts[0].nickname);
        if (parts[0].custom_avatar_url) {
          setChatAvatars(prev => ({ ...prev, [parts[0].user_id]: parts[0].custom_avatar_url }));
        }
      }
      if (id) {
        loadChatAvatarsFromLocal(id as string).then(cached => {
          if (cached && Object.keys(cached).length > 0) {
            setChatAvatars(prev => ({ ...cached, ...prev }));
          }
        });
        fetchChatAvatarsFromCloud(id as string).then(cloudAvatars => {
          if (cloudAvatars && Object.keys(cloudAvatars).length > 0) {
            setChatAvatars(prev => ({ ...prev, ...cloudAvatars }));
          }
        });
      }
    };
    init();

    const syncChannel = supabase.channel("app_settings_sync");
    syncChannel
      .on("broadcast", { event: "settings_updated" }, (payload: any) => {
        if (payload.payload?.publicFeatures) {
          setPublicFeatures(payload.payload.publicFeatures);
        }
        if (payload.payload?.userId === user?.id && payload.payload?.awardedFeatures) {
          setMyProfile((prev: any) => (prev ? { ...prev, awarded_features: payload.payload.awardedFeatures } : prev));
        }
      })
      .subscribe();

    const fetchMsgs = async () => {
      try {
        const cachedMsgs = await AsyncStorage.getItem(`chat_${id}_messages`);
        if (cachedMsgs) {
          const parsed = JSON.parse(cachedMsgs);
          setMessages(prev => prev.length === 0 ? parsed : prev);
        }
      } catch (e) {}

      const { data, error } = await supabase.from("messages")
        .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)")
        .eq("chat_id", id).order("created_at", { ascending: false }).limit(PAGE_SIZE);
      
      if (!error && data) { 
        const now = Date.now();
        const handledStr = await AsyncStorage.getItem("@handled_alerts_set").catch(() => null);
        const handledSet = new Set(handledStr ? JSON.parse(handledStr) : []);

        const alertMsg = data.find(m => {
          if (m.type !== "alert" || m.sender_id === user?.id || handledSet.has(m.id)) return false;
          return (now - new Date(m.created_at).getTime()) < 10 * 60 * 1000;
        });
        if (alertMsg) {
          try {
            setCustomAlert({ ...JSON.parse(alertMsg.content), messageId: alertMsg.id });
          } catch (e) {}
        }
        
        const filtered = data.filter(m => m.type !== "alert" && m.type !== "deleted" && m.type !== "wallpaper_deck" && m.type !== "chat_avatar");
        const formatted = filtered.map(formatMsg);
        setMessages(formatted); 
        setHasMore(data.length === PAGE_SIZE); 
        AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(formatted)).catch(() => {});
      }
    };
    fetchMsgs();

    const channel = supabase.channel(`chat_${sessionToken}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, async (payload) => {
        if (payload.eventType === "INSERT") {
          if (payload.new.type === "wallpaper_deck") {
            try {
              const parsedDeck = typeof payload.new.content === "string" ? JSON.parse(payload.new.content) : payload.new.content;
              if (parsedDeck) {
                const normDeck = mergeDecks(wallpaperDeckRef.current, parsedDeck, undefined, user.id);
                setWallpaperDeck(normDeck);
                wallpaperDeckRef.current = normDeck;
                saveDeckToLocal(id as string, normDeck);
                const activeSlot = getActiveSlot(normDeck);
                if (activeSlot) {
                  setChatSettings((prev: any) => {
                    const nextSettings: any = {
                      ...(prev || {}),
                      wallpaper_url: activeSlot.url || null,
                      wallpaper_dim: activeSlot.dim || 0,
                      wallpaper_blur: activeSlot.blur || 0,
                      wallpaper_zoom: activeSlot.zoom || 1,
                    };
                    if (normDeck.autoMatchBubbles !== false && !prev?.personal_color_override) {
                      const colors = getSmartBubbleColors(activeSlot);
                      nextSettings.bubble_color_sent = colors.sent;
                      nextSettings.bubble_color_received = colors.received;
                      if (activeSlot.url) {
                        resolveSmartBubbleColors(activeSlot).then((dyn) => {
                          setChatSettings((p: any) => {
                            if (!p || p.personal_color_override) return p;
                            if (p.bubble_color_sent === dyn.sent && p.bubble_color_received === dyn.received) return p;
                            const up = { ...p, bubble_color_sent: dyn.sent, bubble_color_received: dyn.received };
                            AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(up)).catch(() => {});
                            return up;
                          });
                        });
                      }
                    }
                    AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(nextSettings)).catch(() => {});
                    return nextSettings;
                  });
                }
              }
            } catch (e) {}
            return;
          }
          if (payload.new.type === "chat_avatar") {
            try {
              const parsed = typeof payload.new.content === "string" ? JSON.parse(payload.new.content) : payload.new.content;
              const customUrl = parsed?.custom_avatar_url || null;
              setChatAvatars(prev => ({ ...prev, [payload.new.sender_id]: customUrl }));
            } catch (e) {}
            return;
          }
          if (payload.new.type === "alert") {
            if (payload.new.sender_id !== user?.id) {
              const handledStr = await AsyncStorage.getItem("@handled_alerts_set").catch(() => null);
              const handledSet = new Set(handledStr ? JSON.parse(handledStr) : []);
              if (!handledSet.has(payload.new.id)) {
                try { setCustomAlert({ ...JSON.parse(payload.new.content), messageId: payload.new.id }); } catch (e) {}
              }
            }
            return;
          }
          let pd = profileCache.current.get(payload.new.sender_id);
          if (!pd) {
            const { data } = await supabase.from("profiles").select("username, avatar_url").eq("id", payload.new.sender_id).single();
            pd = data; if (data) profileCache.current.set(payload.new.sender_id, data);
          }
          const rawTs = payload.new.created_at ? new Date(payload.new.created_at).getTime() : Date.now();
          const validTs = isNaN(rawTs) ? Date.now() : rawTs;
          const dateObj = new Date(validTs);
          const timeStr = isNaN(dateObj.getTime()) ? "" : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const contentText = typeof payload.new.content === "string" ? payload.new.content : (payload.new.content ? JSON.stringify(payload.new.content) : "");

          const nm: Message = {
            id: payload.new.id, sender: pd?.username || "Unknown", sender_id: payload.new.sender_id,
            text: contentText, type: payload.new.type || "text", created_at: payload.new.created_at || new Date().toISOString(),
            created_at_ts: validTs, time: timeStr,
            avatar: pd?.avatar_url || null, isMe: payload.new.sender_id === user?.id,
            reply_to_id: payload.new.reply_to_id, reply_to_content: payload.new.reply_to_content, reply_to_sender: payload.new.reply_to_sender,
          };
          if (nm.sender_id !== user?.id) {
            setIsTyping(false);
            setGhostText(null);
            setTypingUsername(null);
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }
            playNotificationChime();
            const senderDisplayName = nm.sender || targetUser?.nickname || (name as string) || "New message";
            tabTitleManager.incrementUnread(senderDisplayName);
          }
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => {
            if (prev.some(m => m.id === nm.id)) return prev;
            if (nm.sender_id === user?.id) {
              const tempIndex = prev.findIndex(m => (m.id.startsWith("temp-") || m.client_id) && m.text === nm.text);
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = { ...nm, client_id: updated[tempIndex].client_id || updated[tempIndex].id, status: "sent" };
                return updated;
              }
            }
            return [nm, ...prev];
          });
          checkLiveByeTrigger(nm, messagesRef.current);
          checkLiveLoveTrigger(nm);
        } else if (payload.eventType === "DELETE") {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const delId = payload.old?.id;
          if (delId) {
            setMessages(prev => prev.filter(m => m.id !== delId));
          }
        } else if (payload.eventType === "UPDATE") {
          if (payload.new.type === "deleted") {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(prev => prev.filter(m => m.id !== payload.new.id));
          } else {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, text: typeof payload.new.content === "string" ? payload.new.content : JSON.stringify(payload.new.content || "") } : m));
          }
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        if (payload.old?.id) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      }).subscribe();

    const pChannel = supabase.channel(`participants_${sessionToken}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `chat_id=eq.${id}` }, (payload: any) => {
        if (!payload.new) return;
        if (payload.new.user_id !== user.id) {
          setTargetUser((prev: any) => prev ? { ...prev, last_read_at: payload.new.last_read_at } : prev);
        }
        if (payload.new.custom_avatar_url !== undefined) {
          const newAvatar = payload.new.custom_avatar_url || null;
          setChatAvatars(prev => ({ ...prev, [payload.new.user_id]: newAvatar }));
          saveChatAvatarToLocal(id as string, payload.new.user_id, newAvatar);
        }
        if (payload.new.wallpaper_deck) {
          const normDeck = mergeDecks(wallpaperDeckRef.current, payload.new.wallpaper_deck, payload.new.wallpaper_url, user.id);
          setWallpaperDeck(normDeck);
          wallpaperDeckRef.current = normDeck;
          saveDeckToLocal(id as string, normDeck);
          const activeSlot = getActiveSlot(normDeck);
          if (activeSlot) {
            setChatSettings((prev: any) => {
              const updated = {
                ...(prev || {}),
                wallpaper_url: activeSlot.url || null,
                wallpaper_dim: activeSlot.dim || 0,
                wallpaper_blur: activeSlot.blur || 0,
                wallpaper_zoom: activeSlot.zoom || 1,
              };
              if (normDeck.autoMatchBubbles !== false && !prev?.personal_color_override) {
                const colors = getSmartBubbleColors(activeSlot);
                updated.bubble_color_sent = colors.sent;
                updated.bubble_color_received = colors.received;
              }
              AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(updated)).catch(() => {});
              return updated;
            });
          }
        } else if (payload.new.wallpaper_url !== undefined && payload.new.user_id !== user.id) {
          setChatSettings((prev: any) => {
            const updated = {
              ...(prev || {}),
              wallpaper_url: payload.new.wallpaper_url || null,
              wallpaper_dim: payload.new.wallpaper_dim ?? prev?.wallpaper_dim ?? 0,
              wallpaper_blur: payload.new.wallpaper_blur ?? prev?.wallpaper_blur ?? 0,
              wallpaper_zoom: payload.new.wallpaper_zoom ?? prev?.wallpaper_zoom ?? 1,
            };
            AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      }).subscribe();

    const profChannel = supabase.channel(`profiles_${sessionToken}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        if (payload.new && payload.new.id === user?.id) {
          setMyProfile((prev: any) => ({ ...prev, ...payload.new }));
        }
        setTargetUser((prev: any) => {
          if (prev && payload.new.id === prev.id) return { ...prev, updated_at: payload.new.updated_at };
          return prev;
        });
      }).subscribe();

    const settingsChannel = supabase.channel(`app_settings_${sessionToken}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload: any) => {
        if (payload.new && payload.new.key === "public_features" && Array.isArray(payload.new.value)) {
          setPublicFeatures(payload.new.value);
        }
      }).subscribe();

    const broadcastTopic = `chat_broadcast_${id}`;
    const existingBChannel = supabase.getChannels().find(c => c.topic === `realtime:${broadcastTopic}` || c.topic === broadcastTopic);
    if (existingBChannel) {
      try { supabase.removeChannel(existingBChannel); } catch (e) {}
    }
    const tChannel = supabase.channel(broadcastTopic, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload: any) => {
        const p = payload?.payload;
        if (!p || p.user_id === user.id) return;

        // Explicit stop typing broadcast from sender (sent message, backspaced to empty, or blur)
        if (p.is_typing === false) {
          setIsTyping(false);
          setGhostText(null);
          setTypingUsername(null);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
          return;
        }

        const tUser = p.username || targetUser?.nickname || targetUser?.username || "Someone";
        setTypingUsername(tUser);
        setIsTyping(true);

        if (p.ghost_text) {
          setGhostText(p.ghost_text);
        } else {
          setGhostText(null);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setGhostText(null);
          setTypingUsername(null);
        }, 3500);
      })
      .on("broadcast", { event: "ping" }, (payload: any) => {
        if (payload.payload?.senderId !== user.id) {
          activateHeartGlowAndBlink();
          showThinkingNotification(payload.payload?.text || "Thinking of you...");
          if (payload.payload?.loveGlow) {
            triggerLoveGlow();
            triggerMoodWallpaper("love");
          }
        }
      })
      .on("broadcast", { event: "custom_alert" }, (payload) => {
        setCustomAlert(payload.payload);
      })
      .on("broadcast", { event: "alert_response" }, (payload) => {
        const { alertId, choice, title, responder } = payload.payload || {};
        const key = `${alertId}_${choice}`;
        if (alertId && handledResponsesRef.current.has(key)) return;
        if (alertId) handledResponsesRef.current.add(key);

        if (Platform.OS === "web") {
          alert(`📢 Response from ${responder}:\n"${choice}" for "${title}"`);
        }
        setCustomAlert(null);
      })
      .on("broadcast", { event: "message_deleted" }, (payload) => {
        if (payload.payload?.id) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.filter(m => m.id !== payload.payload.id));
          AsyncStorage.getItem(`chat_${id}_messages`).then(cached => {
            if (cached) {
              const msgs = JSON.parse(cached).filter((m: any) => m.id !== payload.payload.id);
              AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(msgs)).catch(() => {});
            }
          });
        }
      })
      .on("broadcast", { event: "pin_update" }, (payload) => {
        setPinnedMessage(payload.payload.pinnedMessage || null);
      })
      .on("broadcast", { event: "chat_avatar_sync" }, (payload: any) => {
        if (payload.payload?.userId) {
          const { userId, avatarUrl } = payload.payload;
          setChatAvatars(prev => ({ ...prev, [userId]: avatarUrl || null }));
        }
      })
      .on("broadcast", { event: "wallpaper_sync" }, (payload: any) => {
        const p = payload?.payload;
        if (!p?.deck) return;
        const incomingDeck = mergeDecks(wallpaperDeckRef.current, p.deck, undefined, user.id);
        setWallpaperDeck(incomingDeck);
        wallpaperDeckRef.current = incomingDeck;
        saveDeckToLocal(id as string, incomingDeck);

        const activeSlot = getActiveSlot(incomingDeck);
        if (activeSlot) {
          setChatSettings((prev: any) => {
            const nextSettings: any = {
              ...(prev || {}),
              wallpaper_url: activeSlot.url || null,
              wallpaper_dim: activeSlot.dim || 0,
              wallpaper_blur: activeSlot.blur || 0,
              wallpaper_zoom: activeSlot.zoom || 1,
            };
            if (incomingDeck.autoMatchBubbles !== false && !prev?.personal_color_override) {
              const colors = getSmartBubbleColors(activeSlot);
              nextSettings.bubble_color_sent = colors.sent;
              nextSettings.bubble_color_received = colors.received;
              if (activeSlot.url) {
                resolveSmartBubbleColors(activeSlot).then((dyn) => {
                  setChatSettings((p: any) => {
                    if (!p || p.personal_color_override) return p;
                    if (p.bubble_color_sent === dyn.sent && p.bubble_color_received === dyn.received) return p;
                    const up = { ...p, bubble_color_sent: dyn.sent, bubble_color_received: dyn.received };
                    AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(up)).catch(() => {});
                    return up;
                  });
                });
              }
            }
            AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(nextSettings)).catch(() => {});
            return nextSettings;
          });
        }
      }).subscribe();
    typingChannelRef.current = tChannel;

    const chatChannel = supabase.channel(`chats_${sessionToken}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${id}` }, (payload) => {
        setGroupChatData((prev: any) => ({ ...prev, ...payload.new }));
      }).subscribe();

    return () => {
      if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);
      if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (tChannel && user) {
        try {
          tChannel.send({
            type: "broadcast",
            event: "typing",
            payload: { user_id: user.id, is_typing: false, ghost_text: null }
          });
        } catch (e) {}
      }
      try { supabase.removeChannel(syncChannel); } catch (e) {}
      try { supabase.removeChannel(channel); } catch (e) {}
      try { supabase.removeChannel(pChannel); } catch (e) {}
      try { supabase.removeChannel(tChannel); } catch (e) {}
      try { supabase.removeChannel(profChannel); } catch (e) {}
      try { supabase.removeChannel(settingsChannel); } catch (e) {}
      try { supabase.removeChannel(chatChannel); } catch (e) {}
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
      setIsHeartGlowing(false);
      setThinkingOfYou(null);
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (messages.length === 0 || !id || !user) return;
    supabase.from("chat_participants").update({ last_read_at: new Date().toISOString() }).eq("chat_id", id).eq("user_id", user.id).then();
  }, [id, user?.id, messages.length]);


  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[messages.length - 1];
    const { data, error } = await supabase.from("messages")
      .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)")
      .eq("chat_id", id).lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (!error && data) {
      const filtered = data.filter(m => m.type !== "alert" && m.type !== "deleted" && m.type !== "wallpaper_deck" && m.type !== "chat_avatar");
      setMessages(prev => [...prev, ...filtered.map(formatMsg)]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, messages, id, formatMsg]);

  useEffect(() => {
    if (messages.length > 0 && id) {
      AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(messages.slice(0, PAGE_SIZE))).catch(() => {});
    }
  }, [messages, id]);

  const handleApplyWallpaper = useCallback(async () => {
    if (!targetUser || !user || !id) return;
    const { data: ts } = await supabase.from("chat_participants").select("*").eq("chat_id", id).eq("user_id", targetUser.id).single();
    if (ts?.wallpaper_url) {
      const ns = { wallpaper_url: ts.wallpaper_url, wallpaper_blur: ts.wallpaper_blur, wallpaper_dim: ts.wallpaper_dim, wallpaper_zoom: ts.wallpaper_zoom };
      const { error } = await supabase.from("chat_participants").update(ns).eq("chat_id", id).eq("user_id", user.id);
      if (!error) setChatSettings((prev: any) => ({ ...prev, ...ns }));
    }
  }, [targetUser, user, id]);

  const handleDownloadImage = useCallback(async (url: string | null) => {
    if (!url) return;
    try {
      setViewerToast("Downloading photo...");
      if (Platform.OS === "web") {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `alatext_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setViewerToast("Photo downloaded!");
      } else {
        setViewerToast("Photo downloaded!");
      }
    } catch (e) {
      if (Platform.OS === "web") window.open(url, "_blank");
      setViewerToast("Opened photo!");
    }
    setTimeout(() => setViewerToast(null), 2200);
  }, []);

  const handleCopyImage = useCallback(async (url: string | null) => {
    if (!url) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        const resp = await fetch(url);
        const blob = await resp.blob();
        if (typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type || "image/jpeg"]: blob })
          ]);
          setViewerToast("Image copied to clipboard!");
        } else {
          await navigator.clipboard.writeText(url);
          setViewerToast("Image link copied!");
        }
      } else {
        await navigator.clipboard.writeText(url);
        setViewerToast("Link copied!");
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(url);
        setViewerToast("Link copied!");
      } catch (err) {
        setViewerToast("Could not copy");
      }
    }
    setTimeout(() => setViewerToast(null), 2200);
  }, []);

  const applyTextFormat = useCallback((marker: string) => {
    setInputText(prev => {
      if (!prev || !prev.trim()) return `${marker}text${marker}`;
      return `${prev} ${marker}text${marker}`;
    });
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, []);

  const toggleBold = useCallback(() => applyTextFormat("**"), [applyTextFormat]);
  const toggleItalic = useCallback(() => applyTextFormat("*"), [applyTextFormat]);

  const handleSelectAutocompleteEmoji = useCallback((emoji: string) => {
    setInputText(prev => {
      return prev.replace(/(?:^|\s):([a-zA-Z0-9_]{1,15})$/, (fullMatch) => {
        const prefix = fullMatch.startsWith(" ") ? " " : "";
        return prefix + emoji + " ";
      });
    });
    setEmojiMatches([]);
    setSelectedEmojiIdx(0);
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, []);

  // PC Keyboard Shortcuts (Ctrl/Cmd + E/S/Shift+F/B/I/H)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();

      if (key === "e" && !e.shiftKey) {
        e.preventDefault();
        setEmojiOpen(prev => !prev);
        return;
      }
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        setStickerPickerOpen(prev => !prev);
        return;
      }
      if (key === "f" && e.shiftKey) {
        e.preventDefault();
        setFontPickerOpen(prev => !prev);
        return;
      }
      if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        applyTextFormat("**");
        return;
      }
      if (key === "i" && !e.shiftKey) {
        e.preventDefault();
        applyTextFormat("*");
        return;
      }
      if ((key === "s" && e.shiftKey) || (key === "h" && !e.shiftKey)) {
        e.preventDefault();
        setIsShimmerActive(prev => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [applyTextFormat]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    tabTitleManager.clearUnread();

    // Check for Discord-style colon emoji search: e.g. ":smi", ":heart", ":fire"
    const colonMatch = text.match(/(?:^|\s):([a-zA-Z0-9_]{1,15})$/);
    if (colonMatch) {
      const q = colonMatch[1];
      const results = searchEmojis(q);
      setEmojiMatches(results);
      setSelectedEmojiIdx(0);
    } else {
      setEmojiMatches(prev => (prev.length > 0 ? [] : prev));
    }

    if (!typingChannelRef.current || !user) return;
    const trimmed = text.trim();

    // 1. If text is cleared or empty, instantly broadcast stop_typing
    if (!trimmed) {
      if (typingDebounceTimeoutRef.current) {
        clearTimeout(typingDebounceTimeoutRef.current);
        typingDebounceTimeoutRef.current = null;
      }
      if (typingIdleTimeoutRef.current) {
        clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
      try {
        typingChannelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: {
            user_id: user.id,
            username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
            is_typing: false,
            ghost_text: null,
          },
        });
      } catch (e) {}
      return;
    }

    // Set an idle fallback: if the user stops typing for 3.5s, auto broadcast stop_typing
    if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);
    typingIdleTimeoutRef.current = setTimeout(() => {
      try {
        if (typingChannelRef.current && user) {
          typingChannelRef.current.send({
            type: "broadcast",
            event: "typing",
            payload: {
              user_id: user.id,
              username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
              is_typing: false,
              ghost_text: null,
            },
          });
        }
      } catch (e) {}
    }, 3500);

    const canGhost = isFeatureEnabled("ghost_typing", myProfileRef.current, publicFeaturesRef.current);
    const now = Date.now();

    if (canGhost) {
      // Ghost typing: fast real-time letter-by-letter reveal (120ms debounce)
      if (typingDebounceTimeoutRef.current) {
        clearTimeout(typingDebounceTimeoutRef.current);
      }

      const sendGhostPayload = () => {
        lastTypingSentRef.current = Date.now();
        try {
          typingChannelRef.current.send({
            type: "broadcast",
            event: "typing",
            payload: {
              user_id: user.id,
              username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
              is_typing: true,
              ghost_text: text,
            },
          });
        } catch (e) {}
      };

      // If user just started typing (first keypress or after long idle), broadcast immediately
      if (now - lastTypingSentRef.current > 1500) {
        sendGhostPayload();
      } else {
        // Subsequent keystrokes debounced by 120ms for smooth live letter reveal without flooding
        typingDebounceTimeoutRef.current = setTimeout(sendGhostPayload, 120);
      }
    } else {
      // Normal typing indicator: broadcast every 2000ms
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        try {
          typingChannelRef.current.send({
            type: "broadcast",
            event: "typing",
            payload: {
              user_id: user.id,
              username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
              is_typing: true,
              ghost_text: null,
            },
          });
        } catch (e) {}
      }
    }
  }, [user, myNicknameFromPartner]);

  const sendMessage = useCallback(async () => {
    tabTitleManager.clearUnread();
    setEmojiMatches([]);
    if (!inputText.trim() || !user || !id) return;
    const content = inputText.trim();
    const curEdit = editingMsgId; const curReply = replyingTo; 
    const baseFont = (messageFont && messageFont !== "system") 
      ? messageFont 
      : (chatSettings?.font_family && chatSettings.font_family !== "system" ? chatSettings.font_family : null);
    const curFont = isShimmerActive
      ? (baseFont ? `${baseFont}:shimmer` : "system:shimmer")
      : baseFont;
    setInputText(""); setEditingMsgId(null); setReplyingTo(null); setMessageFont(null); setIsShimmerActive(false); setFontPickerOpen(false);
    
    // Instantly cancel any pending typing debounces and broadcast stop_typing
    if (typingDebounceTimeoutRef.current) {
      clearTimeout(typingDebounceTimeoutRef.current);
      typingDebounceTimeoutRef.current = null;
    }
    if (typingIdleTimeoutRef.current) {
      clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }
    if (typingChannelRef.current && user) {
      try {
        typingChannelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: {
            user_id: user.id,
            username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
            is_typing: false,
            ghost_text: null,
          },
        });
      } catch (e) {}
    }
    
    if (curEdit) {
      setMessages(prev => prev.map(m => m.id === curEdit ? { ...m, text: content } : m));
      const { error } = await supabase.from("messages").update({ content }).eq("id", curEdit).eq("sender_id", user.id);
      if (error) console.error("Update failed", error);
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        sender: user.user_metadata?.username || "Me",
        sender_id: user.id,
        text: content,
        type: "text",
        created_at: new Date().toISOString(),
        created_at_ts: Date.now(),
        time: new Date().toLocaleTimeString(),
        avatar: user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=U",
        isMe: true,
        status: "sending",
        client_id: tempId,
        custom_font: curFont || null,
        reply_to_id: curReply?.id || null,
        reply_to_content: curReply?.text || null,
        reply_to_sender: curReply?.sender || null,
      };
      
      setMessages(prev => [tempMsg, ...prev]);
      checkLiveByeTrigger(tempMsg, messagesRef.current);
      checkLiveLoveTrigger(tempMsg);

      const { data, error } = await supabase.from("messages").insert({
        chat_id: id, sender_id: user.id, content, type: "text",
        reply_to_id: curReply?.id || null, reply_to_content: curReply?.text || null, reply_to_sender: curReply?.sender || null,
        custom_font: curFont || null,
      }).select("id").single();
      
      if (error) {
        console.error("Send failed", error);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
      } else if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? { ...m, id: data.id, client_id: tempId, status: "sent" } : m);
        });
      }
    }
  }, [inputText, user, id, editingMsgId, replyingTo, messageFont, isShimmerActive, chatSettings?.font_family, checkLiveLoveTrigger, triggerMoodWallpaper]);

  const deleteMessage = useCallback(async (msgId: string) => {
    // 1. Optimistically remove from state immediately
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setHoveredMsg(null);

    // 2. Broadcast deletion event immediately to all other participants
    try {
      if (typingChannelRef.current) {
        typingChannelRef.current.send({
          type: "broadcast",
          event: "message_deleted",
          payload: { id: msgId }
        });
      }
    } catch (e) {}

    // 3. Update local storage cache immediately
    AsyncStorage.getItem(`chat_${id}_messages`).then(cached => {
      if (cached) {
        const list = JSON.parse(cached).filter((m: any) => m.id !== msgId);
        AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(list));
      }
    }).catch(() => {});

    // 4. Delete from Supabase database (both hard DELETE and soft UPDATE to guarantee DB persistence across refreshes)
    try {
      let { error } = await supabase.from("messages").delete().eq("id", msgId);
      if (error && user?.id) {
        await supabase.from("messages").delete().eq("id", msgId).eq("sender_id", user.id);
      }
      await supabase.from("messages").update({ type: "deleted", content: "" }).eq("id", msgId);
    } catch (e) {
      console.error("Delete DB error:", e);
    }
  }, [id, user?.id]);

  const handleUploadFiles = useCallback(async (files: (File | Blob)[]) => {
    const selectedFiles = Array.from(files).slice(0, 10);
    if (selectedFiles.length === 0) return;
    setUploadingImage(true);
    const totalFiles = selectedFiles.length;
    setUploadProgress({ active: true, current: 1, total: totalFiles, percent: 0 });

    try {
      const msgs: any[] = [];
      const progressArray = new Array(totalFiles).fill(0);

      const updateOverallProgress = (index: number, pct: number) => {
        progressArray[index] = pct;
        const totalPct = Math.round(progressArray.reduce((a, b) => a + b, 0) / totalFiles);
        const currentFile = Math.min(totalFiles, progressArray.filter(p => p >= 100).length + 1);
        setUploadProgress({ active: true, current: currentFile, total: totalFiles, percent: totalPct });
      };

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const isVideo = file.type?.startsWith("video");
        const prefix = isVideo ? `chat-videos/${id}-${Date.now()}-${i}` : `chat-images/${id}-${Date.now()}-${i}`;
        const url = await uploadBlobToR2(prefix, file, (pct) => updateOverallProgress(i, pct));
        updateOverallProgress(i, 100);
        msgs.push({
          chat_id: id,
          sender_id: user?.id,
          content: url,
          type: isVideo ? "video" : "image",
          reply_to_id: replyingTo?.id || null,
          reply_to_content: replyingTo?.text || null,
          reply_to_sender: replyingTo?.sender || null,
        });
      }
      if (msgs.length > 0) {
        const { data: insertedMsgs, error: insertErr } = await supabase
          .from("messages")
          .insert(msgs)
          .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)");

        if (!insertErr && insertedMsgs && insertedMsgs.length > 0) {
          const formatted = insertedMsgs.map(formatMsg);
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const additions = formatted.filter(m => !existingIds.has(m.id));
            return [...additions, ...prev];
          });
        }
        setReplyingTo(null);
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      alert("Failed to upload file(s): " + (e.message || e));
    } finally {
      setUploadingImage(false);
      setUploadProgress({ active: false, current: 0, total: 0, percent: 0 });
    }
  }, [id, user?.id, replyingTo, formatMsg]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePaste = (e: any) => {
        const items = e.clipboardData?.items;
        if (items) {
          const files: File[] = [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1) {
              const file = items[i].getAsFile();
              if (file) files.push(file);
            }
          }
          if (files.length > 0) {
            handleUploadFiles(files);
          }
        }
      };
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }
  }, [handleUploadFiles]);

  const handlePickImage = useCallback(async () => {
    if (Platform.OS === "web") { if (fileInputRef.current) fileInputRef.current.click(); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const assets = result.assets.slice(0, 10);
      setUploadingImage(true);
      const totalFiles = assets.length;
      setUploadProgress({ active: true, current: 1, total: totalFiles, percent: 0 });

      try {
        const msgs: any[] = [];
        const progressArray = new Array(totalFiles).fill(0);

        const updateOverallProgress = (index: number, pct: number) => {
          progressArray[index] = pct;
          const totalPct = Math.round(progressArray.reduce((a, b) => a + b, 0) / totalFiles);
          const currentFile = Math.min(totalFiles, progressArray.filter(p => p >= 100).length + 1);
          setUploadProgress({ active: true, current: currentFile, total: totalFiles, percent: totalPct });
        };

        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video");
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          const prefix = isVideo ? `chat-videos/${id}-${Date.now()}-${i}` : `chat-images/${id}-${Date.now()}-${i}`;
          const url = await uploadBlobToR2(prefix, blob, (pct) => updateOverallProgress(i, pct));
          updateOverallProgress(i, 100);
          msgs.push({
            chat_id: id,
            sender_id: user?.id,
            content: url,
            type: isVideo ? "video" : "image",
            reply_to_id: replyingTo?.id || null,
            reply_to_content: replyingTo?.text || null,
            reply_to_sender: replyingTo?.sender || null,
          });
        }
        if (msgs.length > 0) {
          const { data: insertedMsgs, error: insertErr } = await supabase
            .from("messages")
            .insert(msgs)
            .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)");

          if (!insertErr && insertedMsgs && insertedMsgs.length > 0) {
            const formatted = insertedMsgs.map(formatMsg);
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const additions = formatted.filter(m => !existingIds.has(m.id));
              return [...additions, ...prev];
            });
          }
          setReplyingTo(null);
        }
      } catch (e: any) {
        console.error("Media pick upload error:", e);
        alert("Failed to upload media: " + (e.message || e));
      } finally {
        setUploadingImage(false);
        setUploadProgress({ active: false, current: 0, total: 0, percent: 0 });
      }
    }
  }, [id, user?.id, replyingTo, formatMsg]);

  const handleWebFileChange = useCallback((e: any) => {
    const files = Array.from(e.target.files || []).slice(0, 10) as File[];
    if (files.length === 0) return;
    handleUploadFiles(files);
    e.target.value = "";
  }, [handleUploadFiles]);

  const getLastSeen = useCallback((d?: string) => {
    if (!d) return "Offline";
    const diff = (Date.now() - new Date(d).getTime()) / 60000;
    if (diff < 5) return "Online";
    if (diff < 60) return `Last seen ${Math.floor(diff)}m ago`;
    if (diff < 1440) return `Last seen ${Math.floor(diff / 60)}h ago`;
    return `Last seen ${Math.floor(diff / 1440)}d ago`;
  }, []);


  const handleSendAlert = useCallback(async (alertData: any) => {
    if (!id || !user) return;
    await supabase.from("messages").insert({
      chat_id: id as string,
      sender_id: user.id,
      content: JSON.stringify(alertData),
      type: "alert"
    });
  }, [id, user]);

  const handleSendVoiceMessage = useCallback(async (blob: Blob, mimeType: string) => {
    if (!id || !user) return;
    setIsRecordingVoice(false);

    const localAudioUrl = Platform.OS === "web" ? URL.createObjectURL(blob) : "";
    const tempId = `temp-${Date.now()}`;
    const curReply = replyingTo;
    setReplyingTo(null);

    const tempMsg: Message = {
      id: tempId,
      sender: user.user_metadata?.username || "Me",
      sender_id: user.id,
      text: localAudioUrl,
      type: "audio",
      created_at: new Date().toISOString(),
      created_at_ts: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      avatar: user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=U",
      isMe: true,
      status: "sending",
      client_id: tempId,
      reply_to_id: curReply?.id || null,
      reply_to_content: curReply?.text || null,
      reply_to_sender: curReply?.sender || null,
    };

    setMessages(prev => [tempMsg, ...prev]);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resultStr = reader.result as string;
          const cleanBase64 = resultStr.includes(",") ? resultStr.split(",")[1] : resultStr;
          const publicUrl = await uploadAudioToR2(id as string, cleanBase64, mimeType);
          
          const { data, error } = await supabase.from("messages").insert({
            chat_id: id,
            sender_id: user.id,
            content: publicUrl,
            type: "audio",
            reply_to_id: curReply?.id || null,
            reply_to_content: curReply?.text || null,
            reply_to_sender: curReply?.sender || null,
          }).select("id").single();

          if (error) {
            console.error("Voice insert failed:", error);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
          } else if (data) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, client_id: tempId, text: publicUrl, status: "sent" } : m));
          }
        } catch (err: any) {
          console.error("Voice upload error:", err);
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
        }
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      console.error("FileReader error:", e);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
    }
  }, [id, user, replyingTo]);

  const handleRespondToAlert = useCallback(async (choice: string) => {
    if (!customAlert || !user || !id) return;
    const alertId = customAlert.messageId;
    const alertTitle = customAlert.title || "Custom Alert";
    const responderName = user.user_metadata?.username || user.email?.split("@")[0] || "User";

    setCustomAlert(null);

    if (alertId) {
      try {
        const handledStr = await AsyncStorage.getItem("@handled_alerts_set").catch(() => null);
        const arr = handledStr ? JSON.parse(handledStr) : [];
        if (!arr.includes(alertId)) {
          arr.push(alertId);
          await AsyncStorage.setItem("@handled_alerts_set", JSON.stringify(arr));
        }
        await supabase.from("messages").delete().eq("id", alertId);
      } catch (e) {}
    }

    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "alert_response",
        payload: {
          alertId,
          choice,
          title: alertTitle,
          responder: responderName,
        },
      });
    }

    await supabase.from("messages").insert({
      chat_id: id,
      sender_id: user.id,
      content: `📢 ${responderName} selected "${choice}" for "${alertTitle}"`,
      type: "system",
    });
  }, [customAlert, user, id]);

  const openChatInfo = useCallback(() => {
    router.push({
      pathname: "/chat-info",
      params: {
        id: id as string,
        isGroup: isGroup ? "true" : "false",
        targetUserId: targetUser?.id || "",
        targetUsername: targetUser?.username || "",
        targetDisplayName: targetUser?.display_name || "",
        targetNickname: targetUser?.nickname || (typeof name === "string" ? name : "") || "",
        targetAvatar: (targetUser?.id && chatAvatars[targetUser.id]) || targetUser?.avatar_url || "",
        targetBio: targetUser?.bio || "",
        groupName: groupChatData?.name || (typeof name === "string" ? name : "") || "",
        groupAvatar: groupChatData?.avatar_url || "",
        wallpaperUrl: chatSettings?.wallpaper_url || "",
        wallpaperBlur: String(chatSettings?.wallpaper_blur || 0),
      },
    });
  }, [router, id, isGroup, targetUser, chatAvatars, name, groupChatData, chatSettings]);

  const handleSaveMessageToMemories = useCallback(async (msg: any) => {
    if (!id || !user || !msg) return;
    try {
      const mediaType = msg.type === "image" ? "image" : msg.type === "video" ? "video" : msg.type === "audio" ? "audio" : "text";
      const mediaUrl = (msg.type === "image" || msg.type === "video" || msg.type === "audio") ? msg.text : null;
      const caption = (msg.type === "text" || !msg.type) ? msg.text : (msg.reply_to_content || "");
      const title = msg.type === "image" ? "Photo Memory" : msg.type === "audio" ? "Voice Note Memory" : `Memory from ${msg.sender || "Chat"}`;

      await addMemory(id as string, user.id, {
        title,
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
        original_message_id: msg.id,
        sender_name: msg.sender,
      });

      showThinkingNotification("Saved to Memories 💕");
    } catch (e) {
      console.error("Failed to save memory:", e);
    }
  }, [id, user, showThinkingNotification]);

  const handleSaveMessageToNotes = useCallback(async (msg: any) => {
    if (!id || !user || !msg) return;
    try {
      const textContent = typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text || "");
      const noteTitle = `Note from ${msg.sender || "Chat"}`;

      await saveNote(id as string, user.id, {
        title: noteTitle,
        content: textContent,
        color: "#5865F2",
      });

      showThinkingNotification("Pinned to Notes & Vault 📝");
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  }, [id, user, showThinkingNotification]);

  // Message context action listener
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleMessageAction = (e: any) => {
        const { action, message } = e.detail || {};
        if (!message) return;
        if (action === "reply") {
          setReplyingTo({ id: message.id, text: message.text, sender: message.sender });
        } else if (action === "pin") {
          handlePinMessage(message);
        } else if (action === "edit") {
          setEditingMsgId(message.id);
          setInputText(message.text);
        } else if (action === "delete") {
          deleteMessage(message.id);
        } else if (action === "profile") {
          openChatInfo();
        } else if (action === "save_memory") {
          handleSaveMessageToMemories(message);
        } else if (action === "save_note") {
          handleSaveMessageToNotes(message);
        }
      };

      window.addEventListener("ala_message_action" as any, handleMessageAction);
      return () => window.removeEventListener("ala_message_action" as any, handleMessageAction);
    }
  }, [handlePinMessage, deleteMessage, openChatInfo, handleSaveMessageToMemories, handleSaveMessageToNotes]);

  // Escape key handler to exit chat to home or close active modals
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.keyCode === 27) {
          if (infoVisible) { setInfoVisible(false); return; }
          if (settingsVisible) { setSettingsVisible(false); return; }
          if (emojiOpen) { setEmojiOpen(false); return; }
          if (stickerPickerOpen) { setStickerPickerOpen(false); return; }
          if (fontPickerOpen) { setFontPickerOpen(false); return; }
          if (imageViewerUrl) { setImageViewerUrl(null); return; }
          
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [infoVisible, settingsVisible, emojiOpen, stickerPickerOpen, fontPickerOpen, imageViewerUrl, router]);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    return (
      <MessageRow isAmoled={isAmoled} styles={styles} theme={theme}
        item={item} index={index} messages={messages} targetUser={targetUser} chatSettings={chatSettings}
        isGroup={isGroup}
        hoveredMsg={hoveredMsg} setHoveredMsg={setHoveredMsg} setReplyingTo={setReplyingTo}
        setEditingMsgId={setEditingMsgId} setInputText={setInputText} deleteMessage={deleteMessage}
        handleApplyWallpaper={handleApplyWallpaper} setSettingsVisible={setSettingsVisible} setImageViewerUrl={setImageViewerUrl}
        handlePinMessage={handlePinMessage}
        isHighlighted={highlightedMsgId === item.id}
        onScrollToMessage={scrollToAndHighlightMessage}
        chatAvatars={chatAvatars}
      />
    );
  }, [messages, hoveredMsg, targetUser, chatSettings, isGroup, handleApplyWallpaper, deleteMessage, handlePinMessage, highlightedMsgId, scrollToAndHighlightMessage, chatAvatars]);

  const screenRadius = (styles.container as any)?.borderRadius ?? theme.screenRadius ?? 0;

  const chatViewContent = (
    <View style={{ flex: 1, height: "100%", backgroundColor: showWallpaper ? "transparent" : (isAmoled ? "#000000" : theme.background), overflow: "hidden", borderRadius: screenRadius }}>
      <AppleIntelligenceGlow visible={!!thinkingOfYou || loveGlowActive} screenRadius={screenRadius} />
      <FloatingHearts active={floatingHeartsActive} onComplete={() => setFloatingHeartsActive(false)} />
      <SleepyByeBlocker
        chatId={currentChatId}
        visible={!!(chatBlockedUntil && new Date(chatBlockedUntil).getTime() > Date.now())}
        blockedUntil={chatBlockedUntil}
        quote={chatBlockQuote}
        targetUsername={myProfile?.display_name || myProfile?.username || user?.user_metadata?.username || user?.user_metadata?.name || "sleepyhead"}
        onUnlocked={() => {
          setChatBlockedUntil(null);
          // Maintain cooldown so unlocking or dismissing doesn't immediately re-trap users
          const now = Date.now();
          const COOLDOWN_DURATION = 15 * 60 * 1000;
          lastBlockTimeRef.current = now;
          cooldownUntilRef.current = Math.max(cooldownUntilRef.current, now + COOLDOWN_DURATION);
          const cdRecord = { cooldownUntil: cooldownUntilRef.current, lastBlockedAt: now };

          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.localStorage.removeItem(`@sleepy_bye_block_${currentChatId}`);
            window.localStorage.setItem(`@sleepy_bye_cooldown_${currentChatId}`, JSON.stringify(cdRecord));
          }
          AsyncStorage.removeItem(`@sleepy_bye_block_${currentChatId}`).catch(() => {});
          AsyncStorage.setItem(`@sleepy_bye_cooldown_${currentChatId}`, JSON.stringify(cdRecord)).catch(() => {});

          supabase.from("chats").update({ blocked_until: null }).eq("id", currentChatId).then(() => {}, () => {});
        }}
      />
      {showWallpaper && (
        <ParallaxWallpaper
          uri={chatSettings!.wallpaper_url}
          zoom={chatSettings?.wallpaper_zoom || 1}
          blur={chatSettings?.wallpaper_blur || 0}
          dim={chatSettings?.wallpaper_dim || 0}
        />
      )}
      {/* Night Screen Soft Dim & Contrast Reduction Overlay */}
      {((chatSettings?.screen_dim || 0) > 0) && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#000000",
              opacity: Math.min(0.72, Math.max(0, (chatSettings.screen_dim || 0) * 0.75)),
              zIndex: 35,
            },
          ]}
        />
      )}
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <View
          style={[
            styles.floatingHeaderWrapper,
            { paddingTop: headerPaddingTop },
            !isDesktop && notchConfig.mode === "edge_dot" && { paddingLeft: 16 },
          ]}
        >
          {notchConfig.cameraTargetGuide && !isDesktop && (
            <DynamicCameraGuide topOffset={notchConfig.topOffset} />
          )}
          {!isSearchActive ? (
            <RNAnimated.View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                gap: 8,
                opacity: searchHeaderAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              }}
            >
              {isDesktop ? (
                <TouchableOpacity
                  onPress={toggleSidebar}
                  style={[
                    styles.headerPill,
                    styles.headerBackPill,
                    headerGlassStyle,
                  ]}
                  activeOpacity={0.7}
                  accessibilityLabel={sidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen size={22} color={headerIconColor} />
                  ) : (
                    <PanelLeftClose size={22} color={headerIconColor} />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
                  style={[
                    styles.headerPill,
                    styles.headerBackPill,
                    headerGlassStyle,
                    isDynamicIslandActive && {
                      height: effectivePillHeight,
                      width: effectivePillHeight,
                      borderRadius: effectivePillHeight / 2,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityLabel="Back"
                >
                  <ChevronLeft size={24} color={headerIconColor} />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[
                  styles.headerPill,
                  styles.headerProfilePill,
                  headerGlassStyle,
                  isDynamicIslandActive && {
                    height: effectivePillHeight,
                    borderRadius: effectivePillHeight / 2,
                    backgroundColor: isAmoled
                      ? "#000000"
                      : "rgba(10, 12, 18, 0.94)",
                    borderColor: isHeartGlowing
                      ? "#f43f5e"
                      : "rgba(255, 255, 255, 0.16)",
                    ...(Platform.OS === "web" && isHeartGlowing
                      ? { boxShadow: "0 0 20px rgba(244, 63, 94, 0.75)" }
                      : {}),
                  },
                ]}
                onPress={openChatInfo} 
                activeOpacity={0.8}
              >
                {isGroup ? (
                  <View style={[styles.floatingAvatar, { backgroundColor: isAmoled ? '#222' : theme.accent, justifyContent: "center", alignItems: "center" }]}>
                    <Users size={18} color="#fff" />
                  </View>
                ) : ((targetUser?.id && chatAvatars[targetUser.id]) || targetUser?.avatar_url) ? (
                  <Image source={{ uri: (targetUser?.id && chatAvatars[targetUser.id]) || targetUser?.avatar_url }} style={styles.floatingAvatar} />
                ) : (
                  <View style={[styles.floatingAvatar, { backgroundColor: isAmoled ? '#222' : theme.accent, justifyContent: "center", alignItems: "center" }]}>
                    <User size={18} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}>
                  <Text 
                    style={[
                      styles.headerTitle, 
                      { color: isAmoled ? "#ffffff" : (theme.id === "light" ? "#111111" : theme.id === "pink" ? "#5c0a2e" : "#ffffff") },
                      chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
                    ]} 
                    numberOfLines={1}
                  >
                    {isGroup ? (groupChatData?.name || name || "Group Chat") : (targetUser?.nickname || targetUser?.display_name || targetUser?.username || name || "chat")}
                  </Text>
                  {isDynamicIslandActive && notchConfig.dynamicAnimationsEnabled && audioState.isPlaying ? (
                    <Text style={[styles.lastSeenText, { color: "#10b981", fontWeight: "600" }]} numberOfLines={1}>
                      {audioState.title ? `Playing ${audioState.title}...` : "Playing audio letter..."}
                    </Text>
                  ) : isDynamicIslandActive && notchConfig.dynamicAnimationsEnabled && isTyping ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.lastSeenText, { color: theme.accent || "#5865F2", fontWeight: "600" }]} numberOfLines={1}>
                        {typingUsername ? `${typingUsername} is typing` : "typing"}
                      </Text>
                      <DynamicTypingDots color={theme.accent || "#5865F2"} active={true} />
                    </View>
                  ) : isGroup ? (
                    <Text style={[styles.groupSubtitle, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>
                      {groupMemberCount > 0 ? `${groupMemberCount} members` : "Group"}
                    </Text>
                  ) : targetUser ? (
                    <Text style={[
                      styles.lastSeenText, 
                      !isTargetOnline && styles.offlineText,
                      chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
                    ]}>
                      {formatLastSeenText(targetUser, isTargetOnline)}
                    </Text>
                  ) : null}
                </View>

                {/* Dynamic Island Animated Indicator on the Right Side */}
                {isDynamicIslandActive && notchConfig.dynamicAnimationsEnabled && audioState.isPlaying && (
                  <View style={{ marginRight: 8 }}>
                    <DynamicEqualizerBars color="#10b981" active={true} />
                  </View>
                )}
                {isDynamicIslandActive && notchConfig.dynamicAnimationsEnabled && !audioState.isPlaying && isTyping && (
                  <View style={{ marginRight: 8 }}>
                    <DynamicTypingDots color={theme.accent || "#5865F2"} active={true} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={[
                styles.headerPill,
                styles.headerActionsPill,
                headerGlassStyle,
                isDynamicIslandActive && {
                  height: effectivePillHeight,
                  borderRadius: effectivePillHeight / 2,
                },
              ]}>
                {!isGroup && (
                  <TouchableOpacity
                    style={[
                      styles.floatingIconBtn,
                      isHeartGlowing && {
                        backgroundColor: "rgba(244, 63, 94, 0.25)",
                        borderRadius: 9999,
                        shadowColor: "#f43f5e",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 16,
                        elevation: 10,
                        ...(Platform.OS === "web" ? {
                          boxShadow: "0 0 16px #f43f5e, 0 0 30px rgba(244, 63, 94, 0.8)",
                        } : {}),
                      }
                    ]}
                    onPress={triggerHeartPing}
                    activeOpacity={0.7}
                    accessibilityLabel="Send heart ping"
                  >
                    <RNAnimated.View style={{
                      transform: [{ scale: heartAnim }],
                      opacity: isHeartGlowing ? heartAnim.interpolate({
                        inputRange: [1, 1.15, 1.35],
                        outputRange: [1, 0.45, 1]
                      }) : 1
                    }}>
                      <Heart
                        size={20}
                        color="#f43f5e"
                        fill={isHeartGlowing || chatSettings?.anniversary_date ? "#f43f5e" : (theme.id === "pink" ? "#f472b6" : "rgba(244, 63, 94, 0.35)")}
                      />
                    </RNAnimated.View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.floatingIconBtn}
                  onPress={() => (moreMenuVisible ? closeMoreMenu() : openMoreMenu())}
                  activeOpacity={0.7}
                  accessibilityLabel="More options"
                >
                  <MoreVertical size={20} color={headerIconColor} />
                </TouchableOpacity>
              </View>
            </RNAnimated.View>
          ) : (
            <RNAnimated.View
              style={[
                styles.headerPill,
                headerGlassStyle,
                {
                  flex: 1,
                  height: effectivePillHeight,
                  paddingHorizontal: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: searchHeaderAnim,
                  transform: [
                    {
                      scale: searchHeaderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={closeSearch}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 4,
                }}
                activeOpacity={0.7}
                accessibilityLabel="Close search"
              >
                <ChevronLeft size={22} color={headerIconColor} />
              </TouchableOpacity>

              <Search size={18} color={theme.textMuted} style={{ marginRight: 6 }} />

              <TextInput
                ref={searchInputRef}
                style={{
                  flex: 1,
                  height: 40,
                  color: headerTextColor,
                  fontSize: 15,
                  fontFamily: "Josefin Sans",
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  outlineStyle: "none",
                } as any}
                placeholder="Search messages..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleNextMatch}
                autoFocus
                returnKeyType="search"
              />

              {searchQuery.trim().length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  {isSearchingDb ? (
                    <ActivityIndicator size="small" color={theme.accent || "#5865F2"} style={{ marginHorizontal: 6 }} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Josefin Sans",
                        color: theme.textMuted,
                        marginHorizontal: 4,
                      }}
                    >
                      {searchMatches.length > 0
                        ? `${currentMatchIdx + 1}/${searchMatches.length}`
                        : "0 found"}
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handlePrevMatch}
                    disabled={searchMatches.length === 0}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      justifyContent: "center",
                      alignItems: "center",
                      opacity: searchMatches.length === 0 ? 0.3 : 1,
                    }}
                    accessibilityLabel="Previous match"
                  >
                    <ChevronUp size={18} color={headerIconColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNextMatch}
                    disabled={searchMatches.length === 0}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      justifyContent: "center",
                      alignItems: "center",
                      opacity: searchMatches.length === 0 ? 0.3 : 1,
                    }}
                    accessibilityLabel="Next match"
                  >
                    <ChevronDown size={18} color={headerIconColor} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  if (searchQuery) {
                    handleSearchChange("");
                  } else {
                    closeSearch();
                  }
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  marginLeft: 2,
                }}
                activeOpacity={0.7}
                accessibilityLabel="Clear query or close"
              >
                <X size={17} color={theme.textMuted} />
              </TouchableOpacity>
            </RNAnimated.View>
          )}
        </View>

        {/* ANIMATED ⋮ DROPDOWN MENU */}
        {moreMenuVisible && (
          <>
            <Pressable
              style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
              onPress={closeMoreMenu}
            />

            <RNAnimated.View
              style={[
                styles.moreDropdownMenu,
                headerGlassStyle,
                {
                  top: headerPaddingTop + effectivePillHeight + 6,
                  opacity: moreMenuAnim,
                  transform: [
                    {
                      translateY: moreMenuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-12, 0],
                      }),
                    },
                    {
                      scale: moreMenuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Item 1: Search in Chat */}
              <TouchableOpacity
                style={styles.moreDropdownItem}
                onPress={openSearch}
                activeOpacity={0.7}
              >
                <View style={[styles.moreDropdownIconCircle, { backgroundColor: isAmoled ? '#222' : (theme.id === 'pink' ? '#fbcfe8' : 'rgba(88,101,242,0.12)') }]}>
                  <Search size={16} color={theme.accent} />
                </View>
                <Text style={[styles.moreDropdownItemText, { color: theme.text }]}>
                  Search in Chat
                </Text>
              </TouchableOpacity>

              <View style={[styles.moreDropdownDivider, { backgroundColor: isAmoled ? '#222' : (theme.id === 'pink' ? 'rgba(219,39,119,0.12)' : theme.border) }]} />

              {/* Item 2: Chat Settings & Wallpaper */}
              <TouchableOpacity
                style={styles.moreDropdownItem}
                onPress={() => {
                  closeMoreMenu();
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.moreDropdownIconCircle, { backgroundColor: isAmoled ? '#222' : (theme.id === 'pink' ? '#fbcfe8' : 'rgba(88,101,242,0.12)') }]}>
                  <Settings size={16} color={theme.accent} />
                </View>
                <Text style={[styles.moreDropdownItemText, { color: theme.text }]}>
                  Chat Settings & Wallpaper
                </Text>
              </TouchableOpacity>

              <View style={[styles.moreDropdownDivider, { backgroundColor: isAmoled ? '#222' : (theme.id === 'pink' ? 'rgba(219,39,119,0.12)' : theme.border) }]} />

              {/* Item 3: Chat Info & Media */}
              <TouchableOpacity
                style={styles.moreDropdownItem}
                onPress={() => {
                  closeMoreMenu();
                  openChatInfo();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.moreDropdownIconCircle, { backgroundColor: isAmoled ? '#222' : (theme.id === 'pink' ? '#fbcfe8' : 'rgba(88,101,242,0.12)') }]}>
                  {isGroup ? <Users size={16} color={theme.accent} /> : <User size={16} color={theme.accent} />}
                </View>
                <Text style={[styles.moreDropdownItemText, { color: theme.text }]}>
                  {isGroup ? "Group Info & Media" : "Chat Info & Media"}
                </Text>
              </TouchableOpacity>
            </RNAnimated.View>
          </>
        )}

        {pinnedMessage && (
          <View style={{
            position: "absolute",
            top: Platform.OS === "web" ? (isDesktop ? 70 : 80) : (Platform.OS === "ios" ? 104 : 96),
            left: isDesktop ? 20 : 10,
            right: isDesktop ? 20 : 10,
            zIndex: 40,
            backgroundColor: isAmoled ? "rgba(0,0,0,0.92)" : (showWallpaper ? "rgba(20,20,30,0.85)" : (theme.id === "light" ? "rgba(255,255,255,0.92)" : "rgba(43,45,49,0.88)")),
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: isAmoled ? "#222" : "rgba(255,255,255,0.1)",
          }}>
            <TouchableOpacity
              style={[{ flex: 1, flexDirection: "row", alignItems: "center" }, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
              activeOpacity={0.7}
              onPress={() => scrollToAndHighlightMessage(pinnedMessage.id)}
            >
              <Pin size={16} color={theme.accent || "#5865F2"} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.accent || "#5865F2", fontFamily: "Josefin Sans" }}>Pinned Message</Text>
                <Text style={{ fontSize: 13, color: isAmoled ? "#fff" : theme.text, fontFamily: "Josefin Sans" }} numberOfLines={1}>{pinnedMessage.text}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handlePinMessage(null)} style={{ padding: 4 }}>
              <X size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {thinkingOfYou && (
          <RNAnimated.View
            pointerEvents="none"
            style={[
              styles.thinkingOfYouBanner,
              isAmoled ? { backgroundColor: 'rgba(0,0,0,0.88)', borderColor: 'rgba(244,63,94,0.45)' } :
              showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.7)', borderColor: 'rgba(244,63,94,0.4)' } :
              theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'rgba(244,63,94,0.35)' } :
              theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.94)', borderColor: 'rgba(244,63,94,0.45)' } :
              { backgroundColor: 'rgba(35,37,42,0.92)', borderColor: 'rgba(244,63,94,0.4)' },
              {
                top: pinnedMessage
                  ? (Platform.OS === "web" ? (isDesktop ? 124 : 134) : (Platform.OS === "ios" ? 158 : 150))
                  : (Platform.OS === "web" ? (isDesktop ? 70 : 92) : (Platform.OS === "ios" ? 116 : 108)),
                opacity: thinkingAnim,
                transform: [
                  {
                    translateY: thinkingAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0]
                    })
                  },
                  {
                    scale: thinkingAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1]
                    })
                  }
                ]
              }
            ]}
          >
            <Heart size={16} color="#f43f5e" fill="#f43f5e" style={{ marginRight: 8 }} />
            <ShinyText
              text={thinkingOfYou.text}
              speed={1.6}
              color="#f43f5e"
              shineColor="#ffffff"
              spread={120}
              style={[
                styles.thinkingOfYouText,
                chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
              ]}
            />
          </RNAnimated.View>
        )}
        <DoodleOverlay type={chatSettings?.wallpaper_doodle || "none"} />

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.hashCircle}><Hash size={36} color={isAmoled ? "#ffffff" : theme.text} /></View>
            <Text style={[styles.welcomeTitle, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>
              Welcome to #{name || "chat"}!
            </Text>
            <Text style={[styles.welcomeSubtitle, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>
              This is the start of your direct messages with {targetUser?.nickname || name || targetUser?.username}.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.client_id || item.id}
            inverted
            initialNumToRender={20}
            windowSize={21}
            removeClippedSubviews={false}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            onTouchStart={() => {
              if (fontPickerOpen) setFontPickerOpen(false);
              if (isGlassKeyboardOpen) setIsGlassKeyboardOpen(false);
            }}
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 10 }} /> : null}
            style={[{ flex: 1 }, Platform.OS === 'web' && ({ overscrollBehaviorY: 'contain' } as any)]}
            contentContainerStyle={[
              styles.listContainer,
              !isDesktop && {
                paddingTop: (Platform.OS === "web" ? 82 : 98) + (notchConfig.topOffset || 0) + (notchConfig.mode === "floating_breathe" ? 16 : 0),
              },
              isGlassKeyboardOpen && !isDesktop && {
                paddingTop: (Platform.OS === "web" ? (isDesktop ? 74 : 82) : 98) + 290,
              },
            ]}
            showsVerticalScrollIndicator={false}
            extraData={highlightedMsgId}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 100);
            }}
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
          <View style={[
            styles.inputArea,
            {
              bottom: viewportBottom,
              paddingBottom: isGlassKeyboardOpen ? 0 : (viewportBottom > 0 ? 6 : (Platform.OS === "web" ? (isDesktop ? 16 : 22) : (Platform.OS === "ios" ? 28 : 16)))
            },
            showWallpaper && { backgroundColor: "transparent" }
          ]}>
            <View style={{
              width: "100%",
              paddingHorizontal: isDesktop ? 20 : 10,
              paddingTop: 8,
              paddingBottom: isGlassKeyboardOpen ? 6 : 0,
            }}>
            {isTyping && (
              <View style={[
                styles.typingBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' },
                ghostText ? { paddingVertical: 6, paddingHorizontal: 12 } : {}
              ]}>
                {ghostText ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ghost size={14} color={theme.accent || "#a855f7"} />
                      <Text style={[
                        styles.typingText,
                        { fontWeight: "700", color: theme.accent || "#a855f7" },
                        chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
                      ]}>
                        {typingUsername || targetUser?.nickname || targetUser?.username || name || "Someone"}:
                      </Text>
                    </View>
                    <Text
                      numberOfLines={2}
                      ellipsizeMode="head"
                      style={[
                        styles.typingText,
                        {
                          color: isAmoled ? "#ffffff" : (theme.id === "light" || theme.id === "pink" ? "#333333" : "#ffffff"),
                          fontStyle: "italic",
                          opacity: 0.92,
                          flexShrink: 1,
                        },
                        chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
                      ]}
                    >
                      "{ghostText}"
                    </Text>
                    <Text style={[styles.typingText, { color: isAmoled ? "#ffffff" : (theme.id === "light" || theme.id === "pink" ? "#333333" : "#ffffff") }]}>
                      <SendingDots />
                    </Text>
                  </View>
                ) : (
                  <>
                    <ShinyText
                      text={`${typingUsername || targetUser?.nickname || targetUser?.username || name || "Someone"} is typing`}
                      speed={2}
                      color={isAmoled ? "#aaaaaa" : (theme.id === "light" ? "#4b5563" : "#d1d5db")}
                      shineColor={isAmoled ? "#ffffff" : (theme.id === "light" ? "#111827" : "#ffffff")}
                      spread={120}
                      style={[
                        styles.typingText,
                        { color: isAmoled ? "#ffffff" : (theme.id === "light" || theme.id === "pink" ? "#333333" : "#ffffff") },
                        chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
                      ]}
                    />
                    <Text style={[styles.typingText, { color: isAmoled ? "#ffffff" : (theme.id === "light" || theme.id === "pink" ? "#333333" : "#ffffff") }]}>
                      <SendingDots />
                    </Text>
                  </>
                )}
              </View>
            )}

            {uploadProgress.active && (
              <View style={[
                styles.editingBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' },
                {
                  flexDirection: "column",
                  alignItems: "stretch",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                }
              ]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ color: isAmoled ? "#ffffff" : theme.text, fontSize: 13, fontWeight: "600" }}>
                    Uploading {uploadProgress.current} of {uploadProgress.total} media...
                  </Text>
                  <Text style={{ color: theme.accent || "#5865F2", fontSize: 13, fontWeight: "bold" }}>
                    {uploadProgress.percent}%
                  </Text>
                </View>
                <View style={{ height: 6, width: "100%", backgroundColor: isAmoled ? "#222222" : "rgba(0,0,0,0.15)", borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${uploadProgress.percent}%`, backgroundColor: theme.accent || "#5865F2", borderRadius: 3 }} />
                </View>
              </View>
            )}

            {replyingTo && (
              <View style={[
                styles.replyBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                  activeOpacity={0.7}
                  onPress={() => scrollToAndHighlightMessage(replyingTo.id)}
                >
                  <Reply size={16} color={isAmoled ? "#ffffff" : theme.accent} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyBannerSender, { color: theme.accent }, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>{replyingTo.sender}</Text>
                    {replyingTo.text?.startsWith("http") ? (
                      <Image source={{ uri: replyingTo.text }} style={{ width: 32, height: 32, borderRadius: 4, marginTop: 4 }} resizeMode="cover" />
                    ) : (
                      <Text style={[styles.replyBannerText, { color: isAmoled ? "#aaaaaa" : theme.textMuted }]} numberOfLines={1}>{replyingTo.text}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={20} color={isAmoled ? "#888888" : theme.textMuted} /></TouchableOpacity>
              </View>
            )}

            {editingMsgId && (
              <View style={[
                styles.editingBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <Text style={[styles.editingBannerText, { color: isAmoled ? "#ffffff" : theme.text }]}>Editing Message</Text>
                <TouchableOpacity onPress={() => { setEditingMsgId(null); setInputText(""); }}><X size={16} color={isAmoled ? "#888888" : theme.textMuted} /></TouchableOpacity>
              </View>
            )}

            {fontPickerOpen && (
              <View 
                nativeID="font-picker-tray"
                {...({ id: "font-picker-tray" } as any)}
                style={{
                  backgroundColor: isAmoled ? "#111" : theme.surface,
                  padding: 12,
                  borderRadius: 16,
                  marginBottom: 8,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: isShimmerActive ? (theme.id === "pink" ? "#f472b6" : "#c084fc") : "rgba(255,255,255,0.08)"
                }}>
                {/* Top Action Row: Shimmer Effect Toggle + Rich Text Format Helpers */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => setIsShimmerActive(prev => !prev)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: isShimmerActive
                        ? (theme.id === "pink" ? "rgba(244, 63, 94, 0.22)" : "rgba(192, 132, 252, 0.25)")
                        : (isAmoled ? "#1c1c1c" : "rgba(255,255,255,0.06)"),
                      borderWidth: 1,
                      borderColor: isShimmerActive
                        ? (theme.id === "pink" ? "#f43f5e" : "#c084fc")
                        : "rgba(255,255,255,0.12)",
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={14} color={isShimmerActive ? (theme.id === "pink" ? "#f43f5e" : "#c084fc") : theme.textMuted} />
                    <Text style={{
                      fontSize: 12,
                      fontWeight: "700",
                      fontFamily: "Josefin Sans",
                      color: isShimmerActive ? (theme.id === "pink" ? "#f43f5e" : "#c084fc") : theme.textMuted,
                    }}>
                      {isShimmerActive ? "✨ Shimmer: ON" : "✨ Shimmer: OFF"}
                    </Text>
                  </TouchableOpacity>

                  {/* Markdown Quick Format Helpers */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => applyTextFormat("*")}
                      style={styles.formatChip}
                      accessibilityLabel="Bold"
                    >
                      <Bold size={13} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => applyTextFormat("_")}
                      style={styles.formatChip}
                      accessibilityLabel="Italic"
                    >
                      <Italic size={13} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => applyTextFormat("~")}
                      style={styles.formatChip}
                      accessibilityLabel="Strikethrough"
                    >
                      <Strikethrough size={13} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => applyTextFormat("`")}
                      style={styles.formatChip}
                      accessibilityLabel="Monospace Code"
                    >
                      <Code size={13} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setFontPickerOpen(false)}
                      style={[styles.formatChip, { backgroundColor: isAmoled ? "#222" : "rgba(255,255,255,0.06)", marginLeft: 2 }]}
                      accessibilityLabel="Close Font Picker"
                    >
                      <X size={13} color={isAmoled ? "#aaa" : theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={{ color: isAmoled ? "#aaa" : theme.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 8, fontFamily: "Josefin Sans" }}>Select Font for this Message</Text>
                <FlatList
                  horizontal
                  data={FONT_OPTIONS}
                  keyExtractor={(item) => item.value}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        backgroundColor: messageFont === item.value ? theme.accent : (isAmoled ? "#222" : "rgba(255,255,255,0.08)"),
                        borderRadius: 14,
                        marginRight: 8,
                      }}
                      onPress={() => setMessageFont(item.value)}
                    >
                      <Text style={{ 
                        color: messageFont === item.value ? "#fff" : (isAmoled ? "#ddd" : theme.text), 
                        fontFamily: item.value === "system" ? undefined : item.value,
                        fontSize: 13,
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Discord-style colon emoji search autocomplete */}
            <EmojiAutocomplete
              matches={emojiMatches}
              selectedIndex={selectedEmojiIdx}
              onSelect={handleSelectAutocompleteEmoji}
              theme={theme}
              isAmoled={isAmoled}
            />

            <View style={styles.inputAreaRow}>
              {isRecordingVoice ? (
                <VoiceRecorder onSendAudio={handleSendVoiceMessage} onCancel={() => setIsRecordingVoice(false)} />
              ) : (
                <>
                  <View style={[
                    styles.inputWrapper,
                    isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                    showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                    theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                    theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                    { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' },
                    inputText.includes("\n") ? { height: undefined, minHeight: 46, maxHeight: 120 } : { height: 46 }
                  ]}>
                    <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={uploadingImage}>
                      {uploadingImage ? <ActivityIndicator size="small" color="#ffffff" /> : <Plus size={20} color="#ffffff" />}
                    </TouchableOpacity>
                    {Platform.OS === "web" && (
                      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" } as any} onChange={handleWebFileChange} />
                    )}
                    {isDesktop && isFeatureEnabled("custom_fonts", myProfile, publicFeatures) && (
                      <TouchableOpacity 
                        nativeID="font-picker-trigger"
                        {...({ id: "font-picker-trigger" } as any)}
                        style={styles.inputIconButton} 
                        onPress={() => {
                          if (isGlassKeyboardOpen) setIsGlassKeyboardOpen(false);
                          setFontPickerOpen(!fontPickerOpen);
                        }}
                      >
                        <Type size={20} color={fontPickerOpen || isShimmerActive ? (theme.id === "pink" ? "#f43f5e" : "#c084fc") : (theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted))} />
                      </TouchableOpacity>
                    )}
                    {isDesktop && (
                      <TouchableOpacity 
                        style={styles.inputIconButton} 
                        onPress={() => {
                          if (isGlassKeyboardOpen) setIsGlassKeyboardOpen(false);
                          setStickerPickerOpen(true);
                        }}
                      >
                        <Sticker size={20} color={theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted)} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.inputIconButton} 
                      onPress={() => {
                        if (isGlassKeyboardOpen) setIsGlassKeyboardOpen(false);
                        setEmojiOpen(true);
                      }}
                    >
                      <Smile size={20} color={theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted)} />
                    </TouchableOpacity>
                    {!isDesktop && isFeatureEnabled("glass_keyboard", myProfile, publicFeatures) && (
                      <TouchableOpacity 
                        style={styles.inputIconButton} 
                        onPress={() => {
                          if (isGlassKeyboardOpen) {
                            setIsGlassKeyboardOpen(false);
                            textInputRef.current?.focus();
                          } else {
                            Keyboard.dismiss();
                            setEmojiOpen(false);
                            setStickerPickerOpen(false);
                            setFontPickerOpen(false);
                            setIsGlassKeyboardOpen(true);
                          }
                        }}
                        accessibilityLabel="Toggle AlaGlass Keyboard"
                      >
                        <KeyboardIcon 
                          size={20} 
                          color={isGlassKeyboardOpen 
                            ? (theme.id === "pink" ? "#f43f5e" : (theme.accent || "#5865F2")) 
                            : (theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted))} 
                        />
                      </TouchableOpacity>
                    )}
                    <TextInput 
                      ref={textInputRef}
                      showSoftInputOnFocus={!isGlassKeyboardOpen}
                      inputMode={isGlassKeyboardOpen ? "none" : "text"}
                      style={[
                        styles.textInput, 
                        (messageFont && messageFont !== "system") 
                          ? { fontFamily: messageFont } 
                          : (chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}),
                        inputText.includes("\n") ? { height: undefined, minHeight: 24, maxHeight: 100 } : { height: 24 }
                      ]} 
                      placeholder={`Message #${name || "chat"}`} 
                      placeholderTextColor={theme.id === "pink" ? "rgba(244, 114, 182, 0.6)" : (isAmoled ? "#888888" : theme.textMuted)}
                      value={inputText}
                      onChangeText={handleInputChange}
                      onFocus={() => {
                        tabTitleManager.clearUnread();
                        if (Platform.OS === "web" && typeof window !== "undefined") {
                          setTimeout(() => {
                            window.scrollTo(0, 0);
                            document.documentElement.scrollTop = 0;
                            document.body.scrollTop = 0;
                          }, 50);
                        }
                      }}
                      onKeyPress={(e: any) => {
                        if (emojiMatches.length > 0) {
                          if (e.nativeEvent.key === "ArrowDown") {
                            e.preventDefault?.();
                            setSelectedEmojiIdx(prev => (prev + 1) % emojiMatches.length);
                            return;
                          }
                          if (e.nativeEvent.key === "ArrowUp") {
                            e.preventDefault?.();
                            setSelectedEmojiIdx(prev => (prev - 1 + emojiMatches.length) % emojiMatches.length);
                            return;
                          }
                          if (e.nativeEvent.key === "Tab" || (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey)) {
                            e.preventDefault?.();
                            const chosen = emojiMatches[selectedEmojiIdx];
                            if (chosen) {
                              handleSelectAutocompleteEmoji(chosen.emoji);
                              return;
                            }
                          }
                          if (e.nativeEvent.key === "Escape") {
                            e.preventDefault?.();
                            setEmojiMatches([]);
                            return;
                          }
                        }

                        if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      multiline />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.circularSendBtn,
                      isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                      showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                      theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                      theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                      { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
                    ]}
                    onPress={() => {
                      if (inputText.trim()) {
                        sendMessage();
                      } else {
                        setIsRecordingVoice(true);
                      }
                    }}
                  >
                    {inputText.trim() ? (
                      chatSettings?.send_button_emoji ? (
                        <Text style={{ fontSize: 22 }}>{chatSettings.send_button_emoji}</Text>
                      ) : (
                        <Send
                          size={22}
                          color={theme.accent || "#5865F2"}
                          style={{ marginLeft: 2 }}
                        />
                      )
                    ) : (
                      <Mic size={22} color={theme.accent || "#5865F2"} />
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
            </View>
            {isGlassKeyboardOpen && !isDesktop && isFeatureEnabled("glass_keyboard", myProfile, publicFeatures) && (
              <AlaGlassKeyboard
                onInsertText={(char) => handleInputChange(inputText + char)}
                onBackspace={() => handleInputChange(inputText.slice(0, -1))}
                onSend={sendMessage}
                onClose={() => setIsGlassKeyboardOpen(false)}
                onSwitchToSystem={() => {
                  setIsGlassKeyboardOpen(false);
                  setTimeout(() => textInputRef.current?.focus(), 100);
                }}
                theme={theme}
                isAmoled={isAmoled}
                onOpenFontPicker={() => {
                  setIsGlassKeyboardOpen(false);
                  setFontPickerOpen(true);
                }}
                onToggleShimmer={() => setIsShimmerActive(prev => !prev)}
                isShimmerActive={isShimmerActive}
                onOpenEmoji={() => {
                  setIsGlassKeyboardOpen(false);
                  setEmojiOpen(true);
                }}
                onOpenStickers={() => {
                  setIsGlassKeyboardOpen(false);
                  setStickerPickerOpen(true);
                }}
                onToggleBold={toggleBold}
                onToggleItalic={toggleItalic}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {stickerPickerOpen && user && (
        <StickerPicker 
          visible={true}
          onClose={() => setStickerPickerOpen(false)} 
          chatId={id as string} 
          userId={user.id} 
          onSelectSticker={(url) => {
            supabase.from('messages').insert({
              chat_id: id as string,
              sender_id: user.id,
              content: url,
              type: 'sticker',
              reply_to_id: replyingTo?.id || null,
              reply_to_content: replyingTo?.text || null,
              reply_to_sender: replyingTo?.sender || null
            }).then();
            setReplyingTo(null);
          }} 
        />
      )}
      <CustomEmojiPicker 
        onEmojiSelected={(emoji) => setInputText(prev => prev + emoji.emoji)} 
        open={emojiOpen} 
        onClose={() => setEmojiOpen(false)} 
      />
      {settingsVisible && user && (
        <ChatSettingsModal 
          visible={settingsVisible} 
          onClose={() => setSettingsVisible(false)} 
          chatId={id as string} 
          userId={user.id} 
          isGroup={isGroup}
          targetUser={targetUser}
          currentSettings={chatSettings} 
          onSettingsSaved={(newSettings) => {
            setChatSettings(newSettings);
            if (newSettings.wallpaper_deck) {
              setWallpaperDeck(newSettings.wallpaper_deck);
              wallpaperDeckRef.current = newSettings.wallpaper_deck;
            }
            if (newSettings.partner_nickname !== undefined || newSettings.nickname !== undefined) {
              const newNick = newSettings.partner_nickname || newSettings.nickname || null;
              setTargetUser((prev: any) => prev ? { ...prev, nickname: newNick } : prev);
            }
          }} 
          onSendAlert={handleSendAlert} 
          myProfile={myProfile}
          publicFeatures={publicFeatures}
          chatAvatars={chatAvatars}
          onChatAvatarUpdated={(uId, url) => setChatAvatars(prev => ({ ...prev, [uId]: url }))}
        />
      )}
      {infoVisible && user && (
        <ChatInfoModal 
          visible={infoVisible} 
          onClose={() => setInfoVisible(false)} 
          chatId={id as string} 
          isGroup={isGroup} 
          targetUser={targetUser} 
          currentUserId={user.id}
          chatAvatar={targetUser?.id ? chatAvatars[targetUser.id] : null}
          onGroupUpdated={(updated) => {
            setGroupChatData((prev: any) => ({ ...prev, ...updated }));
          }}
          onOpenImageViewer={(url) => setImageViewerUrl(url)}
        />
      )}
      <ZoomableImageViewer
        visible={!!imageViewerUrl}
        imageUrl={imageViewerUrl}
        onClose={() => setImageViewerUrl(null)}
        onDownload={handleDownloadImage}
        onCopy={handleCopyImage}
        viewerToast={viewerToast}
      />
      <Modal visible={!!customAlert} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 440, backgroundColor: '#313338', borderRadius: 8, overflow: 'hidden' }}>
            <View style={{ padding: 24, paddingBottom: 16 }}>
              <Text style={{ color: '#f2f3f5', fontSize: 20, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 }}>{customAlert?.title}</Text>
              <Text style={{ color: '#dbdee1', fontSize: 16, lineHeight: 22 }}>{customAlert?.message}</Text>
            </View>
            <View style={{ backgroundColor: '#2b2d31', padding: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => handleRespondToAlert(customAlert?.cancelText || "Cancel")} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: '#f2f3f5', fontSize: 15, fontWeight: '500' }}>{customAlert?.cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRespondToAlert(customAlert?.actionText || "Action")} style={{ backgroundColor: '#f23f43', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{customAlert?.actionText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: isAmoled ? "#000000" : theme.background, overflow: "hidden" }}>
        {!sidebarCollapsed && (
          <View style={{ width: 380, height: "100%", zIndex: 10, backgroundColor: isAmoled ? "#000000" : theme.background, overflow: "hidden" }}>
            <ChatSidebar
              activeChatId={id as string}
              onSelectChat={(selectedId, selectedName) => {
                if (selectedId === id) return;
                router.replace({ pathname: "/chat", params: { id: selectedId, name: selectedName } });
              }}
              onToggleCollapse={toggleSidebar}
            />
          </View>
        )}
        <View key={id as string} style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden", borderRadius: screenRadius }}>
          {chatViewContent}
        </View>
      </View>
    );
  }

  return chatViewContent;
}

const createStyles = (isAmoled: boolean, theme: any, isDesktop: boolean = false) => {
  const bg = isAmoled ? '#000000' : theme.background;
  const surface = isAmoled ? '#000000' : (theme.surface || '#2b2d31');
  const border = isAmoled ? '#222222' : (theme.border || '#1e1f22');
  const text = isAmoled ? '#ffffff' : (theme.text || '#dbdee1');
  const textMuted = isAmoled ? '#888888' : (theme.textMuted || '#949ba4');
  const accent = isAmoled ? '#ffffff' : (theme.accent || '#5865F2');
  const inputBg = isAmoled ? '#000000' : (theme.surface || '#2b2d31');
  const screenRadius = theme.screenRadius ?? 0;

  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: bg },
  container: { flex: 1, height: "100%", backgroundColor: bg, maxWidth: "100%" as any, width: "100%", borderLeftWidth: 0, borderRightWidth: 0, overflow: "hidden", borderRadius: screenRadius },
  floatingHeaderWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: isDesktop ? 20 : 10,
    paddingTop: Platform.OS === "ios" ? 52 : (isDesktop ? 16 : 44),
    paddingBottom: 6,
    zIndex: 50,
    gap: 8,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
    backdropFilter: "blur(20px)",
  } as any,
  headerBackPill: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  headerProfilePill: {
    flex: 1,
    height: 46,
    borderRadius: 9999,
    paddingLeft: 5,
    paddingRight: 14,
  },
  headerActionsPill: {
    height: 46,
    borderRadius: 9999,
    paddingHorizontal: 6,
    gap: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  moreDropdownMenu: {
    position: "absolute",
    top: (Platform.OS === "ios" ? 52 : (isDesktop ? 16 : 44)) + 50,
    right: isDesktop ? 20 : 10,
    width: 240,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 6,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    backdropFilter: "blur(20px)",
  } as any,
  moreDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  moreDropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  moreDropdownItemText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  moreDropdownDivider: {
    height: 1,
    marginHorizontal: 12,
    opacity: 0.5,
  },
  floatingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: surface,
  },
  floatingIconBtn: {
    padding: 7,
    borderRadius: 18,
  },
  headerTitle: { color: text, fontSize: 16, fontWeight: "700", fontFamily: "Josefin Sans" },
  hashIcon: { color: textMuted, fontSize: 18, fontWeight: "400" },
  lastSeenText: { color: "#23a559", fontSize: 12, fontWeight: "600", marginTop: 2, fontFamily: "Josefin Sans" },
  groupSubtitle: { color: textMuted, fontSize: 12, fontWeight: "500", marginTop: 2, fontFamily: "Josefin Sans" },
  streakText: { color: "#f43f5e", fontSize: 12, fontWeight: "600", marginTop: 2, fontFamily: "Josefin Sans" },
  offlineText: { color: textMuted, fontFamily: "Josefin Sans" },
  emptyContainer: { flex: 1, justifyContent: "flex-end", padding: 16, paddingBottom: 40 },
  hashCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: inputBg, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  welcomeTitle: { color: text, fontSize: 24, fontWeight: "bold", marginBottom: 8, fontFamily: "Josefin Sans" },
  welcomeSubtitle: { color: textMuted, fontSize: 16, fontFamily: "Josefin Sans" },
  listContainer: { paddingHorizontal: isDesktop ? 20 : 16, paddingTop: Platform.OS === "web" ? (isDesktop ? 74 : 82) : 98, paddingBottom: 110 },
  messageContainer: { flexDirection: "row", marginBottom: 18, alignItems: "flex-end" },
  messageContainerLeft: { justifyContent: "flex-start", alignItems: "flex-start" },
  messageContainerRight: { justifyContent: "flex-end", alignItems: "flex-end" },
  avatarSlot: { width: 40, marginRight: 16 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  dimOverlay: { ...StyleSheet.absoluteFill },
  emptyPreviewBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: surface },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  messageContent: { maxWidth: isDesktop ? "72%" : "80%" },
  messageContentLeft: { alignItems: "flex-start" },
  messageContentRight: { alignItems: "flex-end" },
  messageSender: { color: text, fontSize: 14, fontWeight: "600", marginBottom: 4, fontFamily: "Josefin Sans" },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageBubbleLeft: { backgroundColor: surface, borderBottomLeftRadius: 4 },
  messageBubbleRight: { backgroundColor: accent, borderBottomRightRadius: 4 },
  bubbleFlatTop: { borderTopRightRadius: 4 },
  bubbleFlatTopLeft: { borderTopLeftRadius: 4 },
  bubbleFlatBottom: { borderBottomLeftRadius: 4 },
  bubbleFlatBottomRight: { borderBottomRightRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22, fontFamily: Platform.OS === "web" ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' : undefined },
  messageTextLeft: { color: text },
  messageTextRight: { color: text },
  msgMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { color: textMuted, fontSize: 12, fontWeight: "500", fontFamily: "Josefin Sans" },
  checkIcon: { marginLeft: 4 },
  inlineImage: { maxWidth: 280, maxHeight: 320, minWidth: 140, minHeight: 100, width: "100%", height: "auto", borderRadius: 12, resizeMode: "cover" },
  replyQuote: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: accent,
    backgroundColor: isAmoled ? "rgba(255,255,255,0.08)" : (theme.id === "light" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.2)"),
    maxWidth: 240,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  } as any,
  replyQuoteLeft: { alignSelf: "flex-start" },
  replyQuoteRight: { alignSelf: "flex-end" },
  replyQuoteSender: { color: text, fontSize: 12, fontWeight: "700", marginBottom: 2, fontFamily: "Josefin Sans" },
  replyQuoteText: { color: textMuted, fontSize: 13, fontFamily: "Josefin Sans" },
  messageActions: {
    position: "absolute",
    top: -2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isAmoled
      ? "rgba(18, 18, 22, 0.82)"
      : (theme.id === "light"
        ? "rgba(255, 255, 255, 0.85)"
        : (theme.id === "pink"
          ? "rgba(252, 231, 243, 0.85)"
          : "rgba(35, 37, 43, 0.82)")),
    borderWidth: 1,
    borderColor: isAmoled
      ? "rgba(255, 255, 255, 0.12)"
      : (theme.id === "light"
        ? "rgba(0, 0, 0, 0.08)"
        : (theme.id === "pink"
          ? "rgba(131, 24, 67, 0.12)"
          : "rgba(255, 255, 255, 0.12)")),
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    zIndex: 50,
  } as any,
  actionIcon: {
    padding: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" ? { cursor: "pointer", transition: "all 0.15s ease" } : {}),
  } as any,
  actionIconHover: {
    backgroundColor: isAmoled ? "rgba(255, 255, 255, 0.16)" : (theme.id === "light" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.14)"),
  },
  actionIconDeleteHover: {
    backgroundColor: "rgba(242, 63, 67, 0.18)",
  },
  typingBanner: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 8,
    marginLeft: 4,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  } as any,
  typingText: { fontSize: 13, fontStyle: "italic", fontWeight: "600", fontFamily: "Josefin Sans" },
  thinkingOfYouBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1.5,
    shadowColor: "#f43f5e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 20px rgba(244, 63, 94, 0.35)",
    } : {}),
  } as any,
  thinkingOfYouText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontFamily: "'Josefin Sans', sans-serif",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderWidth: 1,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  } as any,
  replyBannerSender: { fontSize: 12, fontWeight: "700", fontFamily: "Josefin Sans" },
  replyBannerText: { fontSize: 13, fontFamily: "Josefin Sans" },
  editingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: 1,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  } as any,
  editingBannerText: { fontSize: 14, fontWeight: "bold", fontFamily: "Josefin Sans" },
  inputArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 50,
  },
  inputAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isAmoled ? "rgba(0,0,0,0.85)" : (theme.id === "light" ? "rgba(255,255,255,0.88)" : (theme.id === "pink" ? "rgba(252,231,243,0.88)" : "rgba(43,45,49,0.88)")),
    borderRadius: 9999,
    paddingLeft: 7,
    paddingRight: 12,
    paddingVertical: 0,
    height: 46,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: isAmoled ? "#222222" : (theme.id === "light" ? "rgba(0,0,0,0.08)" : (theme.id === "pink" ? "rgba(131,24,67,0.12)" : "rgba(255,255,255,0.08)")),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
    backdropFilter: "blur(20px)",
  } as any,
  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isAmoled ? "#222" : (theme.accent || "#5865F2"),
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
    marginRight: 6,
  },
  inputIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    color: isAmoled ? "#ffffff" : (theme.id === "pink" ? "#ffffff" : theme.text),
    fontSize: 15,
    lineHeight: 20,
    height: 24,
    alignSelf: "center",
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 8,
    outlineStyle: "none" as any,
    textAlignVertical: "center",
    fontFamily: Platform.OS === "web" ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' : undefined,
  },
  circularSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: isAmoled ? "rgba(0,0,0,0.85)" : (theme.id === "light" ? "rgba(255,255,255,0.88)" : (theme.id === "pink" ? "rgba(252,231,243,0.88)" : "rgba(43,45,49,0.88)")),
    borderWidth: 1,
    borderColor: isAmoled ? "#222222" : (theme.id === "light" ? "rgba(0,0,0,0.08)" : (theme.id === "pink" ? "rgba(131,24,67,0.12)" : "rgba(255,255,255,0.08)")),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
    backdropFilter: "blur(20px)",
  } as any,
  systemMessageContainer: { paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  systemMessageText: { color: textMuted, fontSize: 14, fontStyle: "italic", textAlign: "center" },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center", alignItems: "center" },
  imageViewerImg: { width: "100%", height: "85%" } as any,
  imageViewerToolbar: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 52,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 24, 0.78)",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    zIndex: 100,
  },
  imageViewerToolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerToast: {
    position: "absolute",
    bottom: 48,
    backgroundColor: "rgba(24, 24, 28, 0.92)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 100,
  },
  imageViewerToastText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Josefin Sans",
    fontWeight: "600",
  },
  formatChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isAmoled ? "#222" : "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileActionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  mobileActionCard: {
    backgroundColor: isAmoled ? "#121214" : theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: isAmoled ? "rgba(255, 255, 255, 0.12)" : theme.border,
  },
  mobileActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: isAmoled ? "rgba(255, 255, 255, 0.08)" : theme.border,
    marginBottom: 8,
  },
  mobileActionHeaderText: {
    color: theme.accent || "#5865F2",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    flex: 1,
  },
  mobileActionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isAmoled ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
  },
  mobileActionItemText: {
    color: isAmoled ? "#ffffff" : theme.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
};


// --- Dynamic Image Sizing & WhatsApp-Style Clumped Media Grid Components ---
const DynamicImage = React.memo(({ uri, onPress, style }: { uri: string; onPress: () => void; style?: any }) => {
  const [aspectRatio, setAspectRatio] = useState<number>(1.2);

  useEffect(() => {
    if (!uri || typeof uri !== "string") return;
    try {
      Image.getSize(
        uri,
        (w, h) => {
          if (w && h) {
            const ratio = w / h;
            setAspectRatio(Math.max(0.65, Math.min(1.75, ratio)));
          }
        },
        () => {}
      );
    } catch (e) {}
  }, [uri]);

  if (!uri || typeof uri !== "string") return null;

  const maxW = 274;
  const computedW = Math.min(maxW, Math.max(160, 220 * (aspectRatio >= 1 ? Math.min(1.35, aspectRatio) : 1)));
  const computedH = Math.min(330, computedW / aspectRatio);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri }}
        style={[
          {
            width: computedW,
            height: computedH,
            borderRadius: 12,
            resizeMode: "cover",
          },
          style,
        ]}
      />
    </TouchableOpacity>
  );
});

const MediaAlbumGrid = React.memo(({ items, setImageViewerUrl }: { items: any[]; setImageViewerUrl: (url: string) => void }) => {
  const total = items.length;

  if (total === 1) {
    return <DynamicImage uri={items[0].text} onPress={() => setImageViewerUrl(items[0].text)} />;
  }

  if (total === 2) {
    return (
      <View style={{ flexDirection: "row", gap: 2, borderRadius: 12, overflow: "hidden", maxWidth: 274 }}>
        {items.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => setImageViewerUrl(item.text)} style={{ width: 136, height: 180 }} activeOpacity={0.85}>
            <Image source={{ uri: item.text }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (total === 3) {
    return (
      <View style={{ flexDirection: "row", gap: 2, borderRadius: 12, overflow: "hidden", maxWidth: 274, height: 274 }}>
        <TouchableOpacity onPress={() => setImageViewerUrl(items[0].text)} style={{ width: 136, height: 274 }} activeOpacity={0.85}>
          <Image source={{ uri: items[0].text }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
        </TouchableOpacity>
        <View style={{ width: 136, height: 274, gap: 2 }}>
          <TouchableOpacity onPress={() => setImageViewerUrl(items[1].text)} style={{ width: 136, height: 136 }} activeOpacity={0.85}>
            <Image source={{ uri: items[1].text }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setImageViewerUrl(items[2].text)} style={{ width: 136, height: 136 }} activeOpacity={0.85}>
            <Image source={{ uri: items[2].text }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayItems = items.slice(0, 4);
  const remainingCount = total - 3;

  return (
    <View style={{ width: 274, height: 274, flexDirection: "row", flexWrap: "wrap", gap: 2, borderRadius: 12, overflow: "hidden" }}>
      {displayItems.map((item, idx) => {
        const isFourth = idx === 3 && total > 4;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => setImageViewerUrl(item.text)}
            style={{ width: 136, height: 136, position: "relative" }}
            activeOpacity={0.85}
          >
            <Image source={{ uri: item.text }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
            {isFourth && (
              <View style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                justifyContent: "center", alignItems: "center"
              }}>
                <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "bold" }}>
                  +{remainingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// --- Animated Glassmorphism Message Hover Action Bar ---
const MessageHoverActions = ({
  item,
  isMe,
  setReplyingTo,
  handlePinMessage,
  setHoveredMsg,
  setEditingMsgId,
  setInputText,
  deleteMessage,
  isAmoled,
  theme,
  styles,
}: any) => {
  const enterScale = useSharedValue(0.88);
  const enterOpacity = useSharedValue(0);
  const enterTranslateY = useSharedValue(4);

  useEffect(() => {
    enterScale.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.8 });
    enterOpacity.value = withTiming(1, { duration: 160 });
    enterTranslateY.value = withTiming(0, { duration: 160 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [
      { scale: enterScale.value },
      { translateY: enterTranslateY.value },
    ],
  }));

  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <Animated.View
      style={[
        styles.messageActions,
        isMe ? { right: '100%', marginRight: 8, top: 0 } : { left: '100%', marginLeft: 8, top: 0, right: 'auto' },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={() => setReplyingTo({ id: item.id, text: item.text, sender: item.sender })}
        onHoverIn={() => setHoveredBtn("reply")}
        onHoverOut={() => setHoveredBtn(null)}
        style={({ pressed }) => [
          styles.actionIcon,
          hoveredBtn === "reply" && styles.actionIconHover,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Reply size={15} color={isAmoled ? "#ffffff" : (theme?.text || "#f2f3f5")} />
      </Pressable>

      <Pressable
        onPress={() => { handlePinMessage(item); setHoveredMsg(null); }}
        onHoverIn={() => setHoveredBtn("pin")}
        onHoverOut={() => setHoveredBtn(null)}
        style={({ pressed }) => [
          styles.actionIcon,
          hoveredBtn === "pin" && styles.actionIconHover,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Pin size={15} color={isAmoled ? "#ffffff" : (theme?.text || "#f2f3f5")} />
      </Pressable>

      {isMe && (
        <>
          <Pressable
            onPress={() => { setEditingMsgId(item.id); setInputText(item.text); setHoveredMsg(null); }}
            onHoverIn={() => setHoveredBtn("edit")}
            onHoverOut={() => setHoveredBtn(null)}
            style={({ pressed }) => [
              styles.actionIcon,
              hoveredBtn === "edit" && styles.actionIconHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Edit2 size={15} color={isAmoled ? "#ffffff" : (theme?.text || "#f2f3f5")} />
          </Pressable>

          <Pressable
            onPress={() => deleteMessage(item.id)}
            onHoverIn={() => setHoveredBtn("delete")}
            onHoverOut={() => setHoveredBtn(null)}
            style={({ pressed }) => [
              styles.actionIcon,
              hoveredBtn === "delete" && styles.actionIconDeleteHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Trash2 size={15} color="#f23f43" />
          </Pressable>
        </>
      )}
    </Animated.View>
  );
};

// --- MessageRow Component for Animations & Gradients ---
const MessageRow = React.memo(({ item, index, messages, targetUser, chatSettings, isGroup, hoveredMsg, setHoveredMsg, setReplyingTo, setEditingMsgId, setInputText, deleteMessage, handleApplyWallpaper, setSettingsVisible, setImageViewerUrl, handlePinMessage, isAmoled, styles, theme, isHighlighted, onScrollToMessage, chatAvatars }: any) => {
  if (item.type === "wallpaper_deck" || item.type === "chat_avatar") return null;

  // Live entrance: only newly sending messages or fresh received messages animate (avoids second bounce on status update/ID swap)
  const isLiveEntrance = useRef(
    index === 0 && (
      item.isMe 
        ? item.status === "sending" 
        : (Date.now() - (item.created_at_ts || 0) < 3000)
    )
  ).current;

  // Sleek rubbery bubble sending physics:
  // Starts collapsed into a small rubber bead / capsule at the origin corner (bottom right for sent, bottom left for received)
  const scaleX = useSharedValue(isLiveEntrance ? (item.isMe ? 0.38 : 0.6) : 1);
  const scaleY = useSharedValue(isLiveEntrance ? (item.isMe ? 0.22 : 0.4) : 1);
  const translateY = useSharedValue(isLiveEntrance ? (item.isMe ? 38 : 24) : 0);
  const opacity = useSharedValue(isLiveEntrance ? 0.5 : 1);
  const highlightAnim = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightAnim.value = withSequence(
        withTiming(1, { duration: 250 }),
        withDelay(1400, withTiming(0, { duration: 700 }))
      );
      scaleX.value = withSequence(
        withTiming(1.04, { duration: 180 }),
        withTiming(1, { duration: 180 })
      );
      scaleY.value = withSequence(
        withTiming(1.04, { duration: 180 }),
        withTiming(1, { duration: 180 })
      );
    } else {
      highlightAnim.value = 0;
    }
  }, [isHighlighted]);

  const highlightOverlayStyle = useAnimatedStyle(() => ({
    opacity: highlightAnim.value,
  }));

  const lastPressRef = useRef<number>(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastPressRef.current < 300) {
      setHoveredMsg(hoveredMsg === item.id ? null : item.id);
    }
    lastPressRef.current = now;
  };

  const hoverTimeoutRef = useRef<any>(null);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMsg(item.id);
    }, 140);
  }, [item.id, setHoveredMsg]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredMsg(null);
  }, [setHoveredMsg]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const translateX = useSharedValue(0);
  const swipeProgress = useSharedValue(0);
  const hapticTriggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        hapticTriggeredRef.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        const rawDx = gestureState.dx;
        // Rubber-band drag: dx * 0.45, capped at max ±62px
        const clampedDx = Math.sign(rawDx) * Math.min(Math.abs(rawDx) * 0.45, 62);
        translateX.value = clampedDx;

        const progress = Math.min(Math.abs(clampedDx) / 44, 1);
        swipeProgress.value = progress;

        if (progress >= 1 && !hapticTriggeredRef.current) {
          hapticTriggeredRef.current = true;
          try {
            if (Platform.OS !== "web") {
              Vibration.vibrate(10);
            }
          } catch {}
        } else if (progress < 0.75) {
          hapticTriggeredRef.current = false;
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (swipeProgress.value >= 1) {
          setReplyingTo({ id: item.id, text: item.text, sender: item.sender });
          try {
            if (Platform.OS !== "web") {
              Vibration.vibrate(16);
            }
          } catch {}
        }
        translateX.value = withSpring(0, { damping: 22, stiffness: 280, mass: 0.85 });
        swipeProgress.value = withTiming(0, { duration: 180 });
        hapticTriggeredRef.current = false;
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(0, { damping: 22, stiffness: 280, mass: 0.85 });
        swipeProgress.value = withTiming(0, { duration: 180 });
        hapticTriggeredRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    if (isLiveEntrance) {
      if (item.isMe) {
        // 1. Rocket stretch: stretches vertically as it shoots upward from the input bar
        scaleY.value = withSequence(
          withTiming(1.22, { duration: 90 }),
          withSpring(1, { damping: 13, stiffness: 210, mass: 0.85 })
        );
        // 2. Narrows horizontally during upward flight, then squashes out on impact with rubber rebound
        scaleX.value = withSequence(
          withTiming(0.86, { duration: 90 }),
          withSpring(1, { damping: 13, stiffness: 210, mass: 0.85 })
        );
        // 3. Elastic upward translation with slight cushion
        translateY.value = withSpring(0, { damping: 14, stiffness: 220, mass: 0.85 });
        opacity.value = withTiming(1, { duration: 80 });
      } else {
        // Incoming message pop
        scaleY.value = withSequence(
          withTiming(1.15, { duration: 90 }),
          withSpring(1, { damping: 15, stiffness: 230, mass: 0.85 })
        );
        scaleX.value = withSequence(
          withTiming(0.92, { duration: 90 }),
          withSpring(1, { damping: 15, stiffness: 230, mass: 0.85 })
        );
        translateY.value = withSpring(0, { damping: 15, stiffness: 230, mass: 0.85 });
        opacity.value = withTiming(1, { duration: 80 });
      }
    }
  }, [isLiveEntrance, item.isMe, scaleX, scaleY, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
    opacity: opacity.value,
    transformOrigin: item.isMe ? "bottom right" : "bottom left",
  }));

  const swipeCircleCircumference = 2 * Math.PI * 13;
  const animatedCircleProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: swipeCircleCircumference * (1 - swipeProgress.value),
    };
  });

  const badgeAnimatedStyle = useAnimatedStyle(() => {
    const isSwipingLeft = translateX.value < 0;
    const isVisible = swipeProgress.value > 0.05;
    return {
      opacity: isVisible ? interpolate(swipeProgress.value, [0.05, 0.35, 1], [0, 0.75, 1]) : 0,
      transform: [
        { scale: interpolate(swipeProgress.value, [0, 0.85, 1], [0.5, 0.95, 1.15]) },
      ],
      position: "absolute" as const,
      top: "50%",
      marginTop: -18,
      left: isSwipingLeft ? undefined : 14,
      right: isSwipingLeft ? 14 : undefined,
      zIndex: 0,
    };
  });

  // Album Grouping logic for WhatsApp style multi-media clumps
  const isMedia = item.type === "image" || item.type === "video";
  const albumGroup: any[] = [];
  let isAlbumLeader = false;

  if (isMedia && !item.reply_to_id) {
    const canClump = (m1: any, m2: any) => {
      if (!m1 || !m2) return false;
      const isM1 = m1.type === "image" || m1.type === "video";
      const isM2 = m2.type === "image" || m2.type === "video";
      if (!isM1 || !isM2) return false;
      if (m1.sender_id !== m2.sender_id) return false;
      if (m1.reply_to_id || m2.reply_to_id) return false;
      return Math.abs(m1.created_at_ts - m2.created_at_ts) <= 60000;
    };

    let startIdx = index;
    while (startIdx > 0 && canClump(messages[startIdx], messages[startIdx - 1])) {
      startIdx--;
    }

    let endIdx = index;
    while (endIdx < messages.length - 1 && canClump(messages[endIdx], messages[endIdx + 1])) {
      endIdx++;
    }

    if (endIdx - startIdx >= 1) {
      if (index === startIdx) {
        isAlbumLeader = true;
        const clump = messages.slice(startIdx, endIdx + 1);
        albumGroup.push(...clump.slice().sort((a: any, b: any) => a.created_at_ts - b.created_at_ts));
      } else {
        return null;
      }
    }
  }

  if (item.type === "system") {
    const isWallpaperMsg = typeof item.text === "string" && item.text.includes("Tap here");
    return (
      <View style={styles.systemMessageContainer}>
        {isWallpaperMsg ? (
          <TouchableOpacity onPress={() => item.isMe ? setSettingsVisible(true) : handleApplyWallpaper()}>
            <Text style={[styles.systemMessageText, { color: "#5865F2" }]}>
              <Text style={[{ fontWeight: "bold", color: "#949ba4" }, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>{item.sender}</Text> {item.text}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.systemMessageText}>
            <Text style={[{ fontWeight: "bold" }, chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>{item.sender}</Text> {item.text}
          </Text>
        )}
      </View>
    );
  }

  const prevMsg = index < messages.length - 1 ? messages[index + 1] : null;
  const nextMsg = index > 0 ? messages[index - 1] : null;
  const groupWithPrev = !!(prevMsg && prevMsg.sender_id === item.sender_id && prevMsg.type !== "system" && Math.abs(item.created_at_ts - prevMsg.created_at_ts) < 60000);
  const groupWithNext = !!(nextMsg && nextMsg.sender_id === item.sender_id && nextMsg.type !== "system" && Math.abs(item.created_at_ts - nextMsg.created_at_ts) < 60000);
  const showMeta = !groupWithNext;

  // Cosmetic overrides
  const gradientEnabled = chatSettings?.bubble_gradient_enabled || false;
  const gradientColor2 = chatSettings?.bubble_gradient_color2 || "#a78bfa";
  const baseSentColor = chatSettings?.bubble_color_sent || (theme.accent || "#5865F2");
  const sentColor = (isAmoled && !gradientEnabled) ? "#000000" : baseSentColor;
  const receivedColor = isAmoled ? "#000000" : (chatSettings?.bubble_color_received || "#2b2d31");
  const bubbleTextColor = (isAmoled && !gradientEnabled) ? "#ffffff" : undefined;
  const shape = chatSettings?.bubble_shape || "round";
  
  let radius = 18;
  if (shape === "soft") radius = 10;
  if (shape === "sharp") radius = 4;

  const isShimmer = item.custom_font?.includes(":shimmer") || item.custom_font === "shimmer";
  const rawFont = item.custom_font?.replace(":shimmer", "");
  const activeFont = (rawFont && rawFont !== "system" ? rawFont : null) || chatSettings?.font_family;
  const isLove = (item.type === "text" || !item.type) && isLoveMessage(item.text);

  const bubbleStyles: any[] = [
    styles.messageBubble, 
    { borderRadius: radius, alignSelf: item.isMe ? "flex-end" : "flex-start" },
    item.isMe 
      ? { backgroundColor: item.type === "sticker" ? "transparent" : (gradientEnabled ? "transparent" : sentColor), borderBottomRightRadius: 4 } 
      : { backgroundColor: item.type === "sticker" ? "transparent" : receivedColor, borderBottomLeftRadius: 4 },
    (item.type === "image" || item.type === "video") && { paddingHorizontal: 2, paddingVertical: 2 }, item.type === "sticker" && { paddingHorizontal: 0, paddingVertical: 0 },
    isLove && {
      backgroundColor: item.isMe ? "#f43f5e" : "#be123c",
      shadowColor: "#f43f5e",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
    },
    isShimmer && {
      shadowColor: "#ffffff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
  ];
  if (item.isMe) { if (groupWithPrev) bubbleStyles.push({ borderTopRightRadius: 4 }); if (groupWithNext) bubbleStyles.push({ borderBottomRightRadius: 4 }); }
  else { if (groupWithPrev) bubbleStyles.push({ borderTopLeftRadius: 4 }); if (groupWithNext) bubbleStyles.push({ borderBottomLeftRadius: 4 }); }

  const isRead = item.isMe && targetUser?.last_read_at && item.created_at_ts <= new Date(targetUser.last_read_at).getTime();

  const renderBubbleContent = () => {
    if (isAlbumLeader && albumGroup.length > 1) {
      return <MediaAlbumGrid items={albumGroup} setImageViewerUrl={setImageViewerUrl} />;
    }
    if (item.type === "sticker") {
      const stickerDim = Platform.OS === "web" ? 104 : 128;
      const stickerOpacity = (chatSettings?.screen_dim > 0) ? Math.max(0.55, 1 - (chatSettings.screen_dim * 0.45)) : 1;
      return <Image source={{ uri: item.text }} style={{ width: stickerDim, height: stickerDim, opacity: stickerOpacity }} resizeMode="contain" />;
    }
    if (item.type === "image") {
      const imgOpacity = (chatSettings?.screen_dim > 0) ? Math.max(0.7, 1 - (chatSettings.screen_dim * 0.3)) : 1;
      return <DynamicImage uri={item.text} onPress={() => setImageViewerUrl(item.text)} style={{ opacity: imgOpacity }} />;
    }
    if (item.type === "audio") {
      return <AudioPlayerBubble audioUrl={item.text} isMe={item.isMe} />;
    }
    if (item.type === "video") {
      return <VideoPlayerBubble videoUrl={item.text} isMe={item.isMe} />;
    }
    const loveTextColor = isLove ? "#ffffff" : bubbleTextColor;
    return renderFormattedContent(
      typeof item.text === "string" ? item.text : (item.text ? JSON.stringify(item.text) : ""),
      {
        isShimmer,
        baseStyle: [styles.messageText, item.isMe ? styles.messageTextRight : styles.messageTextLeft],
        textColor: loveTextColor,
        isMe: item.isMe,
        fontFamily: activeFont,
        isLove,
      }
    );
  };

  const handleBubbleContextMenu = (e: any) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      window.dispatchEvent(
        new CustomEvent("open_ala_context_menu", {
          detail: { x: e?.clientX || 120, y: e?.clientY || 220, type: "message", item, isGroup },
        })
      );
    }
  };

  const handleLongPress = (e?: any) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const x = e?.clientX || e?.nativeEvent?.pageX || (window.innerWidth / 2 - 110);
      const y = e?.clientY || e?.nativeEvent?.pageY || (window.innerHeight / 2 - 120);
      window.dispatchEvent(
        new CustomEvent("open_ala_context_menu", {
          detail: { x, y, type: "message", item, isGroup },
        })
      );
    }
  };

  return (
    <View style={{ position: "relative", width: "100%", justifyContent: "center" }}>
      {/* Instagram-style Circular Reply Indicator behind the message */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          },
          badgeAnimatedStyle,
        ]}
      >
        <Svg width={36} height={36} viewBox="0 0 36 36">
          <Circle
            cx={18}
            cy={18}
            r={13}
            stroke={isAmoled ? "rgba(255, 255, 255, 0.15)" : (theme.id === "pink" ? "rgba(244, 114, 182, 0.25)" : "rgba(255, 255, 255, 0.20)")}
            strokeWidth={2.5}
            fill={isAmoled ? "#141414" : (theme.id === "pink" ? "#fce7f3" : (theme.id === "light" ? "#f0f2f5" : "#222428"))}
          />
          <AnimatedCircle
            cx={18}
            cy={18}
            r={13}
            stroke={theme.accent || "#5865F2"}
            strokeWidth={2.5}
            strokeDasharray={swipeCircleCircumference}
            animatedProps={animatedCircleProps}
            strokeLinecap="round"
            fill="none"
            transform="rotate(-90 18 18)"
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Reply size={15} color={theme.accent || (isAmoled ? "#ffffff" : theme.text)} />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        layout={LinearTransition.springify().damping(15).stiffness(210).mass(0.85)}
        style={animatedStyle}
        {...panResponder.panHandlers}
      >
      <Pressable
        style={[styles.messageContainer, item.isMe ? styles.messageContainerRight : styles.messageContainerLeft, { marginBottom: groupWithNext ? 2 : 18 }]}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        {!item.isMe && (
          <View style={styles.avatarSlot}>
            {showMeta && (((item.sender_id && chatAvatars?.[item.sender_id]) || item.avatar)
              ? <Image source={{ uri: (item.sender_id && chatAvatars?.[item.sender_id]) || item.avatar }} style={styles.messageAvatar} />
              : <View style={[styles.messageAvatar, styles.avatarFallback]}><User size={20} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} /></View>
            )}
          </View>
        )}
        <View
          style={[styles.messageContent, item.isMe ? styles.messageContentRight : styles.messageContentLeft]}
          {...({
            onContextMenu: handleBubbleContextMenu,
            "data-msg-id": item.id,
          } as any)}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isAmoled
                  ? "rgba(255, 255, 255, 0.22)"
                  : (theme.id === "pink" ? "rgba(244, 114, 182, 0.32)" : "rgba(88, 101, 242, 0.25)"),
                borderRadius: 18,
                borderWidth: 2,
                borderColor: theme.accent || "#5865F2",
                zIndex: 15,
                margin: -4,
              },
              highlightOverlayStyle,
            ]}
          />
          {(!item.isMe && showMeta && !groupWithPrev) && (
            <Text style={[
              styles.messageSender,
              chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
            ]}>
              {item.sender}
            </Text>
          )}
          {item.reply_to_id && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                if (item.reply_to_id && onScrollToMessage) {
                  onScrollToMessage(item.reply_to_id);
                }
              }}
              style={[
                styles.replyQuote, 
                item.isMe ? styles.replyQuoteRight : styles.replyQuoteLeft,
                Platform.OS === "web" && ({ cursor: "pointer" } as any)
              ]}
            >
              <Text style={[
                styles.replyQuoteSender,
                chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}
              ]}>
                {item.reply_to_sender}
              </Text>
              {item.reply_to_content?.startsWith("http") ? (
                <Image source={{ uri: item.reply_to_content }} style={{ width: 40, height: 40, borderRadius: 4, marginTop: 2 }} resizeMode="cover" />
              ) : (
                <Text style={styles.replyQuoteText} numberOfLines={1}>{item.reply_to_content}</Text>
              )}
            </TouchableOpacity>
          )}
          
          {isLove ? (
            <LinearGradient
              colors={item.isMe ? ["#f43f5e", "#fb7185"] : ["#be123c", "#f43f5e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bubbleStyles}
            >
              {renderBubbleContent()}
            </LinearGradient>
          ) : item.isMe && gradientEnabled && item.type !== "sticker" ? (
            <LinearGradient colors={[sentColor, gradientColor2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bubbleStyles}>
              {renderBubbleContent()}
            </LinearGradient>
          ) : (
            <View style={bubbleStyles}>
              {renderBubbleContent()}
            </View>
          )}

          {item.isMe && showMeta && (
            <View style={styles.msgMeta}>
              <Text style={styles.timeText}>
                {item.time} 
                {item.status === "sending" && <Text> <SendingDots /></Text>}
                {item.status === "failed" && <Text style={{ color: '#f43f5e' }}> (failed)</Text>}
              </Text>
              {item.status !== "sending" && item.status !== "failed" && (
                isRead ? <CheckCheck size={14} color={isAmoled ? "#ffffff" : "#5865F2"} style={styles.checkIcon} /> : <Check size={14} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} style={styles.checkIcon} />
              )}
            </View>
          )}
          {!item.isMe && showMeta && <Text style={[styles.timeText, { alignSelf: "flex-start", marginTop: 4 }]}>{item.time}</Text>}
          
          {hoveredMsg === item.id && (
            <MessageHoverActions
              item={item}
              isMe={item.isMe}
              setReplyingTo={setReplyingTo}
              handlePinMessage={handlePinMessage}
              setHoveredMsg={setHoveredMsg}
              setEditingMsgId={setEditingMsgId}
              setInputText={setInputText}
              deleteMessage={deleteMessage}
              isAmoled={isAmoled}
              theme={theme}
              styles={styles}
            />
          )}
        </View>
      </Pressable>
      </Animated.View>
    </View>
  );
});








