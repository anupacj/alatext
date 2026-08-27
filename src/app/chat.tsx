import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, SafeAreaView, KeyboardAvoidingView, Platform, Pressable,
  LayoutAnimation, UIManager, Modal, ActivityIndicator, PanResponder
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Video, Hash, Plus, Send, User, MoreVertical, Trash2, Edit2, X, Check, CheckCheck, Reply, Heart, Smile, Type, Sticker, Users } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CustomEmojiPicker from '../components/CustomEmojiPicker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChatSettingsModal, { FONT_OPTIONS } from '../components/ChatSettingsModal';
import StickerPicker from '../components/StickerPicker';
import { HeartPing } from "../components/HeartPing";
import { DoodleOverlay } from "../components/DoodleOverlay";
import ChatInfoModal from "../components/ChatInfoModal";
import { supabase } from "../lib/supabase";
import { uploadChatImageToR2 } from "../lib/r2";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

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
  const isTargetOnline = targetUser && targetUser.updated_at 
    ? Date.now() - new Date(targetUser.updated_at).getTime() < 45 * 1000 
    : false;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [messageFont, setMessageFont] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<any>(null);
  const [pingVisible, setPingVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null);
  const profileCache = useRef<Map<string, any>>(new Map());
  const fileInputRef = useRef<any>(null);

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
      try {
        const cachedSettings = await AsyncStorage.getItem(`chat_${id}_settings`);
        if (cachedSettings) setChatSettings(JSON.parse(cachedSettings));
      } catch (e) {}

      const { data: mySettings } = await supabase.from("chat_participants").select("*").eq("chat_id", id).eq("user_id", user.id).single();
      if (mySettings) {
        setChatSettings(mySettings);
        AsyncStorage.setItem(`chat_${id}_settings`, JSON.stringify(mySettings)).catch(() => {});
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
        const alertMsg = data.find(m => {
          if (m.type !== "alert" || m.sender_id === user?.id) return false;
          return (now - new Date(m.created_at).getTime()) < 10 * 60 * 1000;
        });
        if (alertMsg) {
          try {
            setCustomAlert({ ...JSON.parse(alertMsg.content), messageId: alertMsg.id });
          } catch (e) {}
        }
        
        const filtered = data.filter(m => m.type !== "alert");
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
              try { setCustomAlert({ ...JSON.parse(payload.new.content), messageId: payload.new.id }); } catch (e) {}
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
            return [nm, ...prev];
          });
        } else if (payload.eventType === "DELETE") {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, text: payload.new.content } : m));
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
      .on("broadcast", { event: "custom_alert" }, (payload) => {
        setCustomAlert(payload.payload);
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
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: "sent" } : m));
      }
    }
  }, [inputText, user, id, editingMsgId, replyingTo, messageFont]);

  const deleteMessage = useCallback(async (msgId: string) => {
    const saved = messages.find(m => m.id === msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId)); setHoveredMsg(null);
    const { error } = await supabase.from("messages").delete().eq("id", msgId).eq("sender_id", user?.id);
    if (error && saved) {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.created_at_ts < saved.created_at_ts);
        const arr = [...prev]; arr.splice(idx === -1 ? 0 : idx, 0, saved); return arr;
      });
    }
  }, [messages, user?.id]);

  const handleUploadFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setUploadingImage(true);
      try {
        const url = await uploadChatImageToR2(id as string, base64, file.type);
        await supabase.from("messages").insert({ 
          chat_id: id, sender_id: user?.id, content: url, type: "image",
          reply_to_id: replyingTo?.id || null, reply_to_content: replyingTo?.text || null, reply_to_sender: replyingTo?.sender || null
        });
        setReplyingTo(null);
      } catch (e) { console.error(e); }
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  }, [id, user?.id, replyingTo]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePaste = (e: any) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
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
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0].base64) {
      setUploadingImage(true);
      try {
        const url = await uploadChatImageToR2(id as string, result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
        await supabase.from("messages").insert({ 
          chat_id: id, sender_id: user?.id, content: url, type: "image",
          reply_to_id: replyingTo?.id || null, reply_to_content: replyingTo?.text || null, reply_to_sender: replyingTo?.sender || null
        });
        setReplyingTo(null);
      } catch (e) { console.error(e); }
      setUploadingImage(false);
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

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    return (
      <MessageRow isAmoled={isAmoled} styles={styles} theme={theme}
          item={item} index={index} messages={messages} targetUser={targetUser} chatSettings={chatSettings}
        hoveredMsg={hoveredMsg} setHoveredMsg={setHoveredMsg} setReplyingTo={setReplyingTo}
        setEditingMsgId={setEditingMsgId} setInputText={setInputText} deleteMessage={deleteMessage}
        handleApplyWallpaper={handleApplyWallpaper} setSettingsVisible={setSettingsVisible} setImageViewerUrl={setImageViewerUrl}
      />
    );
  }, [messages, hoveredMsg, targetUser, chatSettings, isGroup, handleApplyWallpaper, deleteMessage]);


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
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
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
              <Text style={[styles.headerTitle, { color: isAmoled ? "#ffffff" : (theme.id === "light" ? "#111111" : theme.id === "pink" ? "#5c0a2e" : "#ffffff") }]} numberOfLines={1}>
                {isGroup ? (groupChatData?.name || name || "Group Chat") : (name || "chat")}
              </Text>
              {isGroup ? (
                <Text style={styles.groupSubtitle}>
                  {groupMemberCount > 0 ? `${groupMemberCount} members` : "Group"}
                </Text>
              ) : targetUser ? (
                <Text style={[styles.lastSeenText, !isTargetOnline && styles.offlineText]}>
                  {isTargetOnline ? "● Online" : "○ Offline"}
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
              onPress={() => {
                if (typingChannelRef.current) {
                  typingChannelRef.current.send({ type: "broadcast", event: "ping", payload: {} });
                  setPingVisible(true);
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
              <Text style={styles.welcomeTitle}>Welcome to #{name || "chat"}!</Text>
              <Text style={styles.welcomeSubtitle}>This is the start of this conversation.</Text>
            </View>
          ) : (
            <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage}
              extraData={targetUser?.last_read_at}
              inverted contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}
              onEndReached={loadOlderMessages} onEndReachedThreshold={0.3}
              ListFooterComponent={loadingOlder ? <ActivityIndicator color={isAmoled ? "#ffffff" : "#5865F2"} style={{ paddingVertical: 12 }} /> : null} />
          )}
          {isTyping && targetUser && (
            <View style={styles.typingBanner}><Text style={styles.typingText}>{targetUser.username} is typing<SendingDots /></Text></View>
          )}
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Reply size={16} color={isAmoled ? "#ffffff" : "#5865F2"} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyBannerSender}>{replyingTo.sender}</Text>
                {replyingTo.text?.startsWith("http") ? (
                  <Image source={{ uri: replyingTo.text }} style={{ width: 32, height: 32, borderRadius: 4, marginTop: 4 }} resizeMode="cover" />
                ) : (
                  <Text style={styles.replyBannerText} numberOfLines={1}>{replyingTo.text}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={20} color={isAmoled ? "#888888" : theme.textMuted} /></TouchableOpacity>
            </View>
          )}
          {editingMsgId && (
            <View style={styles.editingBanner}>
              <Text style={styles.editingBannerText}>Editing Message</Text>
              <TouchableOpacity onPress={() => { setEditingMsgId(null); setInputText(""); }}><X size={16} color={isAmoled ? "#888888" : theme.textMuted} /></TouchableOpacity>
            </View>
          )}
          {fontPickerOpen && (
            <View style={{ backgroundColor: "#2b2d31", padding: 12, marginHorizontal: 16, borderTopLeftRadius: 8, borderTopRightRadius: 8, elevation: 4 }}>
              <Text style={{ color: "#dbdee1", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Select Font for this Message</Text>
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
                      backgroundColor: messageFont === item.value ? "#5865F2" : "#383a40",
                      borderRadius: 16,
                      marginRight: 8,
                    }}
                    onPress={() => setMessageFont(item.value)}
                  >
                    <Text style={{ 
                      color: messageFont === item.value ? "#fff" : "#dbdee1", 
                      fontFamily: item.value === "system" ? undefined : item.value 
                    }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={[styles.inputArea, showWallpaper && { backgroundColor: "transparent" }, fontPickerOpen && { paddingTop: 8 }]}>
            <View style={[
              styles.inputWrapper, 
              showWallpaper && { backgroundColor: "rgba(56,58,64,0.85)" },
              (theme.id === 'light' || theme.id === 'pink') && !showWallpaper && !isAmoled && { backgroundColor: theme.surface }
            ]}>
              <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={uploadingImage}>
                {uploadingImage ? <ActivityIndicator size="small" color={isAmoled ? "#ffffff" : "#fff"} /> : <Plus size={18} color={isAmoled ? "#ffffff" : "#fff"} />}
              </TouchableOpacity>
              {Platform.OS === "web" && (
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" } as any} onChange={handleWebFileChange} />
              )}
              <TouchableOpacity style={styles.inputIconButton} onPress={() => setFontPickerOpen(!fontPickerOpen)}>
                <Type size={19} color={fontPickerOpen ? (isAmoled ? "#ffffff" : theme.accent) : (isAmoled ? "#888888" : theme.textMuted)} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputIconButton} onPress={() => setStickerPickerOpen(true)}>
                <Sticker size={20} color={isAmoled ? "#888888" : theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputIconButton} onPress={() => setEmojiOpen(true)}>
                <Smile size={20} color={isAmoled ? "#888888" : theme.textMuted} />
              </TouchableOpacity>
              <TextInput 
                style={[
                  styles.textInput, 
                  messageFont && messageFont !== "system" ? { fontFamily: messageFont } : {}
                ]} 
                placeholder={`Message #${name || "chat"}`} 
                placeholderTextColor={isAmoled ? "#888888" : theme.textMuted}
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
                {
                  backgroundColor: inputText.trim()
                    ? (isAmoled ? "#ffffff" : (theme.accent || "#5865F2"))
                    : (isAmoled ? "#1a1a1a" : (theme.id === "light" ? "#e0e0e0" : "#2b2d31"))
                }
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              {chatSettings?.send_button_emoji ? (
                <Text style={{ fontSize: 20 }}>{chatSettings.send_button_emoji}</Text>
              ) : (
                <Send
                  size={19}
                  color={
                    inputText.trim()
                      ? (isAmoled ? "#000000" : "#ffffff")
                      : (isAmoled ? "#444444" : theme.textMuted)
                  }
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
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
      <Modal visible={!!customAlert} transparent animationType="fade" onRequestClose={() => { if (customAlert?.messageId) supabase.from('messages').delete().eq('id', customAlert.messageId).then(); setCustomAlert(null); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 440, backgroundColor: '#313338', borderRadius: 8, overflow: 'hidden' }}>
            <View style={{ padding: 24, paddingBottom: 16 }}>
              <Text style={{ color: '#f2f3f5', fontSize: 20, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 }}>{customAlert?.title}</Text>
              <Text style={{ color: '#dbdee1', fontSize: 16, lineHeight: 22 }}>{customAlert?.message}</Text>
            </View>
            <View style={{ backgroundColor: '#2b2d31', padding: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => { if (customAlert?.messageId) supabase.from('messages').delete().eq('id', customAlert.messageId).then(); setCustomAlert(null); }} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: '#f2f3f5', fontSize: 15, fontWeight: '500' }}>{customAlert?.cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (customAlert?.messageId) supabase.from('messages').delete().eq('id', customAlert.messageId).then(); setCustomAlert(null); }} style={{ backgroundColor: '#f23f43', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4 }}>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{customAlert?.actionText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  container: { flex: 1, backgroundColor: bg, maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: Platform.OS === "web" ? 1 : 0, borderRightWidth: Platform.OS === "web" ? 1 : 0, borderColor: border, overflow: "hidden" },
  floatingHeaderWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "ios" ? 6 : 10,
    paddingBottom: 6,
    zIndex: 20,
    gap: 8,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
    backdropFilter: "blur(20px)",
  } as any,
  headerBackPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerProfilePill: {
    flex: 1,
    height: 44,
    paddingLeft: 4,
    paddingRight: 12,
  },
  headerActionsPill: {
    height: 44,
    paddingHorizontal: 4,
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
  listContainer: { paddingHorizontal: 16, paddingVertical: 12 },
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
  inlineImage: { width: 200, height: 200, borderRadius: 12 },
  replyQuote: { borderRadius: 8, padding: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: accent, backgroundColor: "rgba(88,101,242,0.15)", maxWidth: 240 },
  replyQuoteLeft: { alignSelf: "flex-start" },
  replyQuoteRight: { alignSelf: "flex-end" },
  replyQuoteSender: { color: text, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyQuoteText: { color: textMuted, fontSize: 13 },
  messageActions: { position: "absolute", top: -12, right: 10, backgroundColor: surface, borderRadius: 8, padding: 4, flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  actionIcon: { padding: 6 },
  typingBanner: { paddingHorizontal: 24, paddingBottom: 4 },
  typingText: { color: textMuted, fontSize: 13, fontStyle: "italic" },
  replyBanner: { flexDirection: "row", alignItems: "center", backgroundColor: surface, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderLeftWidth: 3, borderLeftColor: accent },
  replyBannerSender: { color: accent, fontSize: 12, fontWeight: "700" },
  replyBannerText: { color: textMuted, fontSize: 13 },
  editingBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: surface, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 16, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  editingBannerText: { color: textMuted, fontSize: 14, fontWeight: "bold" },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: bg,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: inputBg,
    borderRadius: 25,
    paddingLeft: 8,
    paddingRight: 16,
    height: 48,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: isAmoled ? "#222222" : (theme.id === "light" ? "#e5e7eb" : theme.id === "pink" ? "#fbcfe8" : "#3f4147"),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    backdropFilter: "blur(16px)",
  } as any,
  attachButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isAmoled ? "#222" : (theme.id === "light" || theme.id === "pink" ? (theme.accent || "#ec4899") : "#5865F2"),
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  inputIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    color: isAmoled ? "#ffffff" : theme.text,
    fontSize: 15,
    lineHeight: Platform.OS === "web" ? 20 : undefined,
    height: Platform.OS === "web" ? 36 : undefined,
    minHeight: 36,
    maxHeight: 100,
    paddingTop: Platform.OS === "web" ? 8 : 6,
    paddingBottom: Platform.OS === "web" ? 8 : 6,
    paddingHorizontal: 8,
    alignSelf: "center",
    outlineStyle: "none" as any,
    textAlignVertical: "center",
  },
  circularSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  systemMessageContainer: { paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  systemMessageText: { color: textMuted, fontSize: 14, fontStyle: "italic", textAlign: "center" },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  imageViewerImg: { width: "100%", height: "85%" } as any,
  imageViewerClose: { position: "absolute", top: 48, right: 24, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24 },
});
};


// --- MessageRow Component for Animations & Gradients ---
const MessageRow = React.memo(({ item, index, messages, targetUser, chatSettings, hoveredMsg, setHoveredMsg, setReplyingTo, setEditingMsgId, setInputText, deleteMessage, handleApplyWallpaper, setSettingsVisible, setImageViewerUrl, isAmoled, styles, theme }: any) => {
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
    item.type === "image" && { paddingHorizontal: 4, paddingVertical: 4 }, item.type === "sticker" && { paddingHorizontal: 0, paddingVertical: 0 }
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
    const activeFont = item.custom_font || chatSettings?.font_family;
    return (
      <Text style={[styles.messageText, item.isMe ? styles.messageTextRight : styles.messageTextLeft,
        activeFont && activeFont !== "system" ? { fontFamily: activeFont } : {},
        bubbleTextColor ? { color: bubbleTextColor } : {}]}>
        {item.text}
      </Text>
    );
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
        <View style={[styles.messageContent, item.isMe ? styles.messageContentRight : styles.messageContentLeft]}>
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












