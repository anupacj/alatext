/**
 * Wildcard & fuzzy detection engine for goodbye phrases.
 * Handles elongated spellings (e.g. "goooooood nighhhttttttttttt", "byeeeeeeee", "bbbyyyeee", "gnnnnnn")
 * without generating false positives on regular words (e.g. "byte", "bypass", "sign", "ignite").
 */

const MULTI_WORD_PATTERNS = [
  // Good night variations: goodnight, good night, gud nite, gd night, gdnite, gd nite, g'night, gnight
  /\b(?:g+o+o*d+|g+u+d+|g+d+)\s*(?:n+i+g+h*t+|n+i+t+e*)\b/gi,
  /\bg+'?n+i+g+h*t+\b/gi, // gnight, g'night
  /\bn+i+g+h+t+y*\s*(?:n+i+g+h*t+|n+i+t+e*)\b/gi, // night night, nighty night, nighty nite
  /\bs+l+e+e+p+\s*(?:w+e+l+l*|t+i+g+h*t+)\b/gi, // sleep well, sleep tight
  /\bs+w+e+e+t+\s*d+r+e+a+m+s*\b/gi, // sweet dreams, sweetdreams
  /\bs+e+e+\s*(?:y+a+|y+o+u+|u+)(?:\s*(?:t+o+m+o+r*o+w*|l+a+t+e*r*))?\b/gi, // see ya, see you, see you tomorrow, see u
  /\bt+a+l+k+\s*(?:t+o+m+o+r*o+w*|l+a+t+e*r*)\b/gi, // talk tomorrow, talk later
  /\bu+n+t+i+l+\s*t+o+m+o+r*o+w*\b/gi, // until tomorrow
  /\bt+a+[\s-]*t+a+\b/gi, // ta-ta, ta ta
  /\bt+a+k+e+\s*c+a+r+e+\b/gi, // take care
  /\b(?:g+o+i+n+g+|h+e+a+d+i+n+g+|o+f+f+)\s*t+o+\s*(?:b+e+d+|s+l+e+e+p+)\b/gi, // going to bed, heading to sleep, off to bed
  /\bt+i+m+e+\s*t+o+\s*(?:s+l+e+e+p+|b+e+d+)\b/gi, // time to sleep, time to bed
];

const SINGLE_WORD_PATTERNS = [
  /\bb+y+e+(?:b+y+e+)?\b/gi, // bye, byeee, byebye, bbye
  /\bb+a+i+(?:b+a+i+)?\b/gi, // bai, baibai
  /\bb+u+b+y+e+\b/gi, // bubye
  /\bb+b+y+e+\b/gi, // bbye
  /\bg+'?n+\b/gi, // gn, gnn, g'n
  /\bg+d+n+i+t+e+\b/gi, // gdnite
  /\bg+n+i+g+h*t+\b/gi, // gnight
  /\bn+i+g+h*t+y*\b/gi, // night, nightt, nighty
  /\bn+i+t+e+\b/gi, // nite, nitee
  /\bc+y+a+\b/gi, // cya
  /\bt+t+y+l+\b/gi, // ttyl
  /\bt+c+\b/gi, // tc (take care)
  /\bs+l+e+e+p+y+\b/gi, // sleepy, sleeepyy
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
  windowMs: number = 5 * 60 * 1000, // 5 minutes
  minByes: number = 2,
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

  // The newest message must be recent (within the last 10 minutes) so we don't trigger on old historical loads
  const newest = sorted[0];
  const newestTime = newest?.created_at_ts || (newest?.created_at ? new Date(newest.created_at).getTime() : now);
  if (newestTime > 0 && (now - newestTime) > 10 * 60 * 1000) {
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
    if (sinceTimestamp > 0 && msgTime > 0 && msgTime < sinceTimestamp) {
      break;
    }

    // Enforce the rolling window (e.g. 5 minutes)
    if (msgTime > 0 && (now - msgTime) > windowMs) {
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
