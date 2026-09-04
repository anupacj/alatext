import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, SafeAreaView, KeyboardAvoidingView, Platform, Pressable,
  LayoutAnimation, UIManager, Modal, ActivityIndicator, PanResponder,
  Animated as RNAnimated, Easing, Dimensions
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Video, Hash, Plus, Send, User, MoreVertical, Trash2, Edit2, X, Check, CheckCheck, Reply, Heart, Smile, Type, Sticker, Users, Mic, Pin } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CustomEmojiPicker from '../components/CustomEmojiPicker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChatSettingsModal, { FONT_OPTIONS } from '../components/ChatSettingsModal';
import StickerPicker from '../components/StickerPicker';
import { HeartPing } from "../components/HeartPing";
import { DoodleOverlay } from "../components/DoodleOverlay";
import ChatInfoModal from "../components/ChatInfoModal";
import AudioPlayerBubble from "../components/AudioPlayerBubble";
import VideoPlayerBubble from "../components/VideoPlayerBubble";
import VoiceRecorder from "../components/VoiceRecorder";
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
  type: "text" | "image" | "system";
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
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
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
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; sender: string } | null>(null);

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

  const formatMsg = useCallback((msg: any): Message => {
    const ts = new Date(msg.created_at).getTime();
    return {
      id: msg.id,
      sender: msg.profiles?.username || "Unknown",
      sender_id: msg.sender_id,
      text: msg.content,
      type: msg.type || "text",
      created_at: msg.created_at,
      created_at_ts: ts,
      time: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      avatar: msg.profiles?.avatar_url || null,
      isMe: msg.sender_id === user?.id,
      reply_to_id: msg.reply_to_id || null,
      reply_to_content: msg.reply_to_content || null,
      reply_to_sender: msg.reply_to_sender || null,
      custom_font: msg.custom_font,
    };
  }, [user?.id]);


  useEffect(() => {
    if (!id || !user) return;
    setMessages([]); setHasMore(true); setEditingMsgId(null); setReplyingTo(null); setHoveredMsg(null);
    profileCache.current.clear();

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
      const { data: parts } = await supabase.from("chat_participants").select("user_id, last_read_at").eq("chat_id", id).neq("user_id", user.id).limit(1);
      if (parts && parts.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", parts[0].user_id).single();
        if (profile) setTargetUser({ ...profile, last_read_at: parts[0].last_read_at });
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
        
        const filtered = data.filter(m => m.type !== "alert" && m.type !== "deleted");
        const formatted = filtered.map(formatMsg);
        setMessages(formatted); 
        setHasMore(data.length === PAGE_SIZE); 
        AsyncStorage.setItem(`chat_${id}_messages`, JSON.stringify(formatted)).catch(() => {});
      }
    };
    fetchMsgs();

    const channel = supabase.channel(`chat_${id}`)
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
          const ts = new Date(payload.new.created_at).getTime();
          const nm: Message = {
            id: payload.new.id, sender: pd?.username || "Unknown", sender_id: payload.new.sender_id,
            text: payload.new.content, type: payload.new.type || "text", created_at: payload.new.created_at,
            created_at_ts: ts, time: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, text: payload.new.content } : m));
          }
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        if (payload.old?.id) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      }).subscribe();

    const pChannel = supabase.channel(`participants_${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `chat_id=eq.${id}` }, (payload) => {
        if (payload.new.user_id !== user.id) setTargetUser((prev: any) => prev ? { ...prev, last_read_at: payload.new.last_read_at } : prev);
      }).subscribe();

    const profChannel = supabase.channel(`profiles_${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        setTargetUser((prev: any) => {
          if (prev && payload.new.id === prev.id) return { ...prev, updated_at: payload.new.updated_at };
          return prev;
        });
      }).subscribe();

      const tChannel = supabase.channel(`typing_${id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, () => {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      })
      .on("broadcast", { event: "ping" }, () => {
        setPingVisible(true);
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

    // We are reverting presence back to heartbeat for stability as requested.
    // The targetUser's updated_at field will serve as the online indicator.

    const chatChannel = supabase.channel(`chats_${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${id}` }, (payload) => {
        setGroupChatData((prev: any) => ({ ...prev, ...payload.new }));
      }).subscribe();

    return () => {
      supabase.removeChannel(channel); supabase.removeChannel(pChannel); supabase.removeChannel(tChannel); supabase.removeChannel(profChannel); supabase.removeChannel(chatChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    const curEdit = editingMsgId; const curReply = replyingTo; const curFont = messageFont;
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
  }, [inputText, user, id, editingMsgId, replyingTo, messageFont]);

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

  const handleUploadFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith("video");
    setUploadingImage(true);
    try {
      const prefix = isVideo ? `chat-videos/${id}-${Date.now()}` : `chat-images/${id}-${Date.now()}`;
      const url = await uploadBlobToR2(prefix, file);
      await supabase.from("messages").insert({ 
        chat_id: id, sender_id: user?.id, content: url, type: isVideo ? "video" : "image",
        reply_to_id: replyingTo?.id || null, reply_to_content: replyingTo?.text || null, reply_to_sender: replyingTo?.sender || null
      });
      setReplyingTo(null);
    } catch (e: any) {
      console.error("Upload error:", e);
      alert("Failed to upload file: " + (e.message || e));
    } finally {
      setUploadingImage(false);
    }
  }, [id, user?.id, replyingTo]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePaste = (e: any) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1) {
              const file = items[i].getAsFile();
              if (file) handleUploadFile(file);
            }
          }
        }
      };
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }
  }, [handleUploadFile]);

  const handlePickImage = useCallback(async () => {
    if (Platform.OS === "web") { if (fileInputRef.current) fileInputRef.current.click(); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.All });
    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const asset = result.assets[0];
        const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video");
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        const prefix = isVideo ? `chat-videos/${id}-${Date.now()}` : `chat-images/${id}-${Date.now()}`;
        const url = await uploadBlobToR2(prefix, blob);
        await supabase.from("messages").insert({ 
          chat_id: id, sender_id: user?.id, content: url, type: isVideo ? "video" : "image",
          reply_to_id: replyingTo?.id || null, reply_to_content: replyingTo?.text || null, reply_to_sender: replyingTo?.sender || null
        });
        setReplyingTo(null);
      } catch (e: any) {
        console.error("Media pick upload error:", e);
        alert("Failed to upload media: " + (e.message || e));
      } finally {
        setUploadingImage(false);
      }
    }
  }, [id, user?.id, replyingTo]);

  const handleWebFileChange = useCallback((e: any) => {
    const file = e.target.files?.[0]; if (!file) return;
    handleUploadFile(file);
    e.target.value = "";
  }, [handleUploadFile]);

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
      />
    );
  }, [messages, hoveredMsg, targetUser, chatSettings, isGroup, handleApplyWallpaper, deleteMessage, handlePinMessage]);


  return (
    <View style={{ flex: 1, backgroundColor: showWallpaper ? "transparent" : (isAmoled ? "#000000" : theme.background) }}>
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
        {/* 3 Separate Floating glassmorphism pills */}
        <View style={styles.floatingHeaderWrapper}>
          {/* 1. Left Back Button Pill */}
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

          {/* 2. Middle Profile Info Pill */}
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
            activeOpacity={0.7}
          >
            {isGroup ? (
              groupChatData?.avatar_url ? (
                <Image source={{ uri: groupChatData.avatar_url }} style={styles.floatingAvatar} />
              ) : (
                <View style={[styles.floatingAvatar, { backgroundColor: isAmoled ? '#222' : theme.accent, justifyContent: 'center', alignItems: 'center' }]}>
                  <Users size={18} color="#fff" />
                </View>
              )
            ) : targetUser?.avatar_url ? (
              <Image source={{ uri: targetUser.avatar_url }} style={styles.floatingAvatar} />
            ) : (
              <View style={[styles.floatingAvatar, { backgroundColor: isAmoled ? '#222' : theme.accent, justifyContent: 'center', alignItems: 'center' }]}>
                <User size={18} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}>
              <Text 
                style={[
                  styles.headerTitle, 
                  { color: isAmoled ? "#ffffff" : (theme.id === "light" ? "#111111" : theme.id === "pink" ? "#5c0a2e" : "#ffffff") },
                  messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}
                ]} 
                numberOfLines={1}
              >
                {isGroup ? (groupChatData?.name || name || "Group Chat") : (name || "chat")}
              </Text>
              {isGroup ? (
                <Text style={[styles.groupSubtitle, messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}]}>
                  {groupMemberCount > 0 ? `${groupMemberCount} members` : "Group"}
                </Text>
              ) : targetUser ? (
                <Text style={[
                  styles.lastSeenText, 
                  !isTargetOnline && styles.offlineText,
                  messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}
                ]}>
                  {formatLastSeenText(targetUser, isTargetOnline)}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* 3. Right Action Buttons Pill */}
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
              style={styles.floatingIconBtn}
              onPress={async () => {
                setPingVisible(true);
                if (typingChannelRef.current) {
                  typingChannelRef.current.send({ type: "broadcast", event: "ping", payload: { sender_id: user?.id } });
                }
                if (id && user) {
                  await supabase.from("messages").insert({
                    chat_id: id,
                    sender_id: user.id,
                    content: "❤️ Sent a heart ping! Thinking of you...",
                    type: "ping",
                  });
                }
              }}
            >
              <Heart size={20} color="#f23f43" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingIconBtn} onPress={() => setSettingsVisible(true)}>
              <MoreVertical size={20} color={isAmoled ? "#ffffff" : ((theme.id === "light" || theme.id === "pink") ? "#111111" : "#ffffff")} />
            </TouchableOpacity>
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: showWallpaper ? "transparent" : (isAmoled ? "#000000" : theme.background) }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <DoodleOverlay type={chatSettings?.wallpaper_doodle || "none"} />
          <HeartPing visible={pingVisible} onComplete={() => setPingVisible(false)} />
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.hashCircle}><Hash size={40} color="#ffffff" /></View>
              <Text style={[styles.welcomeTitle, messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}]}>Welcome to #{name || "chat"}!</Text>
              <Text style={[styles.welcomeSubtitle, messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}]}>This is the start of this conversation.</Text>
            </View>
          ) : (
            <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage}
              extraData={targetUser?.last_read_at}
              inverted contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}
              onEndReached={loadOlderMessages} onEndReachedThreshold={0.3}
              ListFooterComponent={loadingOlder ? <ActivityIndicator color={isAmoled ? "#ffffff" : "#5865F2"} style={{ paddingVertical: 12 }} /> : null} />
          )}
          <View style={[styles.inputArea, showWallpaper && { backgroundColor: "transparent" }]}>
            {pinnedMessage && (
              <View style={[
                styles.replyBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.88)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.75)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.9)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}
                  onPress={() => {
                    const idx = messages.findIndex(m => m.id === pinnedMessage.id);
                    if (idx !== -1 && flatListRef.current) {
                      flatListRef.current.scrollToIndex({ index: idx, animated: true });
                    }
                  }}
                >
                  <Pin size={16} color={theme.accent} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyBannerSender, { color: theme.accent }]}>Pinned Message • {pinnedMessage.sender}</Text>
                    <Text style={[styles.replyBannerText, { color: isAmoled ? "#aaaaaa" : theme.textMuted }]} numberOfLines={1}>
                      {pinnedMessage.text}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePinMessage(null)} style={{ padding: 4 }}>
                  <X size={16} color={isAmoled ? "#888888" : theme.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {isTyping && targetUser && (
              <View style={[
                styles.typingBanner,
                isAmoled ? { backgroundColor: 'rgba(0,0,0,0.88)', borderColor: '#222' } :
                showWallpaper ? { backgroundColor: 'rgba(20,20,30,0.75)', borderColor: 'rgba(255,255,255,0.12)' } :
                theme.id === 'light' ? { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(0,0,0,0.08)' } :
                theme.id === 'pink' ? { backgroundColor: 'rgba(252,231,243,0.9)', borderColor: 'rgba(131,24,67,0.12)' } :
                { backgroundColor: 'rgba(43,45,49,0.88)', borderColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <Text style={[styles.typingText, { color: isAmoled ? "#ffffff" : (theme.id === "light" || theme.id === "pink" ? "#333333" : "#ffffff") }]}>
                  {targetUser.username} is typing<SendingDots />
                </Text>
              </View>
            )}

            {replyingTo && (
              <View style={[
                styles.replyBanner,
                {
                  backgroundColor: isAmoled ? 'rgba(0,0,0,0.92)' : showWallpaper ? 'rgba(28,30,38,0.85)' : theme.id === 'light' ? 'rgba(255,255,255,0.9)' : theme.id === 'pink' ? 'rgba(252,231,243,0.9)' : 'rgba(43,45,49,0.88)',
                  borderColor: isAmoled ? '#222222' : showWallpaper ? 'rgba(255,255,255,0.12)' : theme.id === 'light' ? 'rgba(0,0,0,0.08)' : theme.id === 'pink' ? 'rgba(131,24,67,0.12)' : 'rgba(255,255,255,0.08)'
                }
              ]}>
                <Reply size={16} color={isAmoled ? "#ffffff" : theme.accent} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyBannerSender, { color: theme.accent }]}>{replyingTo.sender}</Text>
                  {replyingTo.text?.startsWith("http") ? (
                    <Image source={{ uri: replyingTo.text }} style={{ width: 32, height: 32, borderRadius: 4, marginTop: 4 }} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.replyBannerText, { color: isAmoled ? "#aaaaaa" : theme.textMuted }]} numberOfLines={1}>{replyingTo.text}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={20} color={isAmoled ? "#888888" : theme.textMuted} /></TouchableOpacity>
              </View>
            )}

            {editingMsgId && (
              <View style={[
                styles.editingBanner,
                {
                  backgroundColor: isAmoled ? 'rgba(0,0,0,0.92)' : showWallpaper ? 'rgba(28,30,38,0.85)' : theme.id === 'light' ? 'rgba(255,255,255,0.9)' : theme.id === 'pink' ? 'rgba(252,231,243,0.9)' : 'rgba(43,45,49,0.88)',
                  borderColor: isAmoled ? '#222222' : showWallpaper ? 'rgba(255,255,255,0.12)' : theme.id === 'light' ? 'rgba(0,0,0,0.08)' : theme.id === 'pink' ? 'rgba(131,24,67,0.12)' : 'rgba(255,255,255,0.08)'
                }
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
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: "none" } as any} onChange={handleWebFileChange} />
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
                      messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {},
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
                        typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
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
                {stickerPickerOpen && (
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
        {settingsVisible && (
          <ChatSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)}
            chatId={id as string} userId={user.id} currentSettings={chatSettings} onSettingsSaved={setChatSettings} onSendAlert={handleSendAlert} />
        )}
        {infoVisible && (
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
      </View>
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
  container: { flex: 1, backgroundColor: bg, maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: (Platform.OS === "web" && !isAmoled) ? 1 : 0, borderRightWidth: (Platform.OS === "web" && !isAmoled) ? 1 : 0, borderColor: isAmoled ? "#000000" : border, overflow: "hidden" },
  floatingHeaderWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "ios" ? 44 : 36,
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
  listContainer: { paddingHorizontal: 16, paddingTop: 72, paddingBottom: 110 },
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
  replyQuote: { borderRadius: 8, padding: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: accent, backgroundColor: "rgba(88,101,242,0.15)", maxWidth: 240 },
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 6,
    marginLeft: 4,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    backdropFilter: "blur(16px)",
  } as any,
  typingText: { fontSize: 13, fontStyle: "italic", fontWeight: "500" },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderWidth: 1,
    backdropFilter: "blur(16px)",
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
    backdropFilter: "blur(16px)",
  } as any,
  editingBannerText: { fontSize: 14, fontWeight: "bold" },
  inputArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
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


// --- MessageRow Component for Animations & Gradients ---
const MessageRow = React.memo(({ item, index, messages, targetUser, chatSettings, hoveredMsg, setHoveredMsg, setReplyingTo, setEditingMsgId, setInputText, deleteMessage, handleApplyWallpaper, setSettingsVisible, setImageViewerUrl, handlePinMessage, isAmoled, styles, theme }: any) => {
  const isNew = index === 0;
  const scale = useSharedValue(isNew ? 0.8 : 1);
  const opacity = useSharedValue(isNew ? 0 : 1);

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

  if (item.type === "system") {
    const isWallpaperMsg = item.text.includes("Tap here");
    return (
      <View style={styles.systemMessageContainer}>
        {isWallpaperMsg ? (
          <TouchableOpacity onPress={() => item.isMe ? setSettingsVisible(true) : handleApplyWallpaper()}>
            <Text style={[styles.systemMessageText, { color: "#5865F2" }]}>
              <Text style={{ fontWeight: "bold", color: "#949ba4" }}>{item.sender}</Text> {item.text}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.systemMessageText}>
            <Text style={{ fontWeight: "bold" }}>{item.sender}</Text> {item.text}
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
  // In AMOLED mode, bubble text is always white regardless of bubble color
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

  const renderBubbleContent = () => { if (item.type === "sticker") return <Image source={{ uri: item.text }} style={{ width: 140, height: 140 }} resizeMode="contain" />;
    if (item.type === "image") {
      return (
        <TouchableOpacity onPress={() => setImageViewerUrl(item.text)}>
          <Image source={{ uri: item.text }} style={styles.inlineImage} resizeMode="cover" />
        </TouchableOpacity>
      );
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
        {item.text}
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
          {(!item.isMe && showMeta && !groupWithPrev) && <Text style={styles.messageSender}>{item.sender}</Text>}
          {item.reply_to_id && (
            <View style={[styles.replyQuote, item.isMe ? styles.replyQuoteRight : styles.replyQuoteLeft]}>
              <Text style={styles.replyQuoteSender}>{item.reply_to_sender}</Text>
              {item.reply_to_content?.startsWith("http") ? (
                <Image source={{ uri: item.reply_to_content }} style={{ width: 40, height: 40, borderRadius: 4, marginTop: 2 }} resizeMode="cover" />
              ) : (
                <Text style={styles.replyQuoteText} numberOfLines={1}>{item.reply_to_content}</Text>
              )}
            </View>
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












