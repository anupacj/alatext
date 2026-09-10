import React, { useEffect, useState, useMemo } from "react";
import { Platform, Text as RNText } from "react-native";
import { motion } from "motion/react";

export interface BlurRevealShimmerTextProps {
  text?: string;
  messageId?: string | number;
  className?: string;
  letterDelay?: number;       // gap between each letter starting, ms
  revealDuration?: number;    // how long one letter's blur-in takes, seconds
  shimmerDelay?: number;      // pause after last letter lands before shimmer starts, ms
  shimmerFadeIn?: number;     // how long the shimmer takes to fade up to full, ms
  shimmerDuration?: number;   // speed of the looping shimmer sweep, seconds
  style?: React.CSSProperties | any;
  shimmerGradient?: string;
}

export const BlurRevealShimmerText: React.FC<BlurRevealShimmerTextProps> = React.memo(({
  text = "",
  className = "",
  letterDelay = 22,
  revealDuration = 1.0,
  shimmerDelay = 400,
  shimmerFadeIn = 700,
  shimmerDuration = 5,
  style = {},
  shimmerGradient = "linear-gradient(100deg, rgba(255,255,255,0.7) 25%, #ffffff 45%, #ffd1dc 52%, #ffffff 60%, rgba(255,255,255,0.7) 80%)",
}) => {
  const [shimmerOn, setShimmerOn] = useState(false);
  const [shimmerVisible, setShimmerVisible] = useState(false);

  // Split text by lines (e.g. \n) first, then into words
  const lines = useMemo(() => {
    return text.split("\n");
  }, [text]);

  const totalLetters = useMemo(() => {
    return text.length;
  }, [text]);

  // Shimmer timer: triggers after blur reveal sequence completes
  useEffect(() => {
    const totalReveal = totalLetters * letterDelay + revealDuration * 1000 + shimmerDelay;
    const onTimer = setTimeout(() => setShimmerOn(true), totalReveal);
    const fadeTimer = setTimeout(() => setShimmerVisible(true), totalReveal + 40);
    return () => {
      clearTimeout(onTimer);
      clearTimeout(fadeTimer);
    };
  }, [totalLetters, letterDelay, revealDuration, shimmerDelay]);

  // Native mobile fallback (React Native Text)
  if (Platform.OS !== "web") {
    const nativeStyle = { ...style };
    if (typeof nativeStyle.lineHeight === "string" && nativeStyle.lineHeight.endsWith("px")) {
      nativeStyle.lineHeight = parseFloat(nativeStyle.lineHeight);
    }
    return (
      <RNText style={nativeStyle}>
        {text}
      </RNText>
    );
  }

  // Web typography style normalization: ensure unitless lineHeight > 3 is converted to px
  const computedStyle = useMemo(() => {
    if (!style) return {};
    const s = { ...style };
    if (typeof s.lineHeight === "number") {
      s.lineHeight = s.lineHeight > 3 ? `${s.lineHeight}px` : s.lineHeight;
    }
    return s;
  }, [style]);

  let globalLetterIndex = 0;

  return (
    <div
      className={`blur-reveal-shimmer-container ${className}`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "center",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        ...computedStyle,
      }}
    >
      {lines.map((lineText, lineIdx) => {
        const words = lineText.split(" ").filter((w) => w.length > 0);
        return (
          <div
            key={`line-${lineIdx}`}
            style={{
              display: "block",
              textAlign: "center",
              marginBottom: lineIdx < lines.length - 1 ? "0.45em" : 0,
            }}
          >
            {words.map((word, wordIdx) => {
              // Unicode-safe grapheme split so emojis (e.g. 🌙, 🕯️) are never split into broken surrogate pairs
              const wordLetters = Array.from(word);
              return (
                <span
                  key={`w-${lineIdx}-${wordIdx}`}
                  style={{
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    marginRight: wordIdx < words.length - 1 ? "0.3em" : 0,
                  }}
                >
                  {wordLetters.map((char, charIdx) => {
                    const currentDelay = (globalLetterIndex * letterDelay) / 1000;
                    globalLetterIndex++;

                    return (
                      <motion.span
                        key={`c-${lineIdx}-${wordIdx}-${charIdx}`}
                        initial={{ filter: "blur(14px)", opacity: 0, y: 8 }}
                        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                        transition={{
                          duration: revealDuration,
                          ease: [0.16, 1, 0.3, 1],
                          delay: currentDelay,
                        }}
                        style={{
                          display: "inline-block",
                          position: "relative",
                        }}
                      >
                        {char}
                        {shimmerOn && (
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              inset: 0,
                              backgroundImage: shimmerGradient,
                              backgroundSize: "250% 100%",
                              WebkitBackgroundClip: "text",
                              backgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              color: "transparent",
                              animation: `blurShimmerSweep ${shimmerDuration}s linear infinite`,
                              opacity: shimmerVisible ? 1 : 0,
                              transition: `opacity ${shimmerFadeIn}ms ease-out`,
                              pointerEvents: "none",
                            }}
                          >
                            {char}
                          </span>
                        )}
                      </motion.span>
                    );
                  })}
                </span>
              );
            })}
          </div>
        );
      })}

      <style>{`
        @keyframes blurShimmerSweep {
          0% { background-position: 150% 0; }
          100% { background-position: -50% 0; }
        }
      `}</style>
    </div>
  );
});

export default BlurRevealShimmerText;
