import React, { useEffect, useRef, useState, useMemo } from "react";
import { Platform, Text as RNText, StyleSheet, View } from "react-native";
import { motion } from "motion/react";

// Module-level set: tracks which message/blocker ids have already finished
// animating. Survives a row or component unmounting and remounting.
const animatedMessageIds = new Set<string | number>();

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

export const BlurRevealShimmerText: React.FC<BlurRevealShimmerTextProps> = ({
  text = "",
  messageId,
  className = "",
  letterDelay = 40,
  revealDuration = 1.4,
  shimmerDelay = 1200,
  shimmerFadeIn = 900,
  shimmerDuration = 6,
  style = {},
  shimmerGradient = "linear-gradient(100deg, rgba(255,255,255,0.7) 25%, #ffffff 45%, #ffd1dc 52%, #ffffff 60%, rgba(255,255,255,0.7) 80%)",
}) => {
  const alreadyPlayed = messageId != null && animatedMessageIds.has(messageId);

  const [inView, setInView] = useState(alreadyPlayed);
  const [shimmerOn, setShimmerOn] = useState(alreadyPlayed);
  const [shimmerVisible, setShimmerVisible] = useState(alreadyPlayed);
  const containerRef = useRef<any>(null);

  // Group text into words so words wrap cleanly across lines without breaking mid-word
  const words = useMemo(() => {
    return text.split(" ");
  }, [text]);

  const totalLetters = useMemo(() => {
    return text.length;
  }, [text]);

  // Web intersection observer to trigger when in view
  useEffect(() => {
    if (alreadyPlayed) return;
    if (Platform.OS !== "web" || !containerRef.current) {
      setInView(true);
      return;
    }

    if (typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.unobserve(containerRef.current);
          }
        },
        { threshold: 0.1 }
      );
      obs.observe(containerRef.current);
      return () => obs.disconnect();
    } else {
      setInView(true);
    }
  }, [alreadyPlayed]);

  // Shimmer trigger timing
  useEffect(() => {
    if (alreadyPlayed || !inView) return;
    const totalReveal = totalLetters * letterDelay + revealDuration * 1000 + shimmerDelay;
    const onTimer = setTimeout(() => setShimmerOn(true), totalReveal);
    const fadeTimer = setTimeout(() => setShimmerVisible(true), totalReveal + 30);
    return () => {
      clearTimeout(onTimer);
      clearTimeout(fadeTimer);
    };
  }, [inView, alreadyPlayed, totalLetters, letterDelay, revealDuration, shimmerDelay]);

  // Record that this messageId completed
  useEffect(() => {
    if (shimmerOn && messageId != null) {
      animatedMessageIds.add(messageId);
    }
  }, [shimmerOn, messageId]);

  // Native mobile fallback (React Native Text)
  if (Platform.OS !== "web") {
    return (
      <RNText style={style}>
        {text}
      </RNText>
    );
  }

  // Running letter counter for staggered delays across words
  let globalLetterIndex = 0;

  return (
    <div
      ref={containerRef}
      className={`blur-reveal-shimmer-container ${className}`}
      style={{
        display: "inline-block",
        maxWidth: "100%",
        textAlign: "center",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        lineHeight: 1.6,
        ...style,
      }}
    >
      {words.map((word, wordIdx) => {
        const wordLetters = word.split("");
        return (
          <span
            key={`w-${wordIdx}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              marginRight: wordIdx < words.length - 1 ? "0.28em" : 0,
            }}
          >
            {wordLetters.map((char, charIdx) => {
              const currentDelay = (globalLetterIndex * letterDelay) / 1000;
              globalLetterIndex++;

              return (
                <motion.span
                  key={`c-${wordIdx}-${charIdx}`}
                  initial={alreadyPlayed ? false : { filter: "blur(16px)", opacity: 0, y: 12 }}
                  animate={
                    alreadyPlayed || inView
                      ? { filter: "blur(0px)", opacity: 1, y: 0 }
                      : { filter: "blur(16px)", opacity: 0, y: 12 }
                  }
                  transition={
                    alreadyPlayed
                      ? { duration: 0 }
                      : {
                          duration: revealDuration,
                          ease: [0.16, 1, 0.3, 1],
                          delay: currentDelay,
                        }
                  }
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

      <style>{`
        @keyframes blurShimmerSweep {
          0% { background-position: 150% 0; }
          100% { background-position: -50% 0; }
        }
      `}</style>
    </div>
  );
};

export default BlurRevealShimmerText;
