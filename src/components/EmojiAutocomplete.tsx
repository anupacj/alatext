import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { EMOJI_DATABASE, EmojiItem } from "./CustomEmojiPicker";

export interface EmojiMatch {
  emoji: string;
  shortcode: string;
  name: string;
}

// Common explicit shortcodes mapping for Discord-like intuitive feel
const COMMON_SHORTCODES: Record<string, string> = {
  "❤️": "heart",
  "💖": "sparkling_heart",
  "🔥": "fire",
  "😂": "joy",
  "😭": "sob",
  "💀": "skull",
  "✨": "sparkles",
  "🥺": "pleading_face",
  "😍": "heart_eyes",
  "🥰": "smiling_face_with_hearts",
  "😘": "kissing_heart",
  "😊": "blush",
  "😀": "grinning",
  "😃": "smiley",
  "😄": "smile",
  "😁": "grin",
  "😆": "laughing",
  "🤣": "rofl",
  "😎": "sunglasses",
  "🥳": "partying_face",
  "🎉": "tada",
  "👍": "thumbsup",
  "👎": "thumbsdown",
  "👏": "clap",
  "🙏": "pray",
  "👀": "eyes",
  "💯": "100",
  "🚀": "rocket",
  "⭐": "star",
  "🌟": "glowing_star",
  "💡": "bulb",
  "🍕": "pizza",
  "🍔": "burger",
  "☕": "coffee",
  "🐱": "cat",
  "🐶": "dog",
  "🙈": "see_no_evil",
  "🙉": "hear_no_evil",
  "🙊": "speak_no_evil",
};

export function getEmojiShortcode(item: EmojiItem): string {
  if (COMMON_SHORTCODES[item.emoji]) {
    return COMMON_SHORTCODES[item.emoji];
  }
  // Fallback: take first 2 descriptive words separated by underscore
  const words = item.name.split(" ").slice(0, 2);
  return words.join("_").replace(/[^a-z0-9_]/gi, "");
}

export function searchEmojis(query: string, limit = 6): EmojiMatch[] {
  if (!query || query.trim().length === 0) return [];
  const cleanQ = query.trim().toLowerCase().replace(/^:/, "");
  if (!cleanQ) return [];

  const results: EmojiMatch[] = [];
  const seen = new Set<string>();

  // 1. First priority: exact shortcode or name starts with query
  for (const item of EMOJI_DATABASE) {
    const sc = getEmojiShortcode(item);
    if (sc.startsWith(cleanQ) && !seen.has(item.emoji)) {
      seen.add(item.emoji);
      results.push({ emoji: item.emoji, shortcode: sc, name: item.name });
      if (results.length >= limit) return results;
    }
  }

  // 2. Second priority: shortcode contains query or name contains query
  for (const item of EMOJI_DATABASE) {
    if (seen.has(item.emoji)) continue;
    const sc = getEmojiShortcode(item);
    if (sc.includes(cleanQ) || item.name.toLowerCase().includes(cleanQ)) {
      seen.add(item.emoji);
      results.push({ emoji: item.emoji, shortcode: sc, name: item.name });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

interface EmojiAutocompleteProps {
  matches: EmojiMatch[];
  selectedIndex: number;
  onSelect: (emoji: string) => void;
  theme: any;
  isAmoled?: boolean;
}

export const EmojiAutocomplete: React.FC<EmojiAutocompleteProps> = ({
  matches,
  selectedIndex,
  onSelect,
  theme,
  isAmoled = false,
}) => {
  if (!matches || matches.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        isAmoled
          ? styles.amoledContainer
          : { backgroundColor: theme?.surface || "#2b2d31", borderColor: theme?.border || "rgba(255,255,255,0.1)" },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } as any)
          : {},
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: theme?.textMuted || "#949ba4" }]}>
          EMOJI MATCHES (TAB or ↵ to select)
        </Text>
      </View>
      {matches.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <TouchableOpacity
            key={item.emoji + item.shortcode}
            style={[
              styles.itemRow,
              isSelected && {
                backgroundColor: theme?.accent ? `${theme.accent}25` : "rgba(88, 101, 242, 0.18)",
              },
            ]}
            onPress={() => onSelect(item.emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiText}>{item.emoji}</Text>
            <Text
              style={[
                styles.shortcodeText,
                { color: isSelected ? (theme?.accent || "#5865F2") : (theme?.text || "#dbdee1") },
              ]}
            >
              :{item.shortcode}:
            </Text>
            <Text
              style={[styles.descText, { color: theme?.textMuted || "#949ba4" }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: "100%",
    left: 12,
    right: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
    maxHeight: 280,
  },
  amoledContainer: {
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    borderColor: "#2a2a2a",
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  emojiText: {
    fontSize: 20,
    width: 26,
    textAlign: "center",
  },
  shortcodeText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  descText: {
    fontSize: 11,
    flex: 1,
    opacity: 0.75,
  },
});
