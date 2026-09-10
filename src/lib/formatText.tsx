import React from "react";
import { Text } from "react-native";
import ShinyText from "../components/ShinyText";

export interface FormatOptions {
  isShimmer?: boolean;
  baseStyle?: any;
  textColor?: string;
  isMe?: boolean;
  fontFamily?: string | null;
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
        {text}
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
          return (
            <Text key={i} style={{ fontWeight: "bold" }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return (
            <Text key={i} style={{ fontWeight: "bold" }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
          return (
            <Text key={i} style={{ fontStyle: "italic" }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
          return (
            <Text key={i} style={{ textDecorationLine: "line-through" }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
