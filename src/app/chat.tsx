import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, SafeAreaView, KeyboardAvoidingView, Platform, Pressable,
  LayoutAnimation, UIManager, Modal, ActivityIndicator, PanResponder,
  Animated as RNAnimated, Easing, Dimensions, useWindowDimensions,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, withSequence } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Video, Hash, Plus, Send, User, MoreVertical, Trash2, Edit2, X, Check, CheckCheck, Reply, Heart, Smile, Type, Sticker, Users, Mic, Pin } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CustomEmojiPicker from '../components/CustomEmojiPicker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChatSettingsModal, { FONT_OPTIONS } from '../components/ChatSettingsModal';
import StickerPicker from '../components/StickerPicker';
import { HeartPing } from "../components/HeartPing";
import ShinyText from "../components/ShinyText";
import { DoodleOverlay } from "../components/DoodleOverlay";
import ChatInfoModal from "../components/ChatInfoModal";
import AudioPlayerBubble from "../components/AudioPlayerBubble";
import VideoPlayerBubble from "../components/VideoPlayerBubble";
import VoiceRecorder from "../components/VoiceRecorder";
import ChatSidebar from "../components/ChatSidebar";
import { supabase } from "../lib/supabase";
import { uploadChatImageToR2, uploadAudioToR2, uploadVideoToR2, uploadBlobToR2 } from "../lib/r2";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isFeatureEnabled, UserProfile } from "../lib/features";

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
  const styles = React.useMemo(() => createStyles(isAmoled, theme), [isAmoled, theme]);
  const { id, name, avatar } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [groupChatData, setGroupChatData] = useState<any>(null);
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>(null);
  // showWallpaper must come AFTER chatSettings useState - never show wallpaper in AMOLED
  const showWallpaper = !isAmoled && !!chatSettings?.wallpaper_url;
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsername, setTypingUsername] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
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
  const [isGroup, setIsGroup] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [publicFeatures, setPublicFeatures] = useState<string[]>([]);
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
  const [customAlert, setCustomAlert] = useState<any>(null);
  const [pingVisible, setPingVisible] = useState(false);
  const [isHeartGlowing, setIsHeartGlowing] = useState(false);
  const [thinkingOfYou, setThinkingOfYou] = useState<{ text: string } | null>(null);
  const heartAnim = useRef(new RNAnimated.Value(1)).current;
  const thinkingAnim = useRef(new RNAnimated.Value(0)).current;
  const heartTimerRef = useRef<any>(null);
  const thinkingTimerRef = useRef<any>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [myNicknameFromPartner, setMyNicknameFromPartner] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const highlightTimerRef = useRef<any>(null);

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
      document.removeEventListener("webkitfullscreenchange", handleFullscreen);
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
          if (oldest) {
            const { data: gapMessages, error } = await supabase
              .from("messages")
              .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, custom_font, profiles(username, avatar_url)")
              .eq("chat_id", id)
              .lt("created_at", oldest.created_at)
              .gte("created_at", targetMsg.created_at)
              .order("created_at", { ascending: false });

            if (!error && gapMessages && gapMessages.length > 0) {
              const formattedGap = gapMessages.map(formatMsg);
              const updatedMessages = [...messages, ...formattedGap];
              setMessages(updatedMessages);
              targetIndex = updatedMessages.findIndex(m => m.id === targetMsgId);
            }
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

    // Scroll to the index
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

  useEffect(() => {
    if (!id || !user) return;
    setMessages([]); setHasMore(true); setEditingMsgId(null); setReplyingTo(null); setHoveredMsg(null);
    setTargetUser(null); setGroupChatData(null); setIsGroup(false); setGroupMemberCount(0);
    setChatSettings(null); setPinnedMessage(null); setMyNicknameFromPartner(null);
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
      if (mySettings) {
        const mergedSettings = { ...initialSettings, ...mySettings };
        if (!mySettings.send_button_emoji && initialSettings.send_button_emoji) {
          mergedSettings.send_button_emoji = initialSettings.send_button_emoji;
        }
        setChatSettings(mergedSettings);
        AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(mergedSettings)).catch(() => {});
      }
      const { data: chatData } = await supabase.from("chats").select("*").eq("id", id).single();
      if (chatData?.is_group) {
        setIsGroup(true);
        setGroupChatData(chatData);
        const { count } = await supabase.from("chat_participants").select("*", { count: "exact", head: true }).eq("chat_id", id);
        if (count) setGroupMemberCount(count);
      }
      const { data: parts } = await supabase.from("chat_participants").select("user_id, last_read_at, nickname").eq("chat_id", id).neq("user_id", user.id).limit(1);
      if (parts && parts.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", parts[0].user_id).single();
        const savedNick = mySettings?.nickname || mySettings?.partner_nickname || null;
        if (profile) setTargetUser({ ...profile, last_read_at: parts[0].last_read_at, nickname: savedNick });
        if (parts[0].nickname) setMyNicknameFromPartner(parts[0].nickname);
      }
    };
    init();

    const syncChannel = supabase.channel(`sync_${sessionToken}`);
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
        
        const filtered = data.filter(m => m.type !== "alert" && m.type !== "deleted");
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
            custom_font: payload.new.custom_font,
          };
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => {
            if (prev.some(m => m.id === nm.id)) return prev;
            if (nm.sender_id === user?.id) {
              const tempIndex = prev.findIndex(m => m.id.startsWith("temp-") && m.text === nm.text);
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = { ...nm, status: "sent" };
                return updated;
              }
            }
            return [nm, ...prev];
          });
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `chat_id=eq.${id}` }, (payload) => {
        if (payload.new.user_id !== user.id) setTargetUser((prev: any) => prev ? { ...prev, last_read_at: payload.new.last_read_at } : prev);
      }).subscribe();

    const profChannel = supabase.channel(`profiles_${sessionToken}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        setTargetUser((prev: any) => {
          if (prev && payload.new.id === prev.id) return { ...prev, updated_at: payload.new.updated_at };
          return prev;
        });
      }).subscribe();

    const broadcastTopic = `chat_broadcast_${id}`;
    const existingBChannel = supabase.getChannels().find(c => c.topic === `realtime:${broadcastTopic}` || c.topic === broadcastTopic);
    if (existingBChannel) {
      try { supabase.removeChannel(existingBChannel); } catch (e) {}
    }
    const tChannel = supabase.channel(broadcastTopic, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload: any) => {
        const tUser = payload?.payload?.username || targetUser?.nickname || targetUser?.username || "Someone";
        setTypingUsername(tUser);
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypingUsername(null);
        }, 3000);
      })
      .on("broadcast", { event: "ping" }, (payload: any) => {
        const sName = payload?.payload?.sender_name || targetUser?.nickname || targetUser?.username || name || "Someone";
        activateHeartGlowAndBlink();
        showThinkingNotification(`${sName} is thinking of you`);
      })
      .on("broadcast", { event: "message_deleted" }, (payload) => {
        if (payload.payload?.id) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.filter(m => m.id !== payload.payload.id));
          AsyncStorage.getItem(`chat_${id}_messages`).then(cached => {
            if (cached) {
              const list = JSON.parse(cached).filter((m: any) => m.id !== payload.payload.id);
              AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(list));
            }
          }).catch(() => {});
        }
      })
      .on("broadcast", { event: "custom_alert" }, (payload) => {
        setCustomAlert(payload.payload);
      })
      .on("broadcast", { event: "alert_response" }, (payload) => {
        const { alertId, choice, title, responder } = payload.payload;
        const key = `${alertId}_${choice}`;
        if (alertId && handledResponsesRef.current.has(key)) return;
        if (alertId) handledResponsesRef.current.add(key);

        if (Platform.OS === "web") {
          alert(`📢 Response from ${responder}:\n"${choice}" for "${title}"`);
        }
      })
      .on("broadcast", { event: "pin_update" }, (payload) => {
        setPinnedMessage(payload.payload.pinnedMessage || null);
      }).subscribe();
    typingChannelRef.current = tChannel;

    const chatChannel = supabase.channel(`chats_${sessionToken}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${id}` }, (payload) => {
        setGroupChatData((prev: any) => ({ ...prev, ...payload.new }));
      }).subscribe();

    return () => {
      try { supabase.removeChannel(syncChannel); } catch (e) {}
      try { supabase.removeChannel(channel); } catch (e) {}
      try { supabase.removeChannel(pChannel); } catch (e) {}
      try { supabase.removeChannel(tChannel); } catch (e) {}
      try { supabase.removeChannel(profChannel); } catch (e) {}
      try { supabase.removeChannel(chatChannel); } catch (e) {}
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    if (!error && data) { setMessages(prev => [...prev, ...data.map(formatMsg)]); setHasMore(data.length === PAGE_SIZE); }
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

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !user || !id) return;
    const content = inputText.trim();
    const curEdit = editingMsgId; const curReply = replyingTo; 
    const curFont = (messageFont && messageFont !== "system") 
      ? messageFont 
      : (chatSettings?.font_family && chatSettings.font_family !== "system" ? chatSettings.font_family : null);
    setInputText(""); setEditingMsgId(null); setReplyingTo(null); setMessageFont(null); setFontPickerOpen(false);
    
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
        custom_font: curFont || null,
        reply_to_id: curReply?.id || null,
        reply_to_content: curReply?.text || null,
        reply_to_sender: curReply?.sender || null,
      };
      
      setMessages(prev => [tempMsg, ...prev]);

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
          return prev.map(m => m.id === tempId ? { ...m, id: data.id, status: "sent" } : m);
        });
      }
    }
  }, [inputText, user, id, editingMsgId, replyingTo, messageFont, chatSettings?.font_family]);

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
        await supabase.from("messages").insert(msgs);
        setReplyingTo(null);
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      alert("Failed to upload file(s): " + (e.message || e));
    } finally {
      setUploadingImage(false);
      setUploadProgress({ active: false, current: 0, total: 0, percent: 0 });
    }
  }, [id, user?.id, replyingTo]);

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
          await supabase.from("messages").insert(msgs);
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
  }, [id, user?.id, replyingTo]);

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
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, text: publicUrl, status: "sent" } : m));
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
          setInfoVisible(true);
        }
      };

      window.addEventListener("ala_message_action" as any, handleMessageAction);
      return () => window.removeEventListener("ala_message_action" as any, handleMessageAction);
    }
  }, [handlePinMessage, deleteMessage]);

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
        hoveredMsg={hoveredMsg} setHoveredMsg={setHoveredMsg} setReplyingTo={setReplyingTo}
        setEditingMsgId={setEditingMsgId} setInputText={setInputText} deleteMessage={deleteMessage}
        handleApplyWallpaper={handleApplyWallpaper} setSettingsVisible={setSettingsVisible} setImageViewerUrl={setImageViewerUrl}
        handlePinMessage={handlePinMessage}
        isHighlighted={highlightedMsgId === item.id}
        onScrollToMessage={scrollToAndHighlightMessage}
      />
    );
  }, [messages, hoveredMsg, targetUser, chatSettings, isGroup, handleApplyWallpaper, deleteMessage, handlePinMessage, highlightedMsgId, scrollToAndHighlightMessage]);

  const chatViewContent = (
    <View style={{ flex: 1, height: "100%", backgroundColor: showWallpaper ? "transparent" : (isAmoled ? "#000000" : theme.background) }}>
      {showWallpaper && (
        <View style={StyleSheet.absoluteFill}>
          <Image source={{ uri: chatSettings!.wallpaper_url }}
            style={[StyleSheet.absoluteFill, { resizeMode: "cover", transform: [{ scale: chatSettings?.wallpaper_zoom || 1 }] }]}
            blurRadius={(chatSettings?.wallpaper_blur || 0) * 20} />
          {chatSettings?.wallpaper_dim ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${chatSettings?.wallpaper_dim || 0})` }]} />
          ) : null}
        </View>
      )}
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <View style={styles.floatingHeaderWrapper}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
            style={[
              styles.headerPill,
              styles.headerBackPill,
              isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
              showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
              theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
              theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
              { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
            ]}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={isAmoled ? "#ffffff" : ((theme.id === "light" || theme.id === "pink") ? "#111111" : "#ffffff")} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.headerPill,
              styles.headerProfilePill,
              isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
              showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
              theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
              theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
              { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
            ]}
            onPress={() => setInfoVisible(true)} 
            activeOpacity={0.8}
          >
            {isGroup ? (
              <View style={[styles.floatingAvatar, { backgroundColor: isAmoled ? '#222' : theme.accent, justifyContent: "center", alignItems: "center" }]}>
                <Users size={18} color="#fff" />
              </View>
            ) : targetUser?.avatar_url ? (
              <Image source={{ uri: targetUser.avatar_url }} style={styles.floatingAvatar} />
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
              {isGroup ? (
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
          </TouchableOpacity>

          <View style={[
            styles.headerPill,
            styles.headerActionsPill,
            isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
            showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
            theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
            theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
            { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
          ]}>
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
            <TouchableOpacity style={styles.floatingIconBtn} onPress={() => setSettingsVisible(true)}>
              <MoreVertical size={20} color={isAmoled ? "#ffffff" : ((theme.id === "light" || theme.id === "pink") ? "#111111" : "#ffffff")} />
            </TouchableOpacity>
          </View>
        </View>

        {pinnedMessage && (
          <View style={{
            position: "absolute",
            top: Platform.OS === "web" ? 80 : (Platform.OS === "ios" ? 104 : 96),
            left: 10,
            right: 10,
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
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.accent || "#5865F2" }}>Pinned Message</Text>
                <Text style={{ fontSize: 13, color: isAmoled ? "#fff" : theme.text }} numberOfLines={1}>{pinnedMessage.text}</Text>
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
                  ? (Platform.OS === "web" ? 134 : (Platform.OS === "ios" ? 158 : 150))
                  : (Platform.OS === "web" ? 92 : (Platform.OS === "ios" ? 116 : 108)),
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
            keyExtractor={item => item.id}
            inverted
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 10 }} /> : null}
            contentContainerStyle={styles.listContainer}
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
              paddingBottom: viewportBottom > 0 ? 6 : (Platform.OS === "web" ? 20 : (Platform.OS === "ios" ? 28 : 16))
            },
            showWallpaper && { backgroundColor: "transparent" }
          ]}>
            {isTyping && (
              <View style={[
                styles.typingBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.65)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.88)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
              ]}>
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
              <View style={{ backgroundColor: isAmoled ? "#111" : theme.surface, padding: 12, borderRadius: 16, marginBottom: 8, elevation: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: isAmoled ? "#aaa" : theme.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Select Font for this Message</Text>
                <FlatList
                  horizontal
                  data={FONT_OPTIONS}
                  keyExtractor={(item) => item.value}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: messageFont === item.value ? theme.accent : (isAmoled ? "#222" : "rgba(255,255,255,0.08)"),
                        borderRadius: 16,
                        marginRight: 8,
                      }}
                      onPress={() => setMessageFont(item.value)}
                    >
                      <Text style={{ 
                        color: messageFont === item.value ? "#fff" : (isAmoled ? "#ddd" : theme.text), 
                        fontFamily: item.value === "system" ? undefined : item.value 
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

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
                    {isFeatureEnabled("custom_fonts", myProfile, publicFeatures) && (
                      <TouchableOpacity style={styles.inputIconButton} onPress={() => setFontPickerOpen(!fontPickerOpen)}>
                        <Type size={20} color={fontPickerOpen ? (theme.accent || "#fff") : (theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted))} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.inputIconButton} onPress={() => setStickerPickerOpen(true)}>
                      <Sticker size={20} color={theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted)} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputIconButton} onPress={() => setEmojiOpen(true)}>
                      <Smile size={20} color={theme.id === "pink" ? (theme.accent || "#f472b6") : (isAmoled ? "#888888" : theme.textMuted)} />
                    </TouchableOpacity>
                    <TextInput 
                      ref={textInputRef}
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
                      onChangeText={(text) => {
                        setInputText(text);
                        const now = Date.now();
                        if (typingChannelRef.current && user && now - lastTypingSentRef.current > 2000) {
                          lastTypingSentRef.current = now;
                          typingChannelRef.current.send({
                            type: "broadcast",
                            event: "typing",
                            payload: {
                              user_id: user.id,
                              username: user.user_metadata?.username || myNicknameFromPartner || "Someone",
                            },
                          });
                        }
                      }}
                      onFocus={() => {
                        if (Platform.OS === "web" && typeof window !== "undefined") {
                          setTimeout(() => {
                            window.scrollTo(0, 0);
                            document.documentElement.scrollTop = 0;
                            document.body.scrollTop = 0;
                          }, 50);
                        }
                      }}
                      onKeyPress={(e: any) => {
                        if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) { e.preventDefault(); sendMessage(); }
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
          targetUser={targetUser}
          currentSettings={chatSettings} 
          onSettingsSaved={(newSettings) => {
            setChatSettings(newSettings);
            if (newSettings.partner_nickname !== undefined || newSettings.nickname !== undefined) {
              const newNick = newSettings.partner_nickname || newSettings.nickname || null;
              setTargetUser((prev: any) => prev ? { ...prev, nickname: newNick } : prev);
            }
          }} 
          onSendAlert={handleSendAlert} 
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
          onGroupUpdated={(updated) => {
            setGroupChatData((prev: any) => ({ ...prev, ...updated }));
          }}
        />
      )}
      <Modal visible={!!imageViewerUrl} transparent animationType="fade" onRequestClose={() => setImageViewerUrl(null)}>
        <TouchableOpacity style={styles.imageViewerOverlay} activeOpacity={1} onPress={() => setImageViewerUrl(null)}>
          {imageViewerUrl && <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImg} resizeMode="contain" />}
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUrl(null)}><X size={28} color="#fff" /></TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: isAmoled ? "#000000" : theme.background }}>
        <View style={{ width: 380, height: "100%" }}>
          <ChatSidebar
            activeChatId={id as string}
            onSelectChat={(selectedId, selectedName) => {
              if (selectedId === id) return;
              router.replace({ pathname: "/chat", params: { id: selectedId, name: selectedName } });
            }}
          />
        </View>
        <View key={id as string} style={{ flex: 1, height: "100%", position: "relative" }}>
          {chatViewContent}
        </View>
      </View>
    );
  }

  return chatViewContent;
}

