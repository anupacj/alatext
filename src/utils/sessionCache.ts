/**
 * In-memory session cache (RAM only)
 * Resets on browser reload to guarantee fresh data without stale disk cache issues,
 * while retaining instant 0ms responses when navigating back and forth in active session.
 */
export let sessionChats: any[] | null = null;

export const setSessionChats = (chats: any[] | null) => {
  sessionChats = chats;
};

export const sessionMessagesMap: Map<string, any[]> = new Map();

export const getSessionMessages = (chatId: string): any[] | null => {
  return sessionMessagesMap.get(chatId) || null;
};

export const setSessionMessages = (chatId: string, messages: any[]) => {
  sessionMessagesMap.set(chatId, messages);
};
