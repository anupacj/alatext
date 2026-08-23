import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, SafeAreaView, KeyboardAvoidingView, Platform, Pressable,
  LayoutAnimation, UIManager, Modal, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Video, Hash, Plus, Send, User, MoreVertical, Trash2, Edit2, X, Check, CheckCheck, Reply } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import ChatSettingsModal from "../components/ChatSettingsModal";
import { supabase } from "../lib/supabase";
import { uploadChatImageToR2 } from "../lib/r2";
import { useAuth } from "../context/AuthContext";

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
}


export default function Chat() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [isTargetOnline, setIsTargetOnline] = useState(false);
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
    };
  }, [user?.id]);


  useEffect(() => {
    if (!id || !user) return;
    setMessages([]); setHasMore(true); setEditingMsgId(null); setReplyingTo(null); setHoveredMsg(null);
    profileCache.current.clear();

    const init = async () => {
      const { data: mySettings } = await supabase.from("chat_participants").select("*").eq("chat_id", id).eq("user_id", user.id).single();
      if (mySettings) setChatSettings(mySettings);
      const { data: chatData } = await supabase.from("chats").select("is_group").eq("id", id).single();
      if (chatData?.is_group) setIsGroup(true);
      const { data: parts } = await supabase.from("chat_participants").select("user_id, last_read_at").eq("chat_id", id).neq("user_id", user.id).limit(1);
      if (parts && parts.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", parts[0].user_id).single();
        if (profile) setTargetUser({ ...profile, last_read_at: parts[0].last_read_at });
      }
    };
    init();

    const fetchMsgs = async () => {
      const { data, error } = await supabase.from("messages")
        .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, profiles(username, avatar_url)")
        .eq("chat_id", id).order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (!error && data) { setMessages(data.map(formatMsg)); setHasMore(data.length === PAGE_SIZE); }
    };
    fetchMsgs();

    const channel = supabase.channel(`chat_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, async (payload) => {
        if (payload.eventType === "INSERT") {
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
          };
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => [nm, ...prev]);
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

    const tChannel = supabase.channel(`typing_${id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, () => {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }).subscribe();
    typingChannelRef.current = tChannel;

    // Subscribe to global presence to track if target user is online
    const presenceChannel = supabase.channel("presence_global");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        // Check if any key in presence state matches targetUser's id
        setIsTargetOnline(false); // reset first, will be set below
        Object.keys(state).forEach(key => {
          const presences = state[key] as any[];
          if (presences.some((p: any) => p.user_id && p.user_id !== user?.id)) {
            // We'll refine this once targetUser is loaded
          }
        });
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setTargetUser((prev: any) => {
          if (prev && key === prev.id) setIsTargetOnline(true);
          return prev;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setTargetUser((prev: any) => {
          if (prev && key === prev.id) setIsTargetOnline(false);
          return prev;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // After subscribing, sync the current state
          const state = presenceChannel.presenceState();
          setTargetUser((prev: any) => {
            if (prev) setIsTargetOnline(!!state[prev.id]);
            return prev;
          });
        }
      });

    return () => {
      supabase.removeChannel(channel); supabase.removeChannel(pChannel); supabase.removeChannel(tChannel);
      supabase.removeChannel(presenceChannel);
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
      .select("id, content, type, created_at, sender_id, reply_to_id, reply_to_content, reply_to_sender, profiles(username, avatar_url)")
      .eq("chat_id", id).lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (!error && data) { setMessages(prev => [...prev, ...data.map(formatMsg)]); setHasMore(data.length === PAGE_SIZE); }
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, messages, id, formatMsg]);

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
    setInputText(""); setEditingMsgId(null); setReplyingTo(null);
    if (curEdit) {
      setMessages(prev => prev.map(m => m.id === curEdit ? { ...m, text: content } : m));
      const { error } = await supabase.from("messages").update({ content }).eq("id", curEdit).eq("sender_id", user.id);
      if (error) console.error("Update failed", error);
    } else {
      const { error } = await supabase.from("messages").insert({
        chat_id: id, sender_id: user.id, content, type: "text",
        reply_to_id: curReply?.id || null, reply_to_content: curReply?.text || null, reply_to_sender: curReply?.sender || null,
      });
      if (error) console.error("Send failed", error);
    }
  }, [inputText, user, id, editingMsgId, replyingTo]);

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

  const handlePickImage = useCallback(async () => {
    if (Platform.OS === "web") { if (fileInputRef.current) fileInputRef.current.click(); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0].base64) {
      setUploadingImage(true);
      try {
        const url = await uploadChatImageToR2(id as string, result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
        await supabase.from("messages").insert({ chat_id: id, sender_id: user?.id, content: url, type: "image" });
      } catch (e) { console.error(e); }
      setUploadingImage(false);
    }
  }, [id, user?.id]);

  const handleWebFileChange = useCallback((e: any) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setUploadingImage(true);
      try {
        const url = await uploadChatImageToR2(id as string, base64, file.type);
        await supabase.from("messages").insert({ chat_id: id, sender_id: user?.id, content: url, type: "image" });
      } catch (e) { console.error(e); }
      setUploadingImage(false); e.target.value = "";
    };
    reader.readAsDataURL(file);
  }, [id, user?.id]);

  const getLastSeen = useCallback((d?: string) => {
    if (!d) return "Offline";
    const diff = (Date.now() - new Date(d).getTime()) / 60000;
    if (diff < 5) return "Online";
    if (diff < 60) return `Last seen ${Math.floor(diff)}m ago`;
    if (diff < 1440) return `Last seen ${Math.floor(diff / 60)}h ago`;
    return `Last seen ${Math.floor(diff / 1440)}d ago`;
  }, []);


  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
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

    const bubbleStyles: any[] = [styles.messageBubble, item.isMe ? styles.messageBubbleRight : styles.messageBubbleLeft];
    if (item.isMe) { if (groupWithPrev) bubbleStyles.push(styles.bubbleFlatTop); if (groupWithNext) bubbleStyles.push(styles.bubbleFlatBottomRight); }
    else { if (groupWithPrev) bubbleStyles.push(styles.bubbleFlatTopLeft); if (groupWithNext) bubbleStyles.push(styles.bubbleFlatBottom); }

    const isRead = item.isMe && targetUser?.last_read_at && item.created_at_ts <= new Date(targetUser.last_read_at).getTime();

    return (
      <Pressable
        style={[styles.messageContainer, item.isMe ? styles.messageContainerRight : styles.messageContainerLeft, { marginBottom: groupWithNext ? 2 : 18 }]}
        onHoverIn={() => Platform.OS === "web" && setHoveredMsg(item.id)}
        onHoverOut={() => Platform.OS === "web" && setHoveredMsg(null)}
        onLongPress={() => setHoveredMsg(hoveredMsg === item.id ? null : item.id)}
      >
        {!item.isMe && (
          <View style={styles.avatarSlot}>
            {showMeta && (item.avatar
              ? <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
              : <View style={[styles.messageAvatar, styles.avatarFallback]}><User size={20} color="#b5bac1" /></View>
            )}
          </View>
        )}
        <View style={[styles.messageContent, item.isMe ? styles.messageContentRight : styles.messageContentLeft]}>
          {(!item.isMe && showMeta && !groupWithPrev) && <Text style={styles.messageSender}>{item.sender}</Text>}
          {item.reply_to_content && (
            <View style={[styles.replyQuote, item.isMe ? styles.replyQuoteRight : styles.replyQuoteLeft]}>
              <Text style={styles.replyQuoteSender}>{item.reply_to_sender}</Text>
              <Text style={styles.replyQuoteText} numberOfLines={2}>{item.reply_to_content}</Text>
            </View>
          )}
          <View style={bubbleStyles}>
            {item.type === "image" ? (
              <TouchableOpacity onPress={() => setImageViewerUrl(item.text)}>
                <Image source={{ uri: item.text }} style={styles.inlineImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <Text style={[styles.messageText, item.isMe ? styles.messageTextRight : styles.messageTextLeft,
                chatSettings?.font_family && chatSettings.font_family !== "system" ? { fontFamily: chatSettings.font_family } : {}]}>
                {item.text}
              </Text>
            )}
          </View>
          {item.isMe && showMeta && (
            <View style={styles.msgMeta}>
              <Text style={styles.timeText}>{item.time}</Text>
              {isRead ? <CheckCheck size={14} color="#5865F2" style={styles.checkIcon} /> : <Check size={14} color="#949ba4" style={styles.checkIcon} />}
            </View>
          )}
          {!item.isMe && showMeta && <Text style={[styles.timeText, { alignSelf: "flex-start", marginTop: 4 }]}>{item.time}</Text>}
        </View>
        {hoveredMsg === item.id && item.isMe && (
          <View style={styles.messageActions}>
            <TouchableOpacity onPress={() => setReplyingTo({ id: item.id, text: item.text, sender: item.sender })} style={styles.actionIcon}>
              <Reply size={16} color="#b5bac1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingMsgId(item.id); setInputText(item.text); setHoveredMsg(null); }} style={styles.actionIcon}>
              <Edit2 size={16} color="#b5bac1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteMessage(item.id)} style={styles.actionIcon}>
              <Trash2 size={16} color="#f23f43" />
            </TouchableOpacity>
          </View>
        )}
      </Pressable>
    );

  }, [messages, hoveredMsg, targetUser, chatSettings, isGroup, handleApplyWallpaper, deleteMessage]);


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {chatSettings?.wallpaper_url && (
          <Image source={{ uri: chatSettings.wallpaper_url }}
            style={[StyleSheet.absoluteFillObject, { resizeMode: "cover", transform: [{ scale: chatSettings.wallpaper_zoom || 1 }] }]}
            blurRadius={(chatSettings.wallpaper_blur || 0) * 20} />
        )}
        {chatSettings?.wallpaper_url && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${chatSettings.wallpaper_dim || 0})` }]} />
        )}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.backButton}>
            <ChevronLeft size={28} color="#b5bac1" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}><Text style={styles.hashIcon}># </Text>{name || "chat"}</Text>
            {targetUser && !isGroup && (
              <Text style={[styles.lastSeenText, !isTargetOnline && styles.offlineText]}>
                {isTargetOnline ? "● Online" : "○ Offline"}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.headerIconButton}><Phone size={20} color="#b5bac1" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}><Video size={22} color="#b5bac1" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setSettingsVisible(true)}><MoreVertical size={24} color="#b5bac1" /></TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: chatSettings?.wallpaper_url ? "transparent" : "#313338" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.hashCircle}><Hash size={40} color="#ffffff" /></View>
              <Text style={styles.welcomeTitle}>Welcome to #{name || "chat"}!</Text>
              <Text style={styles.welcomeSubtitle}>This is the start of this conversation.</Text>
            </View>
          ) : (
            <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage}
              inverted contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}
              onEndReached={loadOlderMessages} onEndReachedThreshold={0.3}
              ListFooterComponent={loadingOlder ? <ActivityIndicator color="#5865F2" style={{ paddingVertical: 12 }} /> : null} />
          )}
          {isTyping && targetUser && (
            <View style={styles.typingBanner}><Text style={styles.typingText}>{targetUser.username} is typing...</Text></View>
          )}
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Reply size={16} color="#5865F2" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyBannerSender}>{replyingTo.sender}</Text>
                <Text style={styles.replyBannerText} numberOfLines={1}>{replyingTo.text}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={18} color="#b5bac1" /></TouchableOpacity>
            </View>
          )}
          {editingMsgId && (
            <View style={styles.editingBanner}>
              <Text style={styles.editingBannerText}>Editing Message</Text>
              <TouchableOpacity onPress={() => { setEditingMsgId(null); setInputText(""); }}><X size={16} color="#b5bac1" /></TouchableOpacity>
            </View>
          )}
          <View style={[styles.inputArea, chatSettings?.wallpaper_url && { backgroundColor: "transparent" }]}>
            <View style={[styles.inputWrapper, chatSettings?.wallpaper_url && { backgroundColor: "rgba(56,58,64,0.85)" }]}>
              <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={uploadingImage}>
                {uploadingImage ? <ActivityIndicator size="small" color="#383a40" /> : <Plus size={20} color="#383a40" />}
              </TouchableOpacity>
              {Platform.OS === "web" && (
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" } as any} onChange={handleWebFileChange} />
              )}
              <TextInput style={styles.textInput} placeholder={`Message #${name || "chat"}`} placeholderTextColor="#949ba4"
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
              <TouchableOpacity style={styles.emojiButton} onPress={sendMessage} disabled={!inputText.trim()}>
                <Send size={22} color={inputText.trim() ? "#5865F2" : "#4e5058"} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        {settingsVisible && (
          <ChatSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)}
            chatId={id as string} userId={user.id} currentSettings={chatSettings} onSettingsSaved={setChatSettings} />
        )}
      </View>
      <Modal visible={!!imageViewerUrl} transparent animationType="fade" onRequestClose={() => setImageViewerUrl(null)}>
        <TouchableOpacity style={styles.imageViewerOverlay} activeOpacity={1} onPress={() => setImageViewerUrl(null)}>
          {imageViewerUrl && <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImg} resizeMode="contain" />}
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUrl(null)}><X size={28} color="#fff" /></TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#313338" },
  container: { flex: 1, backgroundColor: "#313338", maxWidth: Platform.OS === "web" ? 800 : ("100%" as any), width: "100%", alignSelf: "center", borderLeftWidth: Platform.OS === "web" ? 1 : 0, borderRightWidth: Platform.OS === "web" ? 1 : 0, borderColor: "#1e1f22" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#313338", borderBottomWidth: 1, borderBottomColor: "#2b2d31", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3, zIndex: 10 },
  backButton: { marginRight: 8, padding: 4 },
  headerTitleContainer: { flex: 1, justifyContent: "center" },
  headerTitle: { color: "#f2f3f5", fontSize: 17, fontWeight: "700" },
  hashIcon: { color: "#80848e", fontSize: 20, fontWeight: "400" },
  lastSeenText: { color: "#23a559", fontSize: 12, fontWeight: "600", marginTop: 2 },
  offlineText: { color: "#949ba4" },
  headerIconButton: { marginLeft: 16 },
  emptyContainer: { flex: 1, justifyContent: "flex-end", padding: 16, paddingBottom: 40 },
  hashCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#4e5058", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  welcomeTitle: { color: "#f2f3f5", fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  welcomeSubtitle: { color: "#b5bac1", fontSize: 16 },
  listContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  messageContainer: { flexDirection: "row", marginBottom: 18 },
  messageContainerLeft: { justifyContent: "flex-start" },
  messageContainerRight: { justifyContent: "flex-end" },
  avatarSlot: { width: 40, marginRight: 16 },
  messageAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2b2d31" },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  messageContent: { maxWidth: "80%" },
  messageContentLeft: { alignItems: "flex-start" },
  messageContentRight: { alignItems: "flex-end" },
  messageSender: { color: "#f2f3f5", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageBubbleLeft: { backgroundColor: "#2b2d31", borderBottomLeftRadius: 4 },
  messageBubbleRight: { backgroundColor: "#5865F2", borderBottomRightRadius: 4 },
  bubbleFlatTop: { borderTopRightRadius: 4 },
  bubbleFlatTopLeft: { borderTopLeftRadius: 4 },
  bubbleFlatBottom: { borderBottomLeftRadius: 4 },
  bubbleFlatBottomRight: { borderBottomRightRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageTextLeft: { color: "#dbdee1" },
  messageTextRight: { color: "#ffffff" },
  msgMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { color: "#949ba4", fontSize: 12, fontWeight: "500" },
  checkIcon: { marginLeft: 4 },
  inlineImage: { width: 200, height: 200, borderRadius: 12 },
  replyQuote: { borderRadius: 8, padding: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: "#5865F2", backgroundColor: "rgba(88,101,242,0.15)", maxWidth: 240 },
  replyQuoteLeft: { alignSelf: "flex-start" },
  replyQuoteRight: { alignSelf: "flex-end" },
  replyQuoteSender: { color: "#5865F2", fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyQuoteText: { color: "#b5bac1", fontSize: 13 },
  messageActions: { position: "absolute", top: -12, right: 10, backgroundColor: "#2b2d31", borderRadius: 8, padding: 4, flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  actionIcon: { padding: 6 },
  typingBanner: { paddingHorizontal: 24, paddingBottom: 4 },
  typingText: { color: "#b5bac1", fontSize: 13, fontStyle: "italic" },
  replyBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#2b2d31", paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderLeftWidth: 3, borderLeftColor: "#5865F2" },
  replyBannerSender: { color: "#5865F2", fontSize: 12, fontWeight: "700" },
  replyBannerText: { color: "#949ba4", fontSize: 13 },
  editingBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#2b2d31", paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 16, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  editingBannerText: { color: "#b5bac1", fontSize: 14, fontWeight: "bold" },
  inputArea: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: Platform.OS === "ios" ? 24 : 12, backgroundColor: "#313338" },
  inputWrapper: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#383a40", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
  attachButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#b5bac1", justifyContent: "center", alignItems: "center", marginRight: 12 },
  textInput: { flex: 1, color: "#dbdee1", fontSize: 16, maxHeight: 120, paddingTop: 8, paddingBottom: 0, marginTop: 4, outlineStyle: "none" as any },
  emojiButton: { marginLeft: 12, padding: 2, marginBottom: 2 },
  systemMessageContainer: { paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  systemMessageText: { color: "#949ba4", fontSize: 14, fontStyle: "italic", textAlign: "center" },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  imageViewerImg: { width: "100%", height: "85%" } as any,
  imageViewerClose: { position: "absolute", top: 48, right: 24, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24 },
});