const createStyles = (isAmoled: boolean, theme: any) => {
  const bg = isAmoled ? '#000000' : theme.background;
  const surface = isAmoled ? '#000000' : '#2b2d31';
  const border = isAmoled ? '#222222' : '#1e1f22';
  const text = isAmoled ? '#ffffff' : '#dbdee1';
  const textMuted = isAmoled ? '#888888' : '#949ba4';
  const accent = isAmoled ? '#ffffff' : '#5865F2';
  const inputBg = isAmoled ? '#000000' : theme.surface;

  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: bg },
  container: { flex: 1, height: "100%", backgroundColor: bg, maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: (Platform.OS === "web" && !isAmoled) ? 1 : 0, borderRightWidth: (Platform.OS === "web" && !isAmoled) ? 1 : 0, borderColor: isAmoled ? "#000000" : border, overflow: "hidden" },
  floatingHeaderWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "ios" ? 52 : 44,
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
  headerTitle: { color: text, fontSize: 16, fontWeight: "700" },
  hashIcon: { color: textMuted, fontSize: 18, fontWeight: "400" },
  lastSeenText: { color: "#23a559", fontSize: 12, fontWeight: "600", marginTop: 2 },
  groupSubtitle: { color: textMuted, fontSize: 12, fontWeight: "500", marginTop: 2 },
  streakText: { color: "#f43f5e", fontSize: 12, fontWeight: "600", marginTop: 2 },
  offlineText: { color: textMuted },
  emptyContainer: { flex: 1, justifyContent: "flex-end", padding: 16, paddingBottom: 40 },
  hashCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: inputBg, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  welcomeTitle: { color: text, fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  welcomeSubtitle: { color: textMuted, fontSize: 16 },
  listContainer: { paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 82 : 98, paddingBottom: 110 },
  messageContainer: { flexDirection: "row", marginBottom: 18 },
  messageContainerLeft: { justifyContent: "flex-start" },
  messageContainerRight: { justifyContent: "flex-end" },
  avatarSlot: { width: 40, marginRight: 16 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  dimOverlay: { ...StyleSheet.absoluteFill },
  emptyPreviewBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: surface },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  messageContent: { maxWidth: "80%" },
  messageContentLeft: { alignItems: "flex-start" },
  messageContentRight: { alignItems: "flex-end" },
  messageSender: { color: text, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageBubbleLeft: { backgroundColor: surface, borderBottomLeftRadius: 4 },
  messageBubbleRight: { backgroundColor: accent, borderBottomRightRadius: 4 },
  bubbleFlatTop: { borderTopRightRadius: 4 },
  bubbleFlatTopLeft: { borderTopLeftRadius: 4 },
  bubbleFlatBottom: { borderBottomLeftRadius: 4 },
  bubbleFlatBottomRight: { borderBottomRightRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageTextLeft: { color: text },
  messageTextRight: { color: text },
  msgMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { color: textMuted, fontSize: 12, fontWeight: "500" },
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
  replyQuoteSender: { color: text, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyQuoteText: { color: textMuted, fontSize: 13 },
  messageActions: { position: "absolute", top: -12, right: 10, backgroundColor: surface, borderRadius: 8, padding: 4, flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  actionIcon: { padding: 6 },
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
  typingText: { fontSize: 13, fontStyle: "italic", fontWeight: "600" },
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
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
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
  replyBannerSender: { fontSize: 12, fontWeight: "700" },
  replyBannerText: { fontSize: 13 },
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
  editingBannerText: { fontSize: 14, fontWeight: "bold" },
  inputArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "web" ? 22 : (Platform.OS === "ios" ? 28 : 16),
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
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  imageViewerImg: { width: "100%", height: "85%" } as any,
  imageViewerClose: { position: "absolute", top: 48, right: 24, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24 },
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

// --- MessageRow Component for Animations & Gradients ---
const MessageRow = React.memo(({ item, index, messages, targetUser, chatSettings, hoveredMsg, setHoveredMsg, setReplyingTo, setEditingMsgId, setInputText, deleteMessage, handleApplyWallpaper, setSettingsVisible, setImageViewerUrl, handlePinMessage, isAmoled, styles, theme, isHighlighted, onScrollToMessage }: any) => {
  const isNew = index === 0;
  const scale = useSharedValue(isNew ? 0.8 : 1);
  const opacity = useSharedValue(isNew ? 0 : 1);
  const highlightAnim = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightAnim.value = withSequence(
        withTiming(1, { duration: 250 }),
        withDelay(1400, withTiming(0, { duration: 700 }))
      );
      scale.value = withSequence(
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 50) {
          setReplyingTo({ id: item.id, text: item.text, sender: item.sender });
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isNew) {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withSpring(1);
    }
  }, [isNew, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Album Grouping logic for WhatsApp style multi-media clumps
  const isMedia = item.type === "image" || item.type === "video";
  const albumGroup: any[] = [];
  let isAlbumLeader = false;

  if (isMedia && !item.reply_to_id) {
    let startIdx = index;
    while (startIdx > 0) {
      const prev = messages[startIdx - 1];
      if (prev && (prev.type === "image" || prev.type === "video") && prev.sender_id === item.sender_id && !prev.reply_to_id && Math.abs(item.created_at_ts - prev.created_at_ts) <= 10000) {
        startIdx--;
      } else {
        break;
      }
    }

    let endIdx = index;
    while (endIdx < messages.length - 1) {
      const next = messages[endIdx + 1];
      if (next && (next.type === "image" || next.type === "video") && next.sender_id === item.sender_id && !next.reply_to_id && Math.abs(item.created_at_ts - next.created_at_ts) <= 10000) {
        endIdx++;
      } else {
        break;
      }
    }

    if (endIdx - startIdx >= 1) {
      if (index === startIdx) {
        isAlbumLeader = true;
        for (let i = startIdx; i <= endIdx; i++) {
          albumGroup.push(messages[i]);
        }
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
  const sentColor = isAmoled ? "#000000" : (chatSettings?.bubble_color_sent || "#5865F2");
  const receivedColor = isAmoled ? "#000000" : (chatSettings?.bubble_color_received || "#2b2d31");
  const bubbleTextColor = isAmoled ? "#ffffff" : undefined;
  const gradientEnabled = chatSettings?.bubble_gradient_enabled || false;
  const gradientColor2 = chatSettings?.bubble_gradient_color2 || "#a78bfa";
  const shape = chatSettings?.bubble_shape || "round";
  
  let radius = 18;
  if (shape === "soft") radius = 10;
  if (shape === "sharp") radius = 4;

  const bubbleStyles: any[] = [
    styles.messageBubble, 
    { borderRadius: radius },
    item.isMe 
      ? { backgroundColor: item.type === "sticker" ? "transparent" : (gradientEnabled ? "transparent" : sentColor), borderBottomRightRadius: 4 } 
      : { backgroundColor: item.type === "sticker" ? "transparent" : receivedColor, borderBottomLeftRadius: 4 },
    (item.type === "image" || item.type === "video") && { paddingHorizontal: 2, paddingVertical: 2 }, item.type === "sticker" && { paddingHorizontal: 0, paddingVertical: 0 }
  ];
  if (item.isMe) { if (groupWithPrev) bubbleStyles.push({ borderTopRightRadius: 4 }); if (groupWithNext) bubbleStyles.push({ borderBottomRightRadius: 4 }); }
  else { if (groupWithPrev) bubbleStyles.push({ borderTopLeftRadius: 4 }); if (groupWithNext) bubbleStyles.push({ borderBottomLeftRadius: 4 }); }

  const isRead = item.isMe && targetUser?.last_read_at && item.created_at_ts <= new Date(targetUser.last_read_at).getTime();

  const renderBubbleContent = () => {
    if (isAlbumLeader && albumGroup.length > 1) {
      return <MediaAlbumGrid items={albumGroup} setImageViewerUrl={setImageViewerUrl} />;
    }
    if (item.type === "sticker") return <Image source={{ uri: item.text }} style={{ width: 140, height: 140 }} resizeMode="contain" />;
    if (item.type === "image") {
      return <DynamicImage uri={item.text} onPress={() => setImageViewerUrl(item.text)} />;
    }
    if (item.type === "audio") {
      return <AudioPlayerBubble audioUrl={item.text} isMe={item.isMe} />;
    }
    if (item.type === "video") {
      return <VideoPlayerBubble videoUrl={item.text} isMe={item.isMe} />;
    }
    const activeFont = item.custom_font || chatSettings?.font_family;
    return (
      <Text style={[styles.messageText, item.isMe ? styles.messageTextRight : styles.messageTextLeft,
        activeFont && activeFont !== "system" ? { fontFamily: activeFont } : {},
        bubbleTextColor ? { color: bubbleTextColor } : {}]}>
        {typeof item.text === "string" ? item.text : (item.text ? JSON.stringify(item.text) : "")}
      </Text>
    );
  };

  const handleBubbleContextMenu = (e: any) => {
    if (Platform.OS === "web") {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("open_ala_context_menu", {
          detail: { x: e.clientX, y: e.clientY, type: "message", item },
        })
      );
    }
  };

  return (
    <Animated.View style={animatedStyle} {...panResponder.panHandlers}>
      <Pressable
        style={[styles.messageContainer, item.isMe ? styles.messageContainerRight : styles.messageContainerLeft, { marginBottom: groupWithNext ? 2 : 18 }]}
        onHoverIn={() => Platform.OS === "web" && setHoveredMsg(item.id)}
        onHoverOut={() => Platform.OS === "web" && setHoveredMsg(null)}
        onPress={handlePress}
      >
        {!item.isMe && (
          <View style={styles.avatarSlot}>
            {showMeta && (item.avatar
              ? <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
              : <View style={[styles.messageAvatar, styles.avatarFallback]}><User size={20} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} /></View>
            )}
          </View>
        )}
        <View
          style={[styles.messageContent, item.isMe ? styles.messageContentRight : styles.messageContentLeft]}
          {...({
            onContextMenu: handleBubbleContextMenu,
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
          
          {item.isMe && gradientEnabled && item.type !== "sticker" ? (
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
            <View style={[styles.messageActions, item.isMe ? { right: '100%', marginRight: 8, top: 0 } : { left: '100%', marginLeft: 8, top: 0, right: 'auto' }]}>
              <TouchableOpacity onPress={() => setReplyingTo({ id: item.id, text: item.text, sender: item.sender })} style={styles.actionIcon}>
                <Reply size={16} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { handlePinMessage(item); setHoveredMsg(null); }} style={styles.actionIcon}>
                <Pin size={16} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} />
              </TouchableOpacity>
              {item.isMe && (
                <>
                  <TouchableOpacity onPress={() => { setEditingMsgId(item.id); setInputText(item.text); setHoveredMsg(null); }} style={styles.actionIcon}>
                    <Edit2 size={16} color={isAmoled ? "#888888" : (theme?.textMuted || "#b5bac1")} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteMessage(item.id)} style={styles.actionIcon}>
                    <Trash2 size={16} color="#f23f43" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});












