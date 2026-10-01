import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import lottie, { AnimationItem } from "lottie-web";

interface LottieStickerProps {
  url: string;
  size: number;
  opacity?: number;
}

const lottieJsonCache = new Map<string, any>();

export const LottieSticker: React.FC<LottieStickerProps> = ({ url, size, opacity = 1 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !containerRef.current) return;

    let isMounted = true;

    const startAnim = (data: any) => {
      if (!isMounted || !containerRef.current) return;
      if (animRef.current) {
        animRef.current.destroy();
      }
      try {
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
      } catch (e) {
        console.error("Lottie load animation failed", e);
      }
    };

    if (lottieJsonCache.has(url)) {
      startAnim(lottieJsonCache.get(url));
    } else {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          lottieJsonCache.set(url, data);
          startAnim(data);
        })
        .catch((err) => {
          console.warn("Failed to load Lottie sticker from:", url, err);
        });
    }

    return () => {
      isMounted = false;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [url]);

  if (Platform.OS !== "web") return null;

  return (
    <div
      ref={containerRef as any}
      style={{
        width: size,
        height: size,
        opacity,
        pointerEvents: "none",
        overflow: "hidden",
        display: "inline-block",
      }}
    />
  );
};
