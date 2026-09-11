/**
 * Utility functions to detect love phrases and heart emojis in chat messages.
 */

// Matches variations of "love" (love, loove, loooove, luv) followed by "you" (you, youu, youuuu, u, uuu, ya, yaaa)
// Also handles "i love you so much", "love you lots", "love you most", "love you forever", etc.
export const LOVE_PHRASE_REGEX = /\b(?:i\s+)?(?:l+[o0]+v+e+|l+u+v+)\s+(?:y+o+u+|u+|y+a+)(?:\s*(?:so\s+much|lots|most|more|always|forever))?\b/i;

// Matches abbreviations like "ily", "ilysm", "i l y"
export const ILY_ABBR_REGEX = /\b(?:ily(?:sm)?|i\s*l\s*y)\b/i;

// Matches all standard and variation heart emojis: ❤️, 💖, 💕, 💓, 💗, 💘, 💝, 🫶, 💌, 💟, ❣️
export const HEART_EMOJIS_REGEX = /([\u2764\uFE0F?\u2763\uFE0F?\uD83D\uDC93-\uD83D\uDC9F\uD83E\uDEF6\uD83D\uDC8C\uD83E\uDE77-\uD83E\uDE79]|❤️|💖|💕|💓|💗|💘|💝|🫶|💌|💟|❣️)/gu;

/**
 * Checks whether a given message text is a love message
 * (e.g. "love you", "love youuuu", "i love you so much", "ily", "luv u", etc.)
 */
export function isLoveMessage(text?: string | null): boolean {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  if (!clean) return false;
  return LOVE_PHRASE_REGEX.test(clean) || ILY_ABBR_REGEX.test(clean);
}

/**
 * Checks whether text contains any heart emojis
 */
export function hasHeartEmojis(text?: string | null): boolean {
  if (!text || typeof text !== "string") return false;
  HEART_EMOJIS_REGEX.lastIndex = 0;
  return HEART_EMOJIS_REGEX.test(text);
}
