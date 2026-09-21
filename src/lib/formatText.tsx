import React, { useEffect, useRef } from "react";
import { Text, Platform, Animated, Easing } from "react-native";
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

const RhythmicHeartNative: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.02, duration: 330, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.08, duration: 330, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(980),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.Text style={{ transform: [{ scale }], fontSize: 18 }}>
      {children}
    </Animated.Text>
  );
};

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
        <RhythmicHeartNative key={`${keyPrefix}-${idx}`}>
          {sub}
        </RhythmicHeartNative>
      );
    }
    return sub;
  });
}

export function getSafeFontFamily(font?: string | null): string | undefined {
  if (Platform.OS !== "web") {
    return font && font !== "system" ? font : undefined;
  }
  const emojiFallbacks = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  if (!font || font === "system") {
    return emojiFallbacks;
  }
  const cleanFont = font.replace(/['"]/g, '').trim();
  return `"${cleanFont}", ${emojiFallbacks}`;
}

export function renderFormattedContent(
  text: string,
  options: FormatOptions
) {
  if (!text) return null;

  const safeFont = getSafeFontFamily(options.fontFamily);
  const fontStyle = safeFont ? { fontFamily: safeFont } : {};
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
