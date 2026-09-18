// Slide Typing (Gesture / Glide Typing) Algorithm and Dictionary for AlaGlassKeyboard

export const COMMON_WORDS: string[] = [
  // Greetings & Conversational
  "hello", "hey", "hi", "how", "are", "you", "good", "morning", "night", "evening",
  "thanks", "thank", "welcome", "please", "sorry", "yes", "yeah", "yep", "no", "nope",
  "okay", "ok", "sure", "fine", "cool", "nice", "great", "awesome", "perfect", "sweet",
  "love", "like", "miss", "baby", "babe", "sweetheart", "darling", "honey", "dear", "heart",
  // Common Verbs
  "want", "need", "have", "had", "will", "would", "can", "could", "should", "must",
  "know", "think", "feel", "see", "look", "come", "came", "going", "gone", "went", "go",
  "get", "got", "make", "made", "take", "took", "say", "said", "tell", "told", "talk",
  "call", "text", "send", "sent", "meet", "hear", "listen", "wait", "stay", "leave",
  "sleep", "wake", "eat", "drink", "work", "play", "help", "hope", "wish", "keep", "try",
  // Questions & Pronouns
  "what", "where", "when", "why", "who", "which", "whose",
  "i", "me", "my", "mine", "myself", "we", "us", "our", "ours",
  "he", "him", "his", "she", "her", "hers", "it", "its", "they", "them", "their",
  "this", "that", "these", "those", "here", "there", "every", "some", "any", "all",
  // Time & Sequence
  "now", "later", "soon", "today", "tomorrow", "tonight", "yesterday", "always", "never",
  "sometimes", "often", "again", "before", "after", "already", "still", "yet", "first", "then",
  // Common Connectors & Adverbs
  "and", "but", "or", "because", "so", "if", "though", "even", "while", "since", "until",
  "about", "with", "without", "for", "from", "into", "over", "under", "through", "between",
  "very", "much", "more", "most", "really", "quite", "too", "also", "just", "only", "maybe",
  // Everyday chat vocabulary
  "home", "house", "room", "bed", "phone", "chat", "message", "photo", "pic",
  "food", "coffee", "tea", "water", "dinner", "lunch", "breakfast", "day", "week", "weekend",
  "time", "minute", "hour", "way", "road", "car", "bus", "train", "plane", "trip",
  "movie", "song", "music", "game", "book", "fun", "bored", "busy", "tired", "happy",
  "sad", "glad", "mad", "excited", "ready", "done", "almost", "back", "right", "wrong",
  "true", "real", "best", "better", "funny", "cute", "pretty", "beautiful", "handsome",
  "thing", "things", "stuff", "place", "world", "life", "people", "friend", "friends",
  "family", "mom", "dad", "sister", "brother", "boy", "girl", "man", "woman",
  // Extra high-frequency words
  "another", "answer", "anyone", "anything",
  "around", "arrive", "bring", "care", "change", "check", "clean",
  "close", "crazy", "dance", "drive", "early", "easy", "enough", "everything",
  "fast", "find", "finish", "forget", "forward", "give",
  "guess", "hang", "happen", "hard", "hold", "hurry", "inside", "laugh",
  "little", "long", "mind", "moment", "money",
  "move", "next", "nothing", "number", "open", "order", "outside", "part",
  "party", "pick", "plan", "point", "read", "remember", "ride", "safe",
  "same", "save", "seem", "share", "show", "side", "simple", "smile",
  "somebody", "someone", "something", "sound", "start", "stop", "story",
  "taste", "together", "travel", "trust", "turn",
  "understand", "voice", "walk", "watch", "wear", "well", "whole",
  "wonder", "worry", "write", "young"
];

// Pre-index words by first and last letter for O(1) candidate lookup
const WORD_INDEX: Map<string, string[]> = new Map();

COMMON_WORDS.forEach((word) => {
  const w = word.toLowerCase();
  if (w.length < 2) return;
  const key = `${w[0]}${w[w.length - 1]}`;
  const list = WORD_INDEX.get(key) || [];
  list.push(w);
  WORD_INDEX.set(key, list);
});

/**
 * Deduplicate sequential duplicates (e.g. ['h', 'h', 'e', 'l', 'l', 'o'] -> ['h', 'e', 'l', 'o'])
 */
