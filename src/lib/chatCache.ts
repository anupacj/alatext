import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// In-memory synchronous caches for instant 0ms access
const messageCache = new Map<string, any[]>();
let chatsListCache: any[] | null = null;
const settingsCache = new Map<string, any>();

function getWebStorage(key: string): string | null {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function setWebStorage(key: string, value: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
}

/**
 * Returns cached messages synchronously if available (0ms delay on initial useState)
 */
export function getInitialCachedMessages(chatId: string): any[] {
  if (!chatId) return [];
  if (messageCache.has(chatId)) {
    return messageCache.get(chatId)!;
  }
  const raw = getWebStorage(`chat_${chatId}_messages`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        messageCache.set(chatId, parsed);
        return parsed;
      }
    } catch {}
  }
  return [];
}

/**
 * Returns cached chats list synchronously if available
 */
export function getInitialCachedChats(userId?: string): any[] {
  if (chatsListCache && chatsListCache.length > 0) {
    return chatsListCache;
  }
  if (!userId) return [];
  const raw = getWebStorage(`user_${userId}_chats`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        chatsListCache = parsed;
        return parsed;
      }
    } catch {}
  }
  return [];
}

/**
 * Asynchronously hydrates in-memory cache from AsyncStorage (cross-platform)
 */
export async function prewarmChatCache(chatId: string): Promise<any[]> {
  if (!chatId) return [];
  try {
    const raw = await AsyncStorage.getItem(`chat_${chatId}_messages`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        messageCache.set(chatId, parsed);
        setWebStorage(`chat_${chatId}_messages`, raw);
        return parsed;
      }
    }
  } catch (e) {
    console.error("prewarmChatCache error:", e);
  }
  return messageCache.get(chatId) || [];
}

/**
 * Saves messages into in-memory cache, web localStorage, and AsyncStorage
 */
export function saveCachedMessages(chatId: string, messages: any[]): void {
  if (!chatId || !Array.isArray(messages)) return;
  messageCache.set(chatId, messages);
  const subset = messages.slice(0, 50);
  try {
    const json = JSON.stringify(subset);
    setWebStorage(`chat_${chatId}_messages`, json);
    AsyncStorage.setItem(`chat_${chatId}_messages`, json).catch(() => {});
  } catch (e) {
    console.error("saveCachedMessages error:", e);
  }
}

/**
 * Appends or prepends a single message into the local cache in the background
 */
export function addMessageToLocalCache(chatId: string, newMsg: any): void {
  if (!chatId || !newMsg) return;
  const current = messageCache.get(chatId) || getInitialCachedMessages(chatId);
  const exists = current.some((m) => m.id === newMsg.id || (m.client_id && m.client_id === newMsg.client_id));
  if (!exists) {
    const updated = [newMsg, ...current];
    saveCachedMessages(chatId, updated);
  }
}

/**
 * Pre-warms chats list cache from AsyncStorage
 */
export async function prewarmChatsListCache(userId: string): Promise<any[]> {
  if (!userId) return chatsListCache || [];
  try {
    const raw = await AsyncStorage.getItem(`user_${userId}_chats`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        chatsListCache = parsed;
        setWebStorage(`user_${userId}_chats`, raw);
        return parsed;
      }
    }
  } catch (e) {
    console.error("prewarmChatsListCache error:", e);
  }
  return chatsListCache || [];
}

/**
 * Saves chats list into in-memory cache and persistence
 */
export function saveCachedChats(userId: string, chats: any[]): void {
  if (!userId || !Array.isArray(chats)) return;
  chatsListCache = chats;
  try {
    const json = JSON.stringify(chats);
    setWebStorage(`user_${userId}_chats`, json);
    AsyncStorage.setItem(`user_${userId}_chats`, json).catch(() => {});
  } catch (e) {
    console.error("saveCachedChats error:", e);
  }
}

/**
 * Updates a single chat entry's preview, timestamp, and unread count in the cached chats list
 */
export function updateChatInCachedList(userId: string, chatId: string, lastMsgText: string, timestamp: number, bumpUnread = false): any[] {
  if (!userId || !chatId) return chatsListCache || [];
  const list = chatsListCache || getInitialCachedChats(userId);
  const index = list.findIndex((c) => c.id === chatId);
  let updatedList: any[];

  if (index >= 0) {
    const existing = list[index];
    const updatedChat = {
      ...existing,
      lastMessage: lastMsgText || existing.lastMessage,
      timestamp: timestamp || Date.now(),
      unreadCount: bumpUnread ? (existing.unreadCount || 0) + 1 : existing.unreadCount,
    };
    // Move to top
    updatedList = [updatedChat, ...list.slice(0, index), ...list.slice(index + 1)];
  } else {
    updatedList = list;
  }

  saveCachedChats(userId, updatedList);
  return updatedList;
}
