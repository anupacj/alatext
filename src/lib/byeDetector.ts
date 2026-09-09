/**
 * Wildcard & fuzzy detection engine for goodbye phrases.
 * Handles elongated spellings (e.g. "goooooood nighhhttttttttttt", "byeeeeeeee", "bbbyyyeee", "gnnnnnn")
 * without generating false positives on regular words (e.g. "byte", "bypass", "sign", "ignite").
 */

const MULTI_WORD_PATTERNS = [
  /\bg+o+o*d+\s*(?:n+i+g+h*t+|n+i+t+e*)\b/gi,
  /\bn+i+g+h+t+y+\s*n+i+g+h+t+\b/gi,
  /\bs+l+e+e+p+\s*w+e+l+l*\b/gi,
  /\bs+w+e+e+t+\s*d+r+e+a+m+s*\b/gi,
  /\bs+e+e+\s*y+a+\b/gi,
  /\bt+a+[\s-]*t+a+\b/gi,
];

const SINGLE_WORD_PATTERNS = [
  /\bb+y+e+\b/gi,
  /\bg+'?n+\b/gi,
  /\bn+i+t+e+\b/gi,
  /\bc+y+a+\b/gi,
];

/**
 * Counts the number of goodbye expressions in a single text message.
 * e.g. "bye bye byeeeee" -> 3 byes
 * "goooooood nighhhttttttttttt. la bey bye bye byeeeeeeeeee" -> 4 byes
 */
export function countByesInText(text: string | null | undefined): number {
  if (!text || typeof text !== "string") return 0;

  // Replace punctuation and emojis with spaces so attached symbols don't break word boundaries
  let cleaned = text.replace(/[^a-zA-Z0-9'\s]/g, " ");
  let total = 0;

  // Check multi-word expressions first and remove matched tokens
  for (const pattern of MULTI_WORD_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      total += matches.length;
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  // Check single-word expressions
  for (const pattern of SINGLE_WORD_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      total += matches.length;
    }
  }

  return total;
}

export interface ByeDetectionResult {
  shouldTrigger: boolean;
  totalByes: number;
  recentMessagesCount: number;
  triggeringMsgId?: string;
}

/**
 * Evaluates the recent conversation history to see if an "endless bye" loop is occurring.
 * Looks within a rolling 1-hour window (or last 15 messages) for >= minByes total byes.
 */
export function detectEndlessByes(
  messages: Array<{ id?: string; content?: string; text?: string; created_at?: string; created_at_ts?: number; sender_id?: string; type?: string }>,
  windowMs: number = 3 * 60 * 1000, // 3 minutes
  minByes: number = 3,
  sinceTimestamp: number = 0
): ByeDetectionResult {
  if (!messages || messages.length === 0) {
    return { shouldTrigger: false, totalByes: 0, recentMessagesCount: 0 };
  }

  const now = Date.now();

  // Sort all messages newest first to ensure consistency whether list is inverted or normal
  const sorted = [...messages].sort((a, b) => {
    const tsA = a.created_at_ts || (a.created_at ? new Date(a.created_at).getTime() : 0);
    const tsB = b.created_at_ts || (b.created_at ? new Date(b.created_at).getTime() : 0);
    return tsB - tsA;
  });

  // The newest message must be fresh (within the last 2 minutes) to ensure this is an active live conversation
  const newest = sorted[0];
  const newestTime = newest?.created_at_ts || (newest?.created_at ? new Date(newest.created_at).getTime() : now);
  if (Math.abs(now - newestTime) > 2 * 60 * 1000) {
    return { shouldTrigger: false, totalByes: 0, recentMessagesCount: 0 };
  }

  // If the newest message is not a standard text message (e.g. system, alert, heart ping), it CANNOT trigger!
  if (newest.type && newest.type !== "text") {
    return { shouldTrigger: false, totalByes: 0, recentMessagesCount: 0 };
  }

  // CRITICAL: The newest message must ITSELF contain at least one bye!
  // A non-bye message (e.g. "hello", heart ping, emoji) can NEVER trigger an endless bye block.
  const newestByes = countByesInText(newest.text || newest.content);
  if (newestByes <= 0) {
    return { shouldTrigger: false, totalByes: 0, recentMessagesCount: 0 };
  }

  const recentSlice = sorted.filter(m => !m.type || m.type === "text").slice(0, 15);
  let totalByes = 0;
  let relevantMsgCount = 0;
  let newestByeMsgId: string | undefined = newest.id;

  for (const msg of recentSlice) {
    const msgTime = msg.created_at_ts || (msg.created_at ? new Date(msg.created_at).getTime() : 0);

    // If message is older than sinceTimestamp (e.g. from before the last block), stop counting
    if (sinceTimestamp > 0 && msgTime <= sinceTimestamp) {
      break;
    }

    // Enforce the short window
    if (msgTime > 0 && now - msgTime > windowMs) {
      break;
    }

    const text = msg.text || msg.content || "";
    const count = countByesInText(text);
    if (count > 0) {
      totalByes += count;
      relevantMsgCount++;
    }

    // Early exit if threshold reached
    if (totalByes >= minByes) {
      break;
    }
  }

  return {
    shouldTrigger: totalByes >= minByes,
    totalByes,
    recentMessagesCount: relevantMsgCount,
    triggeringMsgId: newestByeMsgId,
  };
}
