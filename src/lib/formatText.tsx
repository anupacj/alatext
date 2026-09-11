import React from "react";
import { Text, Platform } from "react-native";
import ShinyText from "../components/ShinyText";
import { hasHeartEmojis } from "./loveDetector";
import "../components/ShinyText.css";

export interface FormatOptions {
  isShimmer?: boolean;
  baseStyle?: any;
  textColor?: string;
  isMe?: boolean;
  fontFamily?: string | null;
  isLove?: boolean;
}

const HEART_SPLIT_REGEX = /(❤️|🩷|🧡|💛|💚|💙|🩵|💜|🤎|🖤|🤍|💔|❤️‍🔥|❤️‍🩹|❣️|💕|💞|💓|💗|💖|💘|💝|💟|💌|🫶)/u;

function renderTextOrHearts(chunk: string, keyPrefix: string | number) {
  if (!chunk) return null;
  if (!hasHeartEmojis(chunk)) return chunk;

  const parts = chunk.split(HEART_SPLIT_REGEX);
  if (parts.length === 1) return chunk;

  return parts.map((sub, idx) => {
    if (!sub) return null;
    if (hasHeartEmojis(sub)) {
      if (Platform.OS === "web") {
        return (
          <span key={`${keyPrefix}-${idx}`} className="beating-heart-emoji">
            {sub}
          </span>
        );
      }
      return (
        <Text key={`${keyPrefix}-${idx}`} style={{ fontSize: 18 }}>
          {sub}
        </Text>
      );
    }
    return sub;
  });
}

export function renderFormattedContent(
  text: string,
  options: FormatOptions
) {
  if (!text) return null;

  const fontStyle = options.fontFamily && options.fontFamily !== "system" ? { fontFamily: options.fontFamily } : {};
  const colorStyle = options.textColor ? { color: options.textColor } : {};

  // If entire message is marked as shimmer
  if (options.isShimmer) {
    const baseColor = options.isMe
      ? "rgba(255, 255, 255, 0.40)"
      : "rgba(220, 225, 240, 0.42)";
    const shineColor = "#ffffff";

    return (
      <Text style={[options.baseStyle, fontStyle]}>
        <ShinyText
          text={text}
          speed={2.2}
          color={baseColor}
          shineColor={shineColor}
          spread={115}
          style={[options.baseStyle, fontStyle]}
        />
      </Text>
    );
  }

  // Tokenize for Markdown (*bold*, _italic_, ~strike~, `code`)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
  const parts = text.split(regex);

  if (parts.length === 1) {
    return (
      <Text style={[options.baseStyle, fontStyle, colorStyle]}>
        {options.isLove ? renderTextOrHearts(text, "plain") : text}
      </Text>
    );
  }

  return (
    <Text style={[options.baseStyle, fontStyle, colorStyle]}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.22)",
                paddingHorizontal: 4,
                borderRadius: 4,
                fontSize: ((options.baseStyle as any)?.fontSize || 15) * 0.92,
              }}
            >
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const inner = part.slice(2, -2);
          return (
            <Text key={i} style={{ fontWeight: "bold" }}>
              {options.isLove ? renderTextOrHearts(inner, `b-${i}`) : inner}
            </Text>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          const inner = part.slice(1, -1);
          return (
            <Text key={i} style={{ fontWeight: "bold" }}>
              {options.isLove ? renderTextOrHearts(inner, `b-${i}`) : inner}
            </Text>
          );
        }
        if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
          const inner = part.slice(1, -1);
          return (
            <Text key={i} style={{ fontStyle: "italic" }}>
              {options.isLove ? renderTextOrHearts(inner, `i-${i}`) : inner}
            </Text>
          );
        }
        if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
          const inner = part.slice(1, -1);
          return (
            <Text key={i} style={{ textDecorationLine: "line-through" }}>
              {options.isLove ? renderTextOrHearts(inner, `s-${i}`) : inner}
            </Text>
          );
        }
        return options.isLove ? renderTextOrHearts(part, `t-${i}`) : part;
      })}
    </Text>
  );
}
