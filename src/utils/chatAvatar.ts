import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type ChatAvatarMap = Record<string, string | null>;

/**
 * Load cached chat-specific avatar map from local storage.
 */
export async function loadChatAvatarsFromLocal(chatId: string): Promise<ChatAvatarMap> {
  try {
    const raw = await AsyncStorage.getItem(`@chat_${chatId}_chat_avatars`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load chat avatars from local storage:", e);
  }
  return {};
}

/**
 * Save chat-specific avatar for a user to local storage cache.
 */
export async function saveChatAvatarToLocal(
  chatId: string,
  userId: string,
  avatarUrl: string | null
): Promise<ChatAvatarMap> {
  try {
    const current = await loadChatAvatarsFromLocal(chatId);
    const updated: ChatAvatarMap = {
      ...current,
      [userId]: avatarUrl || null,
    };
    await AsyncStorage.setItem(`@chat_${chatId}_chat_avatars`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to save chat avatar to local storage:", e);
    return {};
  }
}

/**
 * Fetch the latest chat-specific avatars for all participants in a chat from Supabase.
 */
export async function fetchChatAvatarsFromCloud(chatId: string): Promise<ChatAvatarMap> {
  const result: ChatAvatarMap = {};

  try {
    // 1. Check chat_participants table first (primary, clean database column)
    try {
      const { data: participants, error: partError } = await supabase
        .from("chat_participants")
        .select("user_id, custom_avatar_url")
        .eq("chat_id", chatId);

      if (!partError && Array.isArray(participants)) {
        for (const part of participants) {
          if (part.user_id && part.custom_avatar_url) {
            result[part.user_id] = part.custom_avatar_url;
          }
        }
      }
    } catch (e) {}

    // 2. Fetch from messages table as durable fallback
    try {
      const { data: avatarMessages, error: msgError } = await supabase
        .from("messages")
        .select("sender_id, content, created_at")
        .eq("chat_id", chatId)
        .eq("type", "chat_avatar")
        .order("created_at", { ascending: false });

      if (!msgError && Array.isArray(avatarMessages)) {
        for (const msg of avatarMessages) {
          if (msg.sender_id && result[msg.sender_id] === undefined) {
            try {
              const parsed = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
              result[msg.sender_id] = parsed?.custom_avatar_url || null;
            } catch (e) {
              result[msg.sender_id] = null;
            }
          }
        }
      }
    } catch (e) {}

    // Cache to local storage
    if (Object.keys(result).length > 0) {
      const cached = await loadChatAvatarsFromLocal(chatId);
      const merged = { ...cached, ...result };
      await AsyncStorage.setItem(`@chat_${chatId}_chat_avatars`, JSON.stringify(merged));
    }
  } catch (e) {
    console.error("Failed to fetch chat avatars from cloud:", e);
  }

  return result;
}

/**
 * Persist a user's chat-specific avatar to the cloud (chat_participants + messages fallback + local cache).
 */
export async function persistChatAvatarToCloud(
  chatId: string,
  userId: string,
  avatarUrl: string | null
): Promise<void> {
  try {
    // 1. Update chat_participants table directly
    try {
      const { error: partErr } = await supabase
        .from("chat_participants")
        .update({ custom_avatar_url: avatarUrl })
        .eq("chat_id", chatId)
        .eq("user_id", userId);
      if (partErr) {
        console.warn("Could not update chat_participants custom_avatar_url:", partErr.message);
      }
    } catch (e) {}

    // 2. Also try messages table for fallback
    try {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({ custom_avatar_url: avatarUrl }),
        type: "chat_avatar",
      });
    } catch (e) {}

    // 3. Update local storage
    await saveChatAvatarToLocal(chatId, userId, avatarUrl);
  } catch (e) {
    console.error("Failed to persist chat avatar to cloud:", e);
  }
}

/**
 * Broadcast real-time chat avatar update over WebSocket channel.
 */
export function broadcastChatAvatarUpdate(
  chatId: string,
  userId: string,
  avatarUrl: string | null,
  channelOverride?: any
): void {
  try {
    const broadcastTopic = `chat_broadcast_${chatId}`;
    const payload = {
      type: "broadcast" as const,
      event: "chat_avatar_sync",
      payload: {
        userId,
        avatarUrl,
      },
    };

    let channel = channelOverride;
    if (!channel) {
      const existing = supabase.getChannels().find(c =>
        c.topic === `realtime:${broadcastTopic}` || c.topic === broadcastTopic
      );
      if (existing && ((existing as any).state === "joined" || (existing as any).isJoined?.())) {
        channel = existing;
      }
    }

    if (channel && ((channel as any).state === "joined" || (channel as any).isJoined?.())) {
      channel.send(payload);
    } else {
      const newChan = supabase.channel(broadcastTopic, { config: { broadcast: { self: false } } });
      newChan.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          newChan.send(payload);
        }
      });
    }
  } catch (e) {
    console.error("Failed to broadcast chat avatar update:", e);
  }
}
