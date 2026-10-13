import React, { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

// --- TYPES & DATA CONTRACTS ---
export interface MemorySlide {
  id: string;
  tag: string;           // e.g. "MOMENT I", "FIRST DATE", "SUMMER 2026"
  title: string;         // e.g. "The First Spark"
  dateLocation?: string; // e.g. "📍 The Corner Table"
  caption: string;       // e.g. "I still remember how time seemed to stop..."
  imageUrl: string;      // Base64 WebP or public image URL
  accentColor: string;
}

export interface AnvConfig {
  coupleNames: string;
  anniversaryDate: string;
  introTitle: string;
  introSubtitle: string;
  memories: MemorySlide[];
  letter: {
    salutation: string;
    paragraphs: string[];
    closing: string;
    signature: string;
  };
}

const STORAGE_CONFIG_KEY = "@anv_custom_config_2026";
const SUPABASE_SETTINGS_KEY = "anniversary_config";

export const DEFAULT_CONFIG: AnvConfig = {
  coupleNames: "Us",
  anniversaryDate: "October 13, 2026",
  introTitle: "365 Days of Us",
  introSubtitle: "A private collection of our favorite moments, stolen minutes, and memories from our first year together.",
  memories: [
    {
      id: "mem-1",
      tag: "CHAPTER I",
      title: "Where It All Started",
      dateLocation: "🗓️ Day 1 · October 13",
      caption: "Looking back at where our story officially began. I still catch myself smiling at how effortless and magical talking to you felt from the very first moment.",
      imageUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#fb7185",
    },
    {
      id: "mem-2",
      tag: "CHAPTER II",
      title: "Stolen Minutes",
      dateLocation: "☕ Our Favorite Spot",
      caption: "Running across the city just to steal a quick date together. Packed buses, silly jokes, and wishing the minutes wouldn't tick by so fast.",
      imageUrl: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#c084fc",
    },
    {
      id: "mem-3",
      tag: "CHAPTER III",
      title: "Late Night Conversations",
      dateLocation: "🌙 2:00 AM Whispers",
      caption: "Our quiet sanctuary on our private app. Typing indicators that made hearts race and deep conversations that carried us until the early morning hours.",
      imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#38bdf8",
    },
    {
      id: "mem-4",
      tag: "CHAPTER IV",
      title: "My Safe Place",
      dateLocation: "🤍 Everywhere With You",
      caption: "In a noisy, crowded world, being with you feels like coming home. Thank you for your warmth, your sweetness, and for loving me the way you do.",
      imageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#fbbf24",
    },
  ],
  letter: {
    salutation: "To My Favorite Person,",
    paragraphs: [
      "365 days ago, our story officially began. Looking back at everything we've shared, I still catch myself smiling at how effortless and magical being with you feels.",
      "From running for buses just to steal quick moments together, to texting until the early morning hours, you've made every ordinary day feel like an adventure.",
      "Thank you for your warmth, your kindness, your silly jokes, and for loving me the way you do. You are my safe place and my favorite home.",
      "Here is to 365 days behind us, and a lifetime of stolen moments ahead. Happy One Year Anniversary, my love! 💕",
    ],
    closing: "Forever & Always Yours,",
    signature: "With All My Heart",
  },
};

// --- WEB AUDIO CHIME & SEAL CRACK ENGINE ---
class AnvAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSealBreak() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tactile snap/crack
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // 2. Rising harmonic chime
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chimeOsc.type = "sine";
      chimeOsc.frequency.setValueAtTime(freq, now + 0.05 + idx * 0.04);

      chimeGain.gain.setValueAtTime(0, now + 0.05 + idx * 0.04);
      chimeGain.gain.linearRampToValueAtTime(0.06, now + 0.05 + idx * 0.04 + 0.08);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + idx * 0.04 + 1.8);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chimeOsc.start(now + 0.05 + idx * 0.04);
      chimeOsc.stop(now + 0.05 + idx * 0.04 + 2.0);
    });
  }

  playSlideTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.04);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playCelebrationFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.07, now + idx * 0.05 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 2.6);
    });
  }
}