export function deduplicateSequence(letters: string[]): string[] {
  const res: string[] = [];
  for (let i = 0; i < letters.length; i++) {
    if (i === 0 || letters[i] !== letters[i - 1]) {
      res.push(letters[i].toLowerCase());
    }
  }
  return res;
}

/**
 * Checks if candidate word matches the swipe sequence.
 * In glide typing, the candidate word letters should appear in the swipe path in order.
 */
function matchScore(candidate: string, swipeLetters: string[]): number {
  let swipeIdx = 0;
  let matches = 0;

  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    while (swipeIdx < swipeLetters.length && swipeLetters[swipeIdx] !== ch) {
      swipeIdx++;
    }
    if (swipeIdx < swipeLetters.length && swipeLetters[swipeIdx] === ch) {
      matches++;
      swipeIdx++;
    } else {
      break;
    }
  }

  // Exact length and sequence match is best
  const coverage = matches / candidate.length;
  const lengthPenalty = Math.abs(candidate.length - swipeLetters.length) * 0.08;
  return coverage - lengthPenalty;
}

/**
 * Resolves a swiped sequence of letters into the best matching dictionary word.
 */
export function resolveSlideWord(rawLetters: string[]): string {
  const letters = deduplicateSequence(rawLetters);
  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0];

  const rawWord = letters.join("");
  const first = letters[0];
  const last = letters[letters.length - 1];

  // 1. Direct match check
  if (COMMON_WORDS.includes(rawWord)) {
    return rawWord;
  }

  // 2. Candidates matching first and last letter
  const key = `${first}${last}`;
  const candidates = WORD_INDEX.get(key);

  if (candidates && candidates.length > 0) {
    let bestWord = candidates[0];
    let bestScore = -999;

    for (const candidate of candidates) {
      const score = matchScore(candidate, letters);
      if (score > bestScore) {
        bestScore = score;
        bestWord = candidate;
      }
    }

    if (bestScore > 0.35) {
      return bestWord;
    }
  }

  // 3. Fallback to raw letters
  return rawWord;
}

/**
 * Geometric keyboard key hit detection
 */
export function getKeyAtCoordinate(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): string | null {
  if (containerWidth <= 0 || containerHeight <= 0) return null;

  const gap = 5;
  const rowHeight = 44;
  const rowGap = 6;

  // Row index
  let row = -1;
  if (y >= 0 && y < rowHeight + rowGap) {
    row = 0;
  } else if (y >= rowHeight + rowGap && y < 2 * (rowHeight + rowGap)) {
    row = 1;
  } else if (y >= 2 * (rowHeight + rowGap) && y < 3 * (rowHeight + rowGap)) {
    row = 2;
  } else {
    return null;
  }

  // Row 0: 10 keys: q w e r t y u i o p
  if (row === 0) {
    const keys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
    const keyWidth = (containerWidth - gap * 9) / 10;
    const col = Math.floor(x / (keyWidth + gap));
    if (col >= 0 && col < keys.length) {
      return keys[col];
    }
  }

  // Row 1: 9 keys with 16px horizontal padding: a s d f g h j k l
  if (row === 1) {
    const keys = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
    const pad = 16;
    const availWidth = containerWidth - pad * 2;
    const keyWidth = (availWidth - gap * 8) / 9;
    const adjustedX = x - pad;
    if (adjustedX < 0) return null;
    const col = Math.floor(adjustedX / (keyWidth + gap));
    if (col >= 0 && col < keys.length) {
      return keys[col];
    }
  }

  // Row 2: shift (1.4 flex), z x c v b n m (1 flex each), backspace (1.4 flex)
  if (row === 2) {
    const letterKeys = ["z", "x", "c", "v", "b", "n", "m"];
    const totalFlex = 1.4 + 7 + 1.4; // 9.8
    const totalGaps = gap * 8;
    const unit = (containerWidth - totalGaps) / totalFlex;
    const shiftWidth = unit * 1.4;

    const letterStartX = shiftWidth + gap;
    const letterEndX = letterStartX + 7 * (unit + gap);

    if (x >= letterStartX && x <= letterEndX) {
      const col = Math.floor((x - letterStartX) / (unit + gap));
      if (col >= 0 && col < letterKeys.length) {
        return letterKeys[col];
      }
    }
  }

  return null;
}
