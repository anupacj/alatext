import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface LottieStickerProps {
  url: string;
  size: number;
  opacity?: number;
}

const lottieJsonCache = new Map<string, any>();
let lottieScriptPromise: Promise<any> | null = null;

const ensureLottieLoaded = (): Promise<any> => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).lottie) return Promise.resolve((window as any).lottie);

  if (lottieScriptPromise) return lottieScriptPromise;

  lottieScriptPromise = new Promise((resolve) => {
    const existing = document.getElementById("bodymovin-script");
    if (existing) {
      if ((window as any).lottie) {
        resolve((window as any).lottie);
      } else {
        existing.addEventListener("load", () => resolve((window as any).lottie));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "bodymovin-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie_light.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve((window as any).lottie);
    };
    script.onerror = (e) => {
      console.warn("Failed to load bodymovin CDN script", e);
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return lottieScriptPromise;
};

const fetchLottieData = async (targetUrl: string): Promise<any> => {
  if (lottieJsonCache.has(targetUrl)) {
    return lottieJsonCache.get(targetUrl);
  }

  // 1. Direct fetch
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const data = await res.json();
      lottieJsonCache.set(targetUrl, data);
      return data;
    }
  } catch (e) {
    // Direct fetch failed (CORS or network)
  }

  // 2. Proxy fetch via Cloudflare Pages function
  try {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const origin = isLocal ? "https://alatext.pages.dev" : "";
    const proxyUrl = `${origin}/api/telegram-file?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      lottieJsonCache.set(targetUrl, data);
      return data;
    }
  } catch (e) {
    console.warn("Proxy fetch failed for Lottie URL:", targetUrl, e);
  }

  throw new Error(`Could not load animation data from ${targetUrl}`);
};

export const LottieSticker: React.FC<LottieStickerProps> = ({ url, size, opacity = 1 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !containerRef.current || !url) return;

    let isCancelled = false;

    const init = async () => {
      try {
        const [lottieInstance, animData] = await Promise.all([
          ensureLottieLoaded(),
          fetchLottieData(url),
        ]);

        if (isCancelled || !containerRef.current || !lottieInstance || !animData) return;

        if (animRef.current) {
          animRef.current.destroy();
          animRef.current = null;
        }

        containerRef.current.innerHTML = "";

        animRef.current = lottieInstance.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: animData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
            clearCanvas: true,
            progressiveLoad: true,
            hideOnTransparent: true,
          },
        });
      } catch (err) {
        if (!isCancelled) {
          console.warn("LottieSticker render error for", url, err);
          setLoadError(true);
        }
      }
    };

    init();

    return () => {
      isCancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
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
        minWidth: size,
        minHeight: size,
        opacity,
        pointerEvents: "none",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {loadError && (
        <span style={{ fontSize: size * 0.4, opacity: 0.4 }}>🐰</span>
      )}
    </div>
  );
};