const audio = new AnvAudioEngine();

// --- CLIENT-SIDE IMAGE COMPRESSION (max 1100px, WebP/JPEG, ~75KB) ---
function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDim = 1100;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first (great compression), fallback to JPEG
        let dataUrl = canvas.toDataURL("image/webp", 0.78);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- MAIN ANNIVERSARY MEMORY SCRAPBOOK & WRAPPED PAGE ---
export default function AnniversaryPage() {
  const router = useRouter();

  // 1. Initial State: Load from localStorage first, then sync with Supabase cloud
  const [config, setConfig] = useState<AnvConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(STORAGE_CONFIG_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_CONFIG;
  });

  const [cloudSyncStatus, setCloudSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");

  // Fetch config from Supabase app_settings so her phone gets his uploaded photos!
  useEffect(() => {
    let isMounted = true;
    async function loadCloudConfig() {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", SUPABASE_SETTINGS_KEY)
          .maybeSingle();

        if (!error && data && data.value && isMounted) {
          const cloudConfig = data.value as AnvConfig;
          if (cloudConfig.memories && Array.isArray(cloudConfig.memories)) {
            setConfig(cloudConfig);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cloudConfig));
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch anniversary config from cloud:", err);
      }
    }
    loadCloudConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Slide indexing:
  // Slide 0: Cover / Intro Milestone Card ("365 Days of Us")
  // Slides 1 to N: Couple Photo Memories
  // Final Slide (N + 1): The 3D Wax Seal Envelope & Love Letter
  const totalSteps = 1 + config.memories.length + 1;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const isCoverSlide = activeSlideIndex === 0;
  const isFinalSlide = activeSlideIndex === totalSteps - 1;
  const currentMemoryIndex = activeSlideIndex - 1;
  const currentMemory: MemorySlide | null =
    !isCoverSlide && !isFinalSlide && config.memories[currentMemoryIndex]
      ? config.memories[currentMemoryIndex]
      : null;

  // Story progression timer & pause on touch/hold
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Wax Seal & Letter Reveal State
  const [isSealBroken, setIsSealBroken] = useState(false);
  const [isLetterOpened, setIsLetterOpened] = useState(false);
  const [celebrationFired, setCelebrationFired] = useState(false);

  // Quick Photo Uploader Drawer & Visual Admin Editor
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<AnvConfig>(config);
  const [editingTab, setEditingTab] = useState<"photos" | "letter" | "raw">("photos");
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Hidden file input for on-the-fly photo upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetMemoryIdRef = useRef<string | null>(null);

  // Background Canvas Particle System
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<any[]>([]);

  // Touch swipe tracking
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Check URL query ?edit=true
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") === "true") {
        setDraftConfig(config);
        setIsEditDrawerOpen(true);
      }
    }
  }, [config]);

  // Navigation handlers
  const goToNextSlide = useCallback(() => {
    if (activeSlideIndex < totalSteps - 1) {
      setActiveSlideIndex((prev) => prev + 1);
      setProgress(0);
      audio.playSlideTick();
    }
  }, [activeSlideIndex, totalSteps]);

  const goToPrevSlide = useCallback(() => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex((prev) => prev - 1);
      setProgress(0);
      audio.playSlideTick();
    }
  }, [activeSlideIndex]);

  // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditDrawerOpen) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft") {
        goToPrevSlide();
      } else if (e.key === "Escape") {
        router.replace("/");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextSlide, goToPrevSlide, isEditDrawerOpen, router]);

  // Auto-advance progress timer (Instagram story mode; pauses on hover or on final letter slide)
  useEffect(() => {
    if (isFinalSlide || isEditDrawerOpen) return;

    // Give photo slides 8 seconds to view peacefully
    const SLIDE_DURATION_MS = isCoverSlide ? 6000 : 8000;
    const intervalMs = 50;
    const stepIncrement = (intervalMs / SLIDE_DURATION_MS) * 100;

    const timer = setInterval(() => {
      if (!isPausedRef.current) {
        setProgress((prev) => {
          if (prev + stepIncrement >= 100) {
            goToNextSlide();
            return 0;
          }
          return prev + stepIncrement;
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [activeSlideIndex, isFinalSlide, isCoverSlide, isEditDrawerOpen, goToNextSlide]);

  // Canvas Particles Engine (Romantic Ambient Twinkles + Celebration Confetti)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Ambient floating stardust
    particlesRef.current = [];
    const colors = ["#fda4af", "#f43f5e", "#fde047", "#fbbf24", "#e0e7ff", "#c084fc"];
    for (let i = 0; i < 45; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.35,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: 0,
      });
    }

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.decay > 0) {
          p.alpha -= p.decay;
          p.vy += 0.08;
          p.vx *= 0.985;
        } else {
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.decay > 0 ? 10 : 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      particlesRef.current = particlesRef.current.filter((p) => p.decay === 0 || p.alpha > 0);
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Confetti Burst Trigger
  const spawnCelebrationBurst = () => {
    audio.playCelebrationFanfare();
    setCelebrationFired(true);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const palette = ["#fbbf24", "#f43f5e", "#fda4af", "#fff", "#fde047", "#e879f9"];

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 11;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.5,
        size: 3 + Math.random() * 4,
        alpha: 1,
        color: palette[Math.floor(Math.random() * palette.length)],
        decay: 0.012 + Math.random() * 0.016,
      });
    }
  };

  // Wax Seal Break & Love Letter Open
  const handleBreakSeal = () => {
    if (isSealBroken) return;
    audio.playSealBreak();
    setIsSealBroken(true);

    setTimeout(() => {
      setIsLetterOpened(true);
      spawnCelebrationBurst();
    }, 650);
  };

  // Save to Cloud & Local Storage
  const handleSaveConfig = async (newConfig: AnvConfig) => {
    setConfig(newConfig);
    setDraftConfig(newConfig);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
    }

    setCloudSyncStatus("syncing");
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: SUPABASE_SETTINGS_KEY,
        value: newConfig,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Cloud save failed:", error);
        setCloudSyncStatus("offline");
      } else {
        setCloudSyncStatus("synced");
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 3500);
      }
    } catch (e) {
      console.error("Cloud sync exception:", e);
      setCloudSyncStatus("offline");
    }
  };

  // Handle Photo File Pick & Compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetMemoryId = uploadTargetMemoryIdRef.current;
    setIsUploading(true);
    try {
      const compressedDataUrl = await compressImageFile(file);

      if (targetMemoryId) {
        // Update specific memory
        const updatedMemories = draftConfig.memories.map((m) =>
          m.id === targetMemoryId ? { ...m, imageUrl: compressedDataUrl } : m
        );
        const updatedConfig = { ...draftConfig, memories: updatedMemories };
        setDraftConfig(updatedConfig);
        await handleSaveConfig(updatedConfig);
      } else {
        // Add new memory with this photo
        const newMemory: MemorySlide = {
          id: `mem-${Date.now()}`,
          tag: `MEMORY ${draftConfig.memories.length + 1}`,
          title: "A Special Moment",
          dateLocation: "🗓️ October 2026",
          caption: "A favorite memory with you.",
          imageUrl: compressedDataUrl,
          accentColor: "#fb7185",
        };
        const updatedConfig = {
          ...draftConfig,
          memories: [...draftConfig.memories, newMemory],
        };
        setDraftConfig(updatedConfig);
        await handleSaveConfig(updatedConfig);
      }
    } catch (err) {
      alert("Failed to process photo. Please try a different image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Quick trigger to pick photo for current slide
  const triggerPhotoUpload = (memoryId?: string) => {
    uploadTargetMemoryIdRef.current = memoryId || null;
    fileInputRef.current?.click();
  };

  // Delete memory
  const handleDeleteMemory = async (id: string) => {
    if (draftConfig.memories.length <= 1) {
      alert("You need at least one memory slide!");
      return;
    }
    const filtered = draftConfig.memories.filter((m) => m.id !== id);
    const updated = { ...draftConfig, memories: filtered };
    setDraftConfig(updated);
    await handleSaveConfig(updated);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#07050a",
        color: "#fff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 999999,
      }}
    >
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />

      {/* Embedded Aesthetics & Keyframe Animations */}
      <style>{`
        @keyframes anvSlideUp {
          from { transform: translateY(24px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes anvFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sealGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(225, 29, 72, 0.45), inset 0 0 10px rgba(255, 255, 255, 0.25); }
          50% { box-shadow: 0 0 45px rgba(225, 29, 72, 0.85), inset 0 0 16px rgba(255, 255, 255, 0.45); }
        }
        @keyframes letterSlideOut {
          from { transform: translateY(40px) scale(0.92); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .anv-glass-card {
          background: rgba(18, 14, 25, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), inset 0 0 30px rgba(244, 63, 94, 0.08);
        }
        .polaroid-frame {
          background: #191422;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65), 0 0 25px rgba(244, 63, 94, 0.12);
          transition: transform 0.3s ease;
        }
      `}</style>

      {/* Background HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
      />

      {/* Twilight Ambient Gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(88, 28, 135, 0.28) 0%, rgba(225, 29, 72, 0.14) 50%, rgba(7, 5, 10, 0.98) 85%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* TOP BAR: Instagram-style Story Bars & Header Controls */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "16px 20px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "100%",
          maxWidth: "680px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Story Progress Segmented Bars */}
        <div style={{ display: "flex", gap: "5px", width: "100%" }}>
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isCompleted = idx < activeSlideIndex;
            const isCurrent = idx === activeSlideIndex;
            const fillWidth = isCompleted ? "100%" : isCurrent ? `${progress}%` : "0%";

            return (
              <div
                key={idx}
                onClick={() => {
                  setActiveSlideIndex(idx);
                  setProgress(0);
                }}
                style={{
                  flex: 1,
                  height: "3.5px",
                  backgroundColor: "rgba(255, 255, 255, 0.22)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: fillWidth,
                    backgroundColor: isCompleted || isCurrent ? "#f43f5e" : "transparent",
                    transition: isCurrent ? "width 0.05s linear" : "width 0.2s ease",
                    boxShadow: isCurrent ? "0 0 8px #f43f5e" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Header Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <button
            onClick={() => router.replace("/")}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: "999px",
              padding: "6px 14px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(12px)",
            }}
          >
            <span>←</span> Return to Chat
          </button>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {saveSuccessNotice && (
              <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 700 }}>
                ✓ Synced to Cloud!
              </span>
            )}

            <button
              onClick={() => {
                setDraftConfig(config);
                setIsEditDrawerOpen(true);
              }}
              style={{
                background: "rgba(251, 191, 36, 0.12)",
                border: "1px solid rgba(251, 191, 36, 0.35)",
                borderRadius: "999px",
                padding: "6px 14px",
                color: "#fbbf24",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              title="Add photos, edit captions & letter"
            >
              <span>📷</span> Manage Photos & Letter
            </button>
          </div>
        </div>
      </div>

      {/* MAIN STORY CONTENT CONTAINER */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 16px 20px",
          width: "100%",
          maxWidth: "540px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={(e) => {
          setIsPaused(true);
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          setIsPaused(false);
          const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
          const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
          if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) goToNextSlide();
            else goToPrevSlide();
          }
        }}
      >
        {/* Invisible Tap Zones: Left 25% = Previous, Right 25% = Next */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            goToPrevSlide();
          }}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "25%",
            zIndex: 10,
            cursor: "w-resize",
          }}
        />
        <div
          onClick={(e) => {
            e.stopPropagation();
            goToNextSlide();
          }}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "25%",
            zIndex: 10,
            cursor: "e-resize",
          }}
        />

        {/* --- SCENARIO 1: COVER SLIDE ("365 Days of Us") --- */}
        {isCoverSlide && (
          <div
            className="anv-glass-card"
            style={{
              position: "relative",
              width: "100%",
              borderRadius: "32px",
              padding: "44px 28px",
              textAlign: "center",
              animation: "anvSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
              boxSizing: "border-box",
            }}
          >
            {/* Romantic Anniversary Badge */}
            <div
              style={{
                display: "inline-block",
                padding: "6px 16px",
                borderRadius: "999px",
                background: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.35)",
                color: "#fda4af",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "2px",
                marginBottom: "20px",
              }}
            >
              ✦ ONE YEAR MILESTONE ✦
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: "36px",
                fontWeight: 900,
                margin: "0 0 12px",
                lineHeight: "1.2",
                background: "linear-gradient(135deg, #fff 40%, #fb7185 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {config.introTitle}
            </h1>

            {/* Glowing 365 Days Marker */}
            <div
              style={{
                fontSize: "56px",
                fontWeight: 900,
                color: "#f43f5e",
                lineHeight: "1",
                margin: "18px 0 10px",
                textShadow: "0 0 35px rgba(244, 63, 94, 0.6)",
              }}
            >
              365
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#fbbf24",
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginBottom: "22px",
              }}
            >
              Days of Love & Laughter
            </div>

            {/* Subtitle / Intro Narrative */}
            <p
              style={{
                fontSize: "15px",
                lineHeight: "1.7",
                color: "rgba(255, 255, 255, 0.85)",
                margin: "0 0 32px",
                padding: "0 10px",
              }}
            >
              {config.introSubtitle}
            </p>

            {/* Start Button */}
            <button
              onClick={goToNextSlide}
              style={{
                background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                border: "none",
                borderRadius: "999px",
                padding: "14px 34px",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                cursor: "pointer",
                boxShadow: "0 10px 28px rgba(244, 63, 94, 0.5)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>View Our Memories</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* --- SCENARIO 2: PHOTO MEMORY POLAROID SLIDES --- */}
        {!isCoverSlide && !isFinalSlide && currentMemory && (
          <div
            key={currentMemory.id}
            className="polaroid-frame"
            style={{
              position: "relative",
              width: "100%",
              maxHeight: "82vh",
              borderRadius: "28px",
              padding: "18px 18px 22px",
              textAlign: "center",
              animation: "anvSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Top Tag & Location Badge */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 6px 12px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "1.6px",
                  color: currentMemory.accentColor,
                  textTransform: "uppercase",
                }}
              >
                {currentMemory.tag}
              </span>

              {currentMemory.dateLocation && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.65)",
                    background: "rgba(255, 255, 255, 0.08)",
                    padding: "3px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {currentMemory.dateLocation}
                </span>
              )}
            </div>

            {/* Featured Photo Container */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "300px",
                maxHeight: "42vh",
                borderRadius: "20px",
                overflow: "hidden",
                backgroundColor: "#0d0a14",
                boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.6)",
              }}
            >
              {currentMemory.imageUrl ? (
                <img
                  src={currentMemory.imageUrl}
                  alt={currentMemory.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    color: "rgba(255, 255, 255, 0.4)",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>📷</span>
                  <span style={{ fontSize: "13px" }}>No photo uploaded yet</span>
                </div>
              )}

              {/* Discrete Replace Photo Button directly on Card */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerPhotoUpload(currentMemory.id);
                }}
                style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  background: "rgba(0, 0, 0, 0.68)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "999px",
                  padding: "5px 12px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>📷</span> Change Photo
              </button>
            </div>

            {/* Title & Caption */}
            <div style={{ padding: "16px 8px 6px" }}>
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  margin: "0 0 8px",
                  color: "#fff",
                }}
              >
                {currentMemory.title}
              </h2>

              <p
                style={{
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: "rgba(255, 255, 255, 0.88)",
                  margin: "0 0 10px",
                  fontStyle: "italic",
                }}
              >
                "{currentMemory.caption}"
              </p>

              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(255, 255, 255, 0.35)",
                  marginTop: "6px",
                }}
              >
                Tap right to continue · Tap left to rewind
              </div>
            </div>
          </div>
        )}

        {/* --- SCENARIO 3: GRAND FINALE (Slide N: Wax Seal & Handwritten Letter) --- */}
        {isFinalSlide && (
          <div
            className="anv-glass-card"
            style={{
              position: "relative",
              width: "100%",
              maxHeight: "82vh",
              borderRadius: "32px",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "anvFadeIn 0.5s ease-out",
              boxSizing: "border-box",
              overflowY: isLetterOpened ? "auto" : "hidden",
            }}
          >
            {!isLetterOpened ? (
              /* Envelope & Wax Seal Interaction */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                  padding: "20px 0",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#fbbf24",
                    letterSpacing: "2px",
                    marginBottom: "12px",
                  }}
                >
                  ✦ THE GRAND FINALE ✦
                </div>

                <h2
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    margin: "0 0 8px",
                    textAlign: "center",
                  }}
                >
                  A Letter for You
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "rgba(255, 255, 255, 0.65)",
                    margin: "0 0 30px",
                    textAlign: "center",
                  }}
                >
                  Sealed with one year of memories. Tap the wax seal to break it open.
                </p>

                {/* 3D Envelope Container */}
                <div
                  style={{
                    position: "relative",
                    width: "260px",
                    height: "170px",
                    backgroundColor: "#1c1424",
                    borderRadius: "16px",
                    border: "1px solid rgba(244, 63, 94, 0.35)",
                    boxShadow: "0 20px 45px rgba(0, 0, 0, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  onClick={handleBreakSeal}
                >
                  {/* Envelope Triangular Flap */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "85px",
                      background: "linear-gradient(180deg, #2a1b38 0%, #1c1424 100%)",
                      clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                      transformOrigin: "top",
                      transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      transform: isSealBroken ? "rotateX(180deg)" : "rotateX(0deg)",
                      zIndex: 3,
                    }}
                  />

                  {/* Textured Crimson Wax Seal Stamp */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 10,
                      width: "68px",
                      height: "68px",
                      borderRadius: "50%",
                      backgroundColor: "#be123c",
                      border: "3px solid #fda4af",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "sealGlow 3s infinite",
                      transform: isSealBroken ? "scale(1.25) rotate(15deg)" : "scale(1)",
                      opacity: isSealBroken ? 0 : 1,
                      transition: "transform 0.4s ease, opacity 0.4s ease",
                      boxShadow: "0 8px 24px rgba(190, 18, 60, 0.6)",
                    }}
                  >
                    <div style={{ fontSize: "28px", color: "#ffe4e6", fontWeight: "900" }}>
                      ❦
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "26px",
                    fontSize: "13px",
                    color: "#fbbf24",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  Tap the seal to read your letter ✨
                </div>
              </div>
            ) : (
              /* Unfolded Handwritten Love Letter */
              <div
                style={{
                  width: "100%",
                  animation: "letterSlideOut 0.5s ease-out",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    background: "rgba(254, 243, 199, 0.06)",
                    border: "1px solid rgba(251, 191, 36, 0.25)",
                    borderRadius: "24px",
                    padding: "28px 22px",
                    width: "100%",
                    boxSizing: "border-box",
                    textAlign: "left",
                    color: "#fef3c7",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  {/* Salutation */}
                  <h3
                    style={{
                      fontSize: "24px",
                      fontStyle: "italic",
                      color: "#fbbf24",
                      margin: "0 0 16px",
                      fontFamily: "'Playwrite BR', 'Dancing Script', cursive",
                    }}
                  >
                    {config.letter.salutation}
                  </h3>

                  {/* Paragraphs */}
                  {config.letter.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: "17px",
                        lineHeight: "1.8",
                        margin: "0 0 16px",
                        color: "rgba(255, 255, 255, 0.92)",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {p}
                    </p>
                  ))}

                  {/* Closing & Signature */}
                  <div style={{ marginTop: "24px", textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontStyle: "italic",
                        color: "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      {config.letter.closing}
                    </div>
                    <div
                      style={{
                        fontSize: "26px",
                        color: "#f43f5e",
                        marginTop: "4px",
                        fontFamily: "'Playwrite BR', 'Dancing Script', cursive",
                      }}
                    >
                      {config.letter.signature}
                    </div>
                  </div>
                </div>

                {/* Celebration Fanfare & Fireworks Button */}
                <button
                  onClick={spawnCelebrationBurst}
                  style={{
                    marginTop: "26px",
                    background:
                      "linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #fbbf24 100%)",
                    border: "none",
                    borderRadius: "999px",
                    padding: "14px 34px",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 800,
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    boxShadow: "0 10px 30px rgba(244, 63, 94, 0.55)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🎉</span>
                  <span>
                    {celebrationFired
                      ? "Ignite More Fireworks ✨"
                      : "Celebrate Our First Year 💕"}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER NAVIGATION */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px 20px",
          width: "100%",
          maxWidth: "540px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={goToPrevSlide}
          disabled={activeSlideIndex === 0}
          style={{
            background: "transparent",
            border: "none",
            color: activeSlideIndex === 0 ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.7)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: activeSlideIndex === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ‹ Rewind
        </button>

        <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 600 }}>
          {activeSlideIndex + 1} / {totalSteps}
        </div>

        <button
          onClick={goToNextSlide}
          disabled={isFinalSlide}
          style={{
            background: "transparent",
            border: "none",
            color: isFinalSlide ? "rgba(255, 255, 255, 0.2)" : "#f43f5e",
            fontSize: "14px",
            fontWeight: 700,
            cursor: isFinalSlide ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          Next ›
        </button>
      </div>

      {/* --- PHOTO & MEMORIES ADMIN DRAWER --- */}
      {isEditDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(20px)",
            zIndex: 9999999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              backgroundColor: "#151020",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "24px",
              padding: "24px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              color: "#fff",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "19px", color: "#fbbf24" }}>
                  📷 Memories & Love Letter
                </h3>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.55)" }}>
                  Upload couple photos, edit captions & sync directly to her device.
                </span>
              </div>
              <button
                onClick={() => setIsEditDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "10px" }}>
              <button
                onClick={() => setEditingTab("photos")}
                style={{
                  background: editingTab === "photos" ? "#f43f5e" : "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                📷 Photo Memories ({draftConfig.memories.length})
              </button>
              <button
                onClick={() => setEditingTab("letter")}
                style={{
                  background: editingTab === "letter" ? "#f43f5e" : "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                💌 Love Letter
              </button>
              <button
                onClick={() => setEditingTab("raw")}
                style={{
                  background: editingTab === "raw" ? "#f43f5e" : "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ⚙️ Raw JSON
              </button>
            </div>

            {/* Tab 1: Photo Memories Visual Manager */}
            {editingTab === "photos" && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  paddingRight: "6px",
                }}
              >
                {/* Intro Settings */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "12px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                    Cover Slide Title:
                  </label>
                  <input
                    type="text"
                    value={draftConfig.introTitle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, introTitle: e.target.value })
                    }
                    style={{
                      background: "#0d0a14",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#fff",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* List of Memories */}
                {draftConfig.memories.map((mem, index) => (
                  <div
                    key={mem.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "16px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: mem.accentColor }}>
                        Slide #{index + 1}: {mem.tag}
                      </span>
                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        style={{
                          background: "rgba(244, 63, 94, 0.15)",
                          border: "none",
                          color: "#f43f5e",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      {/* Photo Thumbnail + Upload Button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div
                          style={{
                            width: "90px",
                            height: "90px",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#000",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                          }}
                        >
                          {mem.imageUrl ? (
                            <img
                              src={mem.imageUrl}
                              alt="thumb"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                color: "#666",
                              }}
                            >
                              📷
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => triggerPhotoUpload(mem.id)}
                          disabled={isUploading}
                          style={{
                            background: "rgba(255, 255, 255, 0.12)",
                            border: "1px solid rgba(255, 255, 255, 0.25)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            color: "#fff",
                            fontSize: "11px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isUploading ? "Uploading..." : "Upload Photo"}
                        </button>
                      </div>

                      {/* Title & Caption Inputs */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input
                          type="text"
                          placeholder="Memory Title (e.g. That Rainy Tuesday)"
                          value={mem.title}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].title = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          style={{
                            background: "#0d0a14",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        />

                        <input
                          type="text"
                          placeholder="Date or Location (e.g. 📍 Central Park · Oct 2025)"
                          value={mem.dateLocation || ""}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].dateLocation = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          style={{
                            background: "#0d0a14",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            color: "#fda4af",
                            fontSize: "12px",
                          }}
                        />

                        <textarea
                          placeholder="Personal note or caption..."
                          value={mem.caption}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].caption = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          rows={2}
                          style={{
                            background: "#0d0a14",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            color: "#fff",
                            fontSize: "13px",
                            resize: "vertical",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add New Memory Button */}
                <button
                  onClick={() => triggerPhotoUpload()}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px dashed rgba(255, 255, 255, 0.25)",
                    borderRadius: "14px",
                    padding: "14px",
                    color: "#fbbf24",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <span>+</span> Upload & Add New Memory Photo
                </button>
              </div>
            )}

            {/* Tab 2: Love Letter Manager */}
            {editingTab === "letter" && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  paddingRight: "6px",
                }}
              >
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                    Salutation / Opening:
                  </label>
                  <input
                    type="text"
                    value={draftConfig.letter.salutation}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        letter: { ...draftConfig.letter, salutation: e.target.value },
                      })
                    }
                    style={{
                      width: "100%",
                      background: "#0d0a14",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                    Letter Paragraphs (separate paragraphs with an empty line):
                  </label>
                  <textarea
                    rows={8}
                    value={draftConfig.letter.paragraphs.join("\n\n")}
                    onChange={(e) => {
                      const paragraphs = e.target.value
                        .split(/\n\s*\n/)
                        .map((p) => p.trim())
                        .filter(Boolean);
                      setDraftConfig({
                        ...draftConfig,
                        letter: { ...draftConfig.letter, paragraphs },
                      });
                    }}
                    style={{
                      width: "100%",
                      background: "#0d0a14",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      color: "#fef3c7",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      boxSizing: "border-box",
                      marginTop: "4px",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                      Closing (e.g. Forever Yours):
                    </label>
                    <input
                      type="text"
                      value={draftConfig.letter.closing}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          letter: { ...draftConfig.letter, closing: e.target.value },
                        })
                      }
                      style={{
                        width: "100%",
                        background: "#0d0a14",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        marginTop: "4px",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                      Signature (e.g. Your Name):
                    </label>
                    <input
                      type="text"
                      value={draftConfig.letter.signature}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          letter: { ...draftConfig.letter, signature: e.target.value },
                        })
                      }
                      style={{
                        width: "100%",
                        background: "#0d0a14",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        marginTop: "4px",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Raw JSON */}
            {editingTab === "raw" && (
              <textarea
                value={JSON.stringify(draftConfig, null, 2)}
                onChange={(e) => {
                  try {
                    setDraftConfig(JSON.parse(e.target.value));
                  } catch {}
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#0d0a14",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  padding: "14px",
                  color: "#a5f3fc",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            )}

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                paddingTop: "14px",
              }}
            >
              <button
                onClick={() => {
                  setDraftConfig(DEFAULT_CONFIG);
                  handleSaveConfig(DEFAULT_CONFIG);
                }}
                style={{
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  color: "#f43f5e",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset to Defaults
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => setIsEditDrawerOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    color: "rgba(255, 255, 255, 0.7)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    await handleSaveConfig(draftConfig);
                    setIsEditDrawerOpen(false);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 22px",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 6px 18px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  Save & Sync to Cloud ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
