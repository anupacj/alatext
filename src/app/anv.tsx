import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// --- TYPES & DATA CONTRACTS ---
export interface MemorySlide {
  id: string;
  tag: string;           // Bottom note / sticker e.g. "stolen minutes ♡"
  title: string;         // e.g. "when we first met"
  dateLocation?: string; // e.g. "11 out of 10 day"
  caption: string;       // e.g. "I was really happy on that day,,,,,hehehehehe....."
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
const SUPABASE_STATS_KEY = "anniversary_stats";

export const DEFAULT_CONFIG: AnvConfig = {
  coupleNames: "Pretty Potato & You",
  anniversaryDate: "October 13, 2026",
  introTitle: "365 days of us",
  introSubtitle: "A little scrapbook of our first year together... all the quiet moments, late night talks, and memories that mean the world to me.",
  memories: [
    {
      id: "mem-1",
      tag: "october 13 · day one ♡",
      title: "Where it all started",
      dateLocation: "our first conversation",
      caption: "I went back and read our first conversation, when I told you I liked you. It made me smile so much.",
      imageUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#f472b6",
    },
    {
      id: "mem-2",
      tag: "late night whispers ♡",
      title: "Talking until 4 AM",
      dateLocation: "our quiet sanctuary",
      caption: "When I am sad or stressed or having a bad day, you never ignore me. You listen, and you always make me feel a little better.",
      imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#fbbf24",
    },
    {
      id: "mem-3",
      tag: "stolen minutes ♡",
      title: "Making time for each other",
      dateLocation: "every sweet moment",
      caption: "I know this is not easy for you, with your family and everything, and I really appreciate that you still make time for me.",
      imageUrl: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#fb7185",
    },
    {
      id: "mem-4",
      tag: "with all my heart ♡",
      title: "My favorite person",
      dateLocation: "always with you",
      caption: "You are one of the kindest, most thoughtful and coolest people I know, and you are really pretty too, way more than you realize.",
      imageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#f43f5e",
    },
  ],
  letter: {
    salutation: "Happy 1 year, Aleee.",
    paragraphs: [
      "Before writing this, I went back and read our first conversation, when I told you I liked you. It made me smile. I liked you then, but I love you so much more now. I don't even know where the year went.",
      "Thank you for always being there for me. When I'm sad or stressed or having a bad day, you never ignore me. You listen, and you always make me feel a little better. You accept me with all my flaws, and I'm really thankful for that. I'm also sorry if I've ever said something that hurt you. I never meant to.",
      "I know this isn't easy for you, with your family and everything, and I really appreciate that you still make time for me. You're one of the kindest, most thoughtful and coolest people I know, and you're really pretty too, way more than you realize.",
      "Thank you for trusting me with your heart. I'll always be gentle with it. I love you.",
    ],
    closing: "Always yours,",
    signature: "With all my heart ♡",
  },
};

// --- WARM ACOUSTIC CHIME & MUSIC BOX AUDIO ENGINE ---
class CozyAudioEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;
  private chimeStep: number = 0;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined" || !this.soundEnabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Soft page turn / gentle kalimba pluck
  playPageTurn() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Soft tactile tap heart chime
  playHeartTap() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const heartNotes = [659.25, 783.99, 987.77, 1046.5, 1318.51];
    const freq = heartNotes[Math.floor(Math.random() * heartNotes.length)];

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Realistic wax seal crack + sweet warm harmonic chime
  playWaxSealBreak() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const oscSnap = ctx.createOscillator();
    const gainSnap = ctx.createGain();
    oscSnap.type = "triangle";
    oscSnap.frequency.setValueAtTime(320, now);
    oscSnap.frequency.exponentialRampToValueAtTime(70, now + 0.06);

    gainSnap.gain.setValueAtTime(0.09, now);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    oscSnap.connect(gainSnap);
    gainSnap.connect(ctx.destination);
    oscSnap.start(now);
    oscSnap.stop(now + 0.09);

    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + 0.04 + idx * 0.05);

      gain.gain.setValueAtTime(0, now + 0.04 + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.04 + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04 + idx * 0.05 + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.04 + idx * 0.05);
      osc.stop(now + 0.04 + idx * 0.05 + 1.8);
    });
  }

  // Ascending harp arpeggio note with each successive celebration tap
  playLoveFanfareStep() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5, 1174.66, 1318.51];
    const freq = melody[this.chimeStep % melody.length];
    this.chimeStep++;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.1);
  }
}

const audio = new CozyAudioEngine();

// --- CLIENT-SIDE IMAGE COMPRESSION (Max 1100px, WebP/JPEG ~75KB) ---
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

// Format relative time helper
function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return "";
  }
}

// --- MAIN ANNIVERSARY SCRAPBOOK & LOVE LETTER PAGE ---
export default function AnniversaryScrapbookPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Load custom config from localStorage first, then sync with Supabase cloud
  const [config, setConfig] = useState<AnvConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(STORAGE_CONFIG_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_CONFIG;
  });

  const [soundMuted, setSoundMuted] = useState(false);

  // She Celebrate Clicks tracking (synced with Supabase)
  const [celebrateCount, setCelebrateCount] = useState<number>(0);
  const [lastCelebratedAt, setLastCelebratedAt] = useState<string | null>(null);
  const [buttonSpringAnim, setButtonSpringAnim] = useState(false);

  // Pairing lock & countdown state
  const [pairing, setPairing] = useState<any>(null);
  const [isLoadingPairing, setIsLoadingPairing] = useState(true);
  const [lockRemaining, setLockRemaining] = useState<string>("");
  const [isEditParam, setIsEditParam] = useState(false);

  // Sync with Supabase cloud on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCloudData() {
      try {
        // 1. Fetch anniversary config
        const { data: configData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", SUPABASE_SETTINGS_KEY)
          .maybeSingle();

        if (configData && configData.value && isMounted) {
          const cloudConfig = configData.value as AnvConfig;
          if (cloudConfig.letter && cloudConfig.memories) {
            setConfig(cloudConfig);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cloudConfig));
            }
          }
        }

        // 2. Fetch celebrate stats (how many times she tapped Celebrate!)
        const { data: statsData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", SUPABASE_STATS_KEY)
          .maybeSingle();

        if (statsData && statsData.value && isMounted) {
          if (typeof statsData.value.celebrate_clicks === "number") {
            setCelebrateCount(statsData.value.celebrate_clicks);
          }
          if (statsData.value.last_clicked_at) {
            setLastCelebratedAt(statsData.value.last_clicked_at);
          }
        }

        // 3. Fetch anniversary pairings to check countdown lock
        const { data: pairingsData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "anniversary_pairings")
          .maybeSingle();

        if (pairingsData?.value && Array.isArray(pairingsData.value) && isMounted) {
          let match = user
            ? pairingsData.value.find(
                (p: any) => p.active !== false && (p.recipient_id === user?.id || p.sender_id === user?.id)
              )
            : null;
          if (!match) {
            match = pairingsData.value.find((p: any) => p.active !== false);
          }
          if (match) {
            setPairing(match);
          }
        }
      } catch (err) {
        console.warn("Could not fetch data from cloud:", err);
      } finally {
        if (isMounted) setIsLoadingPairing(false);
      }
    }
    loadCloudData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Check if locked for current user
  const isSender = Boolean(user && pairing && user.id === pairing.sender_id);
  const isExpired = Boolean(pairing && new Date(pairing.unlock_at).getTime() <= Date.now());
  const isUnlockedGlobally = Boolean(pairing && (pairing.is_unlocked || isExpired));
  const isLocked = Boolean(pairing && !isUnlockedGlobally && !isEditParam);

  // Lock countdown timer
  useEffect(() => {
    if (!pairing || isUnlockedGlobally) {
      setLockRemaining("");
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, new Date(pairing.unlock_at).getTime() - Date.now());
      if (diff <= 0) {
        setLockRemaining("00:00:00");
        return;
      }
      const hours = Math.floor(diff / (1000 * 3600));
      const mins = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setLockRemaining(`${pad(hours)}:${pad(mins)}:${pad(secs)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pairing, isUnlockedGlobally]);

  // Dynamically load warm, cozy Google Fonts: Caveat, Quicksand, Cormorant Garamond
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fontId = "anv-google-fonts";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Quicksand:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  // Slide indexing
  const totalSteps = 1 + config.memories.length + 1;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const isCoverSlide = activeSlideIndex === 0;
  const isFinalSlide = activeSlideIndex === totalSteps - 1;
  const currentMemoryIndex = activeSlideIndex - 1;
  const currentMemory: MemorySlide | null =
    !isCoverSlide && !isFinalSlide && config.memories[currentMemoryIndex]
      ? config.memories[currentMemoryIndex]
      : null;

  // Story progression timer & pause on hold
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Wax Seal & Love Letter reveal states
  const [isSealBroken, setIsSealBroken] = useState(false);
  const [isLetterOpened, setIsLetterOpened] = useState(false);

  // Discreet photo & letter manager drawer
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<AnvConfig>(config);
  const [editingTab, setEditingTab] = useState<"photos" | "letter">("photos");
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Hidden file input for on-the-fly photo upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetMemoryIdRef = useRef<string | null>(null);

  // Background Canvas: Warm candlelit fireflies, floating hearts, and sakura petals
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
        setIsEditParam(true);
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
      audio.playPageTurn();
    }
  }, [activeSlideIndex, totalSteps]);

  const goToPrevSlide = useCallback(() => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex((prev) => prev - 1);
      setProgress(0);
      audio.playPageTurn();
    }
  }, [activeSlideIndex]);

  // Keyboard navigation
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

  // Gentle auto-advance (8.5 seconds on memories, pauses on hold or final letter slide)
  useEffect(() => {
    if (isFinalSlide || isEditDrawerOpen) return;

    const SLIDE_DURATION_MS = isCoverSlide ? 6500 : 8500;
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

  // Canvas Particles Engine: Supports Ambient Fireflies, Tap Hearts, Wax Shards, and Sakura Petals
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

    // Initial ambient fireflies
    particlesRef.current = [];
    const warmPalette = ["#fde68a", "#fbcfe8", "#fed7aa", "#fef08a", "#ffd1dc"];
    for (let i = 0; i < 35; i++) {
      particlesRef.current.push({
        type: "firefly",
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.1 - Math.random() * 0.25,
        size: 1.8 + Math.random() * 2.8,
        alpha: 0.15 + Math.random() * 0.45,
        color: warmPalette[Math.floor(Math.random() * warmPalette.length)],
        pulse: Math.random() * Math.PI,
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
          p.vy += p.gravity || 0.05;
          p.vx *= 0.985;
        } else if (p.type === "firefly") {
          p.pulse += 0.02;
          const currentAlpha = Math.max(0.08, p.alpha + Math.sin(p.pulse) * 0.12);

          if (p.y < -15) p.y = height + 15;
          if (p.x < -15) p.x = width + 15;
          if (p.x > width + 15) p.x = -15;

          ctx.save();
          ctx.globalAlpha = Math.max(0, currentAlpha);
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);

        if (p.type === "heart") {
          ctx.fillStyle = p.color;
          ctx.font = `${p.size * 5}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("♥", 0, 0);
        } else if (p.type === "petal") {
          ctx.fillStyle = p.color;
          ctx.rotate((p.rotation || 0) * (Math.PI / 180));
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 2, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

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

  // ANIMATION 1: Interactive Tap-Anywhere Micro Heart Burst
  const spawnTapHeart = (clientX: number, clientY: number) => {
    audio.playHeartTap();
    const heartColors = ["#f43f5e", "#fda4af", "#f472b6", "#fbbf24", "#fff"];

    for (let i = 0; i < 4; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 1.8 + Math.random() * 3.5;
      particlesRef.current.push({
        type: "heart",
        x: clientX + (Math.random() - 0.5) * 16,
        y: clientY + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed * 0.7,
        vy: -speed - 1.2,
        size: 2.5 + Math.random() * 2,
        alpha: 1,
        color: heartColors[Math.floor(Math.random() * heartColors.length)],
        decay: 0.02 + Math.random() * 0.015,
        gravity: 0.02,
      });
    }
  };

  // ANIMATION 2: Wax Seal Shards Burst
  const spawnWaxSealCrackEffect = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 7;
      particlesRef.current.push({
        type: "wax",
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 4,
        alpha: 1,
        color: i % 2 === 0 ? "#be123c" : "#fbbf24",
        decay: 0.018 + Math.random() * 0.018,
        gravity: 0.12,
      });
    }
  };

  // ANIMATION 3: The Grand Celebration Heart & Petal Fountain
  const spawnCelebrationBurst = () => {
    audio.playLoveFanfareStep();
    setButtonSpringAnim(true);
    setTimeout(() => setButtonSpringAnim(false), 350);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.72;
    const romanticColors = ["#f43f5e", "#fda4af", "#fbbf24", "#fff", "#f472b6", "#fed7aa", "#fbcfe8"];

    for (let i = 0; i < 65; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 4 + Math.random() * 11;
      const isHeart = Math.random() > 0.45;
      particlesRef.current.push({
        type: isHeart ? "heart" : "petal",
        x: cx + (Math.random() - 0.5) * 50,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        size: 3 + Math.random() * 3.5,
        rotation: Math.random() * 360,
        alpha: 1,
        color: romanticColors[Math.floor(Math.random() * romanticColors.length)],
        decay: 0.01 + Math.random() * 0.014,
        gravity: 0.06,
      });
    }
  };

  // Wax Seal Break action
  const handleBreakSeal = () => {
    if (isSealBroken) return;
    audio.playWaxSealBreak();
    spawnWaxSealCrackEffect();
    setIsSealBroken(true);

    setTimeout(() => {
      setIsLetterOpened(true);
      spawnCelebrationBurst();
    }, 650);
  };

  // Celebrate Button Click Handler (Updates Supabase so he sees her tap count!)
  const handleCelebrateClick = async () => {
    spawnCelebrationBurst();
    const newCount = celebrateCount + 1;
    const nowIso = new Date().toISOString();
    setCelebrateCount(newCount);
    setLastCelebratedAt(nowIso);

    try {
      await supabase.from("app_settings").upsert({
        key: SUPABASE_STATS_KEY,
        value: {
          celebrate_clicks: newCount,
          last_clicked_at: nowIso,
        },
        updated_at: nowIso,
      });
    } catch (e) {
      console.warn("Could not save celebrate tap:", e);
    }
  };

  // Cloud & Local Storage Save
  const handleSaveConfig = async (newConfig: AnvConfig) => {
    setConfig(newConfig);
    setDraftConfig(newConfig);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
    }

    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: SUPABASE_SETTINGS_KEY,
        value: newConfig,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 3000);
      }
    } catch (e) {
      console.error("Cloud sync exception:", e);
    }
  };

  // Handle Photo Pick & Compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetMemoryId = uploadTargetMemoryIdRef.current;
    setIsUploading(true);
    try {
      const compressedDataUrl = await compressImageFile(file);

      if (targetMemoryId) {
        const updatedMemories = draftConfig.memories.map((m) =>
          m.id === targetMemoryId ? { ...m, imageUrl: compressedDataUrl } : m
        );
        const updatedConfig = { ...draftConfig, memories: updatedMemories };
        setDraftConfig(updatedConfig);
        await handleSaveConfig(updatedConfig);
      } else {
        const newMemory: MemorySlide = {
          id: `mem-${Date.now()}`,
          tag: `our memories ♡`,
          title: "A Special Moment",
          dateLocation: "with you",
          caption: "Another favorite memory with you.",
          imageUrl: compressedDataUrl,
          accentColor: "#f472b6",
        };
        const updatedConfig = {
          ...draftConfig,
          memories: [...draftConfig.memories, newMemory],
        };
        setDraftConfig(updatedConfig);
        await handleSaveConfig(updatedConfig);
      }
    } catch (err) {
      alert("Could not load photo. Please try another image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerPhotoUpload = (memoryId?: string) => {
    uploadTargetMemoryIdRef.current = memoryId || null;
    fileInputRef.current?.click();
  };

  const handleDeleteMemory = async (id: string) => {
    if (draftConfig.memories.length <= 1) {
      alert("Keep at least one memory in your scrapbook!");
      return;
    }
    const filtered = draftConfig.memories.filter((m) => m.id !== id);
    const updated = { ...draftConfig, memories: filtered };
    setDraftConfig(updated);
    await handleSaveConfig(updated);
  };

  // While checking pairings from cloud, display quiet loading screen (prevents any content leak)
  if (isLoadingPairing) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#110d13",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fda4af",
          fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
          zIndex: 999999,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💌</div>
          <div style={{ fontSize: 14, letterSpacing: 1 }}>Opening scrapbook...</div>
        </div>
      </div>
    );
  }

  // If locked (before scheduled unlock time and not in ?edit=true mode)
  if (isLocked) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#110d13",
          backgroundImage: "radial-gradient(ellipse at 50% 25%, rgba(244,63,94,0.18) 0%, rgba(17,13,19,0.98) 75%)",
          color: "#fff",
          fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          zIndex: 999999,
          userSelect: "none",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: 24,
            padding: "36px 24px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 35px rgba(244,63,94,0.15)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 52, filter: "drop-shadow(0 4px 14px rgba(244,63,94,0.4))" }}>
            💌
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fecdd3", letterSpacing: "-0.01em" }}>
            A Little Surprise is Waiting...
          </h2>

          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.6 }}>
            To my Pretty Potato ♡<br />
            Our 1-Year Scrapbook unlocks in:
          </p>

          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
              letterSpacing: 3,
              color: "#fb7185",
              backgroundColor: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.35)",
              padding: "10px 24px",
              borderRadius: 16,
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            {lockRemaining || "00:00:00"}
          </div>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
            Take a deep breath and check back in your chat soon ✨
          </p>

          {/* Admin Sender Controls on Locked Screen */}
          {isSender && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 8 }}>
              <button
                onClick={() => setIsEditParam(true)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  backgroundColor: "rgba(244, 63, 94, 0.2)",
                  border: "1px solid rgba(244, 63, 94, 0.4)",
                  color: "#fda4af",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                👑 Admin: Enter Preview & Edit Mode
              </button>
              <button
                onClick={async () => {
                  try {
                    const { data: pData } = await supabase
                      .from("app_settings")
                      .select("value")
                      .eq("key", "anniversary_pairings")
                      .maybeSingle();
                    if (pData?.value && Array.isArray(pData.value)) {
                      const updated = pData.value.map((p: any) =>
                        p.id === pairing.id ? { ...p, is_unlocked: true } : p
                      );
                      await supabase
                        .from("app_settings")
                        .upsert({ key: "anniversary_pairings", value: updated });
                      setPairing((prev: any) => (prev ? { ...prev, is_unlocked: true } : prev));
                      alert("✓ Unlocked! Potato can now open it in her chat!");
                    }
                  } catch (e: any) {
                    alert("Error: " + e.message);
                  }
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  backgroundColor: "#e11d48",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Instant Unlock for Her Now ✨
              </button>
            </div>
          )}

          <button
            onClick={() => router.replace("/chat" as any)}
            style={{
              marginTop: 6,
              padding: "10px 22px",
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Return to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        // Spawn floating tap hearts anywhere user clicks (except buttons/inputs)
        const target = e.target as HTMLElement;
        if (target.tagName !== "BUTTON" && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          spawnTapHeart(e.clientX, e.clientY);
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#110d13",
        color: "#fff",
        fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 999999,
      }}
    >
      {/* Sender Admin Preview Banner */}
      {isSender && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000000,
            backgroundColor: "rgba(244, 63, 94, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>👑</span>
            <span>
              Preview Mode · {isUnlockedGlobally ? "Unlocked & Live for Potato ✨" : `Locks for Potato: ${lockRemaining || "calculating..."}`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isUnlockedGlobally && (
              <button
                onClick={async () => {
                  try {
                    const { data: pData } = await supabase
                      .from("app_settings")
                      .select("value")
                      .eq("key", "anniversary_pairings")
                      .maybeSingle();
                    if (pData?.value && Array.isArray(pData.value)) {
                      const updated = pData.value.map((p: any) =>
                        p.id === pairing.id ? { ...p, is_unlocked: true } : p
                      );
                      await supabase
                        .from("app_settings")
                        .upsert({ key: "anniversary_pairings", value: updated });
                      setPairing((prev: any) => (prev ? { ...prev, is_unlocked: true } : prev));
                      alert("✓ Unlocked! Potato can now open it in her chat!");
                    }
                  } catch (e: any) {
                    alert("Error: " + e.message);
                  }
                }}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#e11d48",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Instant Unlock For Her Now ✨
              </button>
            )}
            <button
              onClick={() => {
                setDraftConfig(config);
                setIsEditDrawerOpen(true);
              }}
              style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Edit Photos / Text
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />

      {/* Embedded Warm Aesthetics & Polaroid Styles */}
      <style>{`
        @keyframes polaroidFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-4px) rotate(-0.5deg); }
        }
        @keyframes sealCandleGlow {
          0%, 100% { box-shadow: 0 0 18px rgba(225, 29, 72, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.2); }
          50% { box-shadow: 0 0 32px rgba(225, 29, 72, 0.75), inset 0 0 15px rgba(255, 255, 255, 0.4); }
        }
        @keyframes paperUnfold {
          from { transform: translateY(30px) scale(0.94); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes buttonSquish {
          0% { transform: scale(1); }
          40% { transform: scale(0.92); }
          75% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .cozy-card {
          background: rgba(26, 19, 27, 0.88);
          border: 1px solid rgba(254, 215, 170, 0.16);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), inset 0 0 25px rgba(251, 191, 36, 0.05);
        }
        .polaroid-paper {
          background: #faf8f5;
          color: #2e2420;
          border-radius: 8px;
          padding: 12px 12px 22px 12px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.25);
          position: relative;
          transition: transform 0.4s ease;
          box-sizing: border-box;
          max-height: 84vh;
          display: flex;
          flex-direction: column;
        }
        .washi-tape {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 85px;
          height: 22px;
          background: rgba(254, 240, 215, 0.7);
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          border-left: 2px dashed rgba(217, 119, 6, 0.25);
          border-right: 2px dashed rgba(217, 119, 6, 0.25);
          z-index: 5;
        }
        .letter-stationery {
          background: #fffdf9;
          color: #2b1d16;
          box-shadow: inset 0 0 35px rgba(217, 119, 6, 0.06), 0 15px 40px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(217, 119, 6, 0.15);
        }
        .celebrate-btn-bounce {
          animation: buttonSquish 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>

      {/* Ambient Canvas Particles */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
      />

      {/* Cozy Candlelit Gradient Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(67, 24, 38, 0.45) 0%, rgba(35, 18, 28, 0.6) 45%, rgba(13, 10, 15, 0.98) 90%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* TOP HEADER */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "16px 20px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
          maxWidth: "520px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Soft Story Progress Bars */}
        <div style={{ display: "flex", gap: "4px", width: "100%" }}>
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
                  height: "3px",
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: fillWidth,
                    backgroundColor: isCompleted || isCurrent ? "#fda4af" : "transparent",
                    transition: isCurrent ? "width 0.05s linear" : "width 0.2s ease",
                    boxShadow: isCurrent ? "0 0 6px #fda4af" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Header Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            paddingTop: "2px",
          }}
        >
          <button
            onClick={() => router.replace("/")}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "999px",
              padding: "5px 12px",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span>←</span> Back to chat
          </button>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Audio Toggle */}
            <button
              onClick={() => {
                const nextState = !soundMuted;
                setSoundMuted(nextState);
                audio.soundEnabled = !nextState;
              }}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "999px",
                width: "28px",
                height: "28px",
                color: soundMuted ? "rgba(255, 255, 255, 0.4)" : "#fed7aa",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={soundMuted ? "Unmute sound" : "Mute sound"}
            >
              {soundMuted ? "🔇" : "♫"}
            </button>

            {/* Discreet Scrapbook Manager */}
            <button
              onClick={() => {
                setDraftConfig(config);
                setIsEditDrawerOpen(true);
              }}
              style={{
                background: "rgba(254, 215, 170, 0.12)",
                border: "1px solid rgba(254, 215, 170, 0.25)",
                borderRadius: "999px",
                padding: "5px 12px",
                color: "#fed7aa",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              title="Edit photos or letter"
            >
              <span>✏️</span> memories
              {celebrateCount > 0 && (
                <span
                  style={{
                    backgroundColor: "#f43f5e",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "1px 6px",
                    fontSize: "10px",
                    fontWeight: 800,
                    marginLeft: "2px",
                  }}
                >
                  {celebrateCount} 💕
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN SCRAPBOOK STAGE */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 16px 18px",
          width: "100%",
          maxWidth: "460px",
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

        {/* --- SCENARIO 1: WARM SCRAPBOOK COVER --- */}
        {isCoverSlide && (
          <div
            className="cozy-card"
            style={{
              position: "relative",
              width: "100%",
              borderRadius: "28px",
              padding: "40px 24px",
              textAlign: "center",
              animation: "paperUnfold 0.45s ease-out",
              boxSizing: "border-box",
            }}
          >
            {/* Subtle Intimate Badge */}
            <div
              style={{
                display: "inline-block",
                padding: "5px 14px",
                borderRadius: "999px",
                background: "rgba(253, 164, 175, 0.12)",
                border: "1px solid rgba(253, 164, 175, 0.3)",
                color: "#fda4af",
                fontSize: "12px",
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                letterSpacing: "0.5px",
                marginBottom: "16px",
              }}
            >
              october 13 · one year together ♡
            </div>

            {/* Warm Loving Title for Pretty Potato */}
            <h1
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "44px",
                fontWeight: 700,
                margin: "0 0 2px",
                lineHeight: "1.2",
                color: "#fff",
                textShadow: "0 2px 18px rgba(244, 63, 94, 0.45)",
                letterSpacing: "0.5px",
              }}
            >
              To my Pretty Potato ♡
            </h1>

            <div
              style={{
                fontFamily: "'Quicksand', -apple-system, sans-serif",
                fontSize: "17px",
                fontWeight: 600,
                color: "#fbcfe8",
                letterSpacing: "0.5px",
                marginBottom: "18px",
              }}
            >
              365 days of us
            </div>

            {/* Warm Heart Icon */}
            <div
              style={{
                fontSize: "36px",
                margin: "4px 0 14px",
                filter: "drop-shadow(0 0 12px rgba(244, 63, 94, 0.5))",
              }}
            >
              🌸
            </div>

            {/* Intro Narrative */}
            <p
              style={{
                fontFamily: "'Quicksand', -apple-system, sans-serif",
                fontSize: "14px",
                lineHeight: "1.7",
                color: "rgba(255, 255, 255, 0.85)",
                margin: "0 0 26px",
                padding: "0 8px",
                fontStyle: "italic",
              }}
            >
              {config.introSubtitle}
            </p>

            {/* Tender Open Button */}
            <button
              onClick={goToNextSlide}
              style={{
                background: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)",
                border: "none",
                borderRadius: "999px",
                padding: "12px 32px",
                color: "#fff",
                fontSize: "14px",
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 25px rgba(244, 63, 94, 0.45)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>open our memories</span>
              <span>♡</span>
            </button>
          </div>
        )}

        {/* --- SCENARIO 2: PHYSICAL POLAROID PHOTO MEMORY (UNCROPPED & SEAMLESS) --- */}
        {!isCoverSlide && !isFinalSlide && currentMemory && (
          <div
            key={currentMemory.id}
            className="polaroid-paper"
            style={{
              width: "100%",
              maxWidth: "380px",
              animation: "polaroidFloat 6s ease-in-out infinite",
              boxSizing: "border-box",
            }}
          >
            {/* Washi Tape Strip at Top */}
            <div className="washi-tape" />

            {/* Polaroid Photo Frame (Adaptive Height, Full Contain, Seamless Ambient Blur Fill) */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "320px",
                maxHeight: "44vh",
                backgroundColor: "#161118",
                borderRadius: "5px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 0 16px rgba(0, 0, 0, 0.45)",
                flexShrink: 1,
              }}
            >
              {currentMemory.imageUrl ? (
                <>
                  {/* Layer 1: Ambient Background Color Fill (No weird black boxes) */}
                  <img
                    src={currentMemory.imageUrl}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: "-20px",
                      width: "calc(100% + 40px)",
                      height: "calc(100% + 40px)",
                      objectFit: "cover",
                      filter: "blur(22px) brightness(0.65) saturate(1.2)",
                      opacity: 0.6,
                      pointerEvents: "none",
                    }}
                  />

                  {/* Layer 2: Sharp Uncropped Photo (100% visible, whole chat screenshot / photo shows!) */}
                  <img
                    src={currentMemory.imageUrl}
                    alt={currentMemory.title}
                    style={{
                      position: "relative",
                      zIndex: 2,
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      borderRadius: "3px",
                      filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35))",
                    }}
                  />

                  {/* Subtle Change Photo Trigger in Top Corner (Never blocks message text) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPhotoUpload(currentMemory.id);
                    }}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      zIndex: 10,
                      background: "rgba(0, 0, 0, 0.52)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "999px",
                      padding: "3px 9px",
                      color: "rgba(255, 255, 255, 0.9)",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <span>📷</span> change
                  </button>
                </>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "#888",
                  }}
                >
                  <span style={{ fontSize: "28px" }}>📷</span>
                  <span style={{ fontSize: "12px", fontFamily: "'Quicksand', sans-serif" }}>
                    add our photo
                  </span>
                </div>
              )}
            </div>

            {/* Handwritten Polaroid Notes */}
            <div style={{ padding: "12px 6px 2px", textAlign: "left", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#2e2420",
                  }}
                >
                  {currentMemory.title}
                </span>

                {currentMemory.dateLocation && (
                  <span
                    style={{
                      fontFamily: "'Caveat', cursive",
                      fontSize: "16px",
                      color: "#92400e",
                    }}
                  >
                    {currentMemory.dateLocation}
                  </span>
                )}
              </div>

              {/* Personal Caption */}
              <p
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: "20px",
                  lineHeight: "1.35",
                  color: "#453229",
                  margin: "2px 0 6px",
                }}
              >
                "{currentMemory.caption}"
              </p>

              {/* Footer Note / Editable Tag */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#9c8e85",
                  marginTop: "4px",
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                }}
              >
                <span>{currentMemory.tag || "♡"}</span>
                <span>swipe to turn ˘͈ᵕ˘͈</span>
              </div>
            </div>
          </div>
        )}

        {/* --- SCENARIO 3: THE WAX SEAL ENVELOPE & WRITTEN LETTER --- */}
        {isFinalSlide && (
          <div
            className="cozy-card"
            style={{
              position: "relative",
              width: "100%",
              maxHeight: "82vh",
              borderRadius: "28px",
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "paperUnfold 0.45s ease-out",
              boxSizing: "border-box",
              overflowY: isLetterOpened ? "auto" : "hidden",
            }}
          >
            {!isLetterOpened ? (
              /* Velvet Wine Envelope & Crimson Wax Seal Stamp */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                  padding: "16px 0",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: "22px",
                    color: "#fbcfe8",
                    marginBottom: "6px",
                  }}
                >
                  sealed just for you ♡
                </div>

                <h2
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: "34px",
                    fontWeight: 700,
                    margin: "0 0 6px",
                    textAlign: "center",
                    color: "#fff",
                    textShadow: "0 2px 14px rgba(244, 63, 94, 0.45)",
                  }}
                >
                  To my Pretty Potato ♡
                </h2>
                <p
                  style={{
                    fontSize: "13px",
                    fontFamily: "'Quicksand', sans-serif",
                    color: "rgba(255, 255, 255, 0.7)",
                    margin: "0 0 24px",
                    textAlign: "center",
                  }}
                >
                  Tap the wax seal to break it open.
                </p>

                {/* Tactile 3D Envelope */}
                <div
                  style={{
                    position: "relative",
                    width: "250px",
                    height: "165px",
                    backgroundColor: "#2e0f19",
                    borderRadius: "14px",
                    border: "1px solid rgba(251, 191, 36, 0.3)",
                    boxShadow: "0 18px 45px rgba(0, 0, 0, 0.75)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  onClick={handleBreakSeal}
                >
                  {/* Flap */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "82px",
                      background: "linear-gradient(180deg, #421624 0%, #2e0f19 100%)",
                      clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                      transformOrigin: "top",
                      transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      transform: isSealBroken ? "rotateX(180deg)" : "rotateX(0deg)",
                      zIndex: 3,
                    }}
                  />

                  {/* Crimson Wax Seal Stamp */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 10,
                      width: "66px",
                      height: "66px",
                      borderRadius: "50%",
                      backgroundColor: "#be123c",
                      border: "3px solid #fda4af",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "sealCandleGlow 3s infinite",
                      transform: isSealBroken ? "scale(1.2) rotate(15deg)" : "scale(1)",
                      opacity: isSealBroken ? 0 : 1,
                      transition: "transform 0.4s ease, opacity 0.4s ease",
                      boxShadow: "0 8px 24px rgba(190, 18, 60, 0.65)",
                    }}
                  >
                    <div style={{ fontSize: "26px", color: "#ffe4e6" }}>❦</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "22px",
                    fontSize: "13px",
                    color: "#fbcfe8",
                    fontFamily: "'Caveat', cursive",
                    fontSizeAdjust: "0.55",
                  }}
                >
                  tap the wax seal to read your letter ✨
                </div>
              </div>
            ) : (
              /* Unfolded Handwritten Love Letter */
              <div
                style={{
                  width: "100%",
                  animation: "paperUnfold 0.5s ease-out",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  className="letter-stationery"
                  style={{
                    borderRadius: "18px",
                    padding: "26px 20px",
                    width: "100%",
                    boxSizing: "border-box",
                    textAlign: "left",
                  }}
                >
                  {/* Salutation */}
                  <h3
                    style={{
                      fontFamily: "'Caveat', cursive",
                      fontSize: "26px",
                      fontWeight: 700,
                      color: "#9f1239",
                      margin: "0 0 16px",
                    }}
                  >
                    {config.letter.salutation}
                  </h3>

                  {/* Letter Paragraphs (His Exact Words) */}
                  {config.letter.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "17px",
                        lineHeight: "1.75",
                        margin: "0 0 14px",
                        color: "#2c1c14",
                        letterSpacing: "0.15px",
                      }}
                    >
                      {p}
                    </p>
                  ))}

                  {/* Closing & Signature */}
                  <div style={{ marginTop: "20px", textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "16px",
                        fontStyle: "italic",
                        color: "#785342",
                      }}
                    >
                      {config.letter.closing}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Caveat', cursive",
                        fontSize: "27px",
                        color: "#be123c",
                        marginTop: "2px",
                      }}
                    >
                      {config.letter.signature}
                    </div>
                  </div>
                </div>

                {/* Sweet Interactive Celebration Button */}
                <button
                  onClick={handleCelebrateClick}
                  className={buttonSpringAnim ? "celebrate-btn-bounce" : ""}
                  style={{
                    marginTop: "22px",
                    background: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
                    border: "none",
                    borderRadius: "999px",
                    padding: "13px 30px",
                    color: "#fff",
                    fontSize: "14px",
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(244, 63, 94, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span>🌸</span>
                  <span>
                    {celebrateCount === 0
                      ? "A year of loving you 💕"
                      : celebrateCount === 1
                      ? "I love you so much ♡"
                      : `Sending love to you... 💕 (×${celebrateCount})`}
                  </span>
                </button>

                {celebrateCount > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#fda4af",
                      fontFamily: "'Caveat', cursive",
                      fontSizeAdjust: "0.55",
                    }}
                  >
                    {celebrateCount === 1 ? "1 love reaction sent ♡" : `${celebrateCount} love reactions sent to him! 💕`}
                  </div>
                )}
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
          padding: "10px 24px 18px",
          width: "100%",
          maxWidth: "460px",
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
            color: activeSlideIndex === 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.65)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: activeSlideIndex === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          ‹ rewind
        </button>

        <div
          style={{
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.4)",
            fontFamily: "'Caveat', cursive",
            fontSizeAdjust: "0.55",
          }}
        >
          {activeSlideIndex + 1} of {totalSteps}
        </div>

        <button
          onClick={goToNextSlide}
          disabled={isFinalSlide}
          style={{
            background: "transparent",
            border: "none",
            color: isFinalSlide ? "rgba(255, 255, 255, 0.15)" : "#fda4af",
            fontSize: "13px",
            fontWeight: 700,
            cursor: isFinalSlide ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          next ›
        </button>
      </div>

      {/* --- MEMORIES & LETTER MANAGER DRAWER --- */}
      {isEditDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
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
              backgroundColor: "#19121d",
              border: "1px solid rgba(254, 215, 170, 0.2)",
              borderRadius: "22px",
              padding: "22px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              color: "#fff",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", color: "#fbcfe8", fontFamily: "'Caveat', cursive", fontWeight: 700 }}>
                  Our Memories & Letter ♡
                </h3>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", fontFamily: "'Quicksand', sans-serif" }}>
                  Upload photos, edit captions, and sync live to her phone.
                </span>
              </div>
              <button
                onClick={() => setIsEditDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* LIVE STATS BANNER: How many times she celebrated */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(244, 63, 94, 0.16) 0%, rgba(225, 29, 72, 0.08) 100%)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "14px",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "#fda4af", fontWeight: 700, letterSpacing: "0.5px" }}>
                  💌 HER LOVE REACTION TRACKER:
                </div>
                <div style={{ fontSize: "17px", fontWeight: 700, color: "#fff", fontFamily: "'Caveat', cursive" }}>
                  {celebrateCount > 0
                    ? `She tapped Celebrate ${celebrateCount} time${celebrateCount > 1 ? "s" : ""}! 💕`
                    : "She hasn't opened & tapped Celebrate yet..."}
                </div>
              </div>
              {lastCelebratedAt && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)" }}>Last tapped:</div>
                  <div style={{ fontSize: "12px", color: "#fed7aa", fontWeight: 600 }}>
                    {formatTimeAgo(lastCelebratedAt)}
                  </div>
                </div>
              )}
            </div>

            {/* Tab Switcher */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
              <button
                onClick={() => setEditingTab("photos")}
                style={{
                  background: editingTab === "photos" ? "#f43f5e" : "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "7px 14px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📷 Polaroid Photos ({draftConfig.memories.length})
              </button>
              <button
                onClick={() => setEditingTab("letter")}
                style={{
                  background: editingTab === "letter" ? "#f43f5e" : "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "7px 14px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                💌 Love Letter
              </button>
            </div>

            {/* Tab 1: Photos */}
            {editingTab === "photos" && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  paddingRight: "4px",
                }}
              >
                {draftConfig.memories.map((mem, index) => (
                  <div
                    key={mem.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "14px",
                      padding: "12px",
                      display: "flex",
                      gap: "12px",
                    }}
                  >
                    {/* Thumbnail & Upload Trigger */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <div
                        style={{
                          width: "75px",
                          height: "75px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          backgroundColor: "#000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {mem.imageUrl ? (
                          <img
                            src={mem.imageUrl}
                            alt="thumb"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <div style={{ fontSize: "20px" }}>📷</div>
                        )}
                      </div>
                      <button
                        onClick={() => triggerPhotoUpload(mem.id)}
                        disabled={isUploading}
                        style={{
                          background: "rgba(255, 255, 255, 0.1)",
                          border: "none",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          color: "#fed7aa",
                          fontSize: "10px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isUploading ? "..." : "upload photo"}
                      </button>
                    </div>

                    {/* Captions and Tag */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Title (e.g. when we first met)"
                          value={mem.title}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].title = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          style={{
                            flex: 1,
                            background: "#0c0810",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#f43f5e",
                            fontSize: "12px",
                            cursor: "pointer",
                            padding: "0 6px",
                          }}
                        >
                          delete
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type="text"
                          placeholder="Date / Top Note (e.g. 11 out of 10 day)"
                          value={mem.dateLocation || ""}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].dateLocation = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          style={{
                            flex: 1,
                            background: "#0c0810",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            color: "#fed7aa",
                            fontSize: "11px",
                          }}
                        />

                        {/* EDITABLE TAG / BOTTOM NOTE (Previously uneditable "stolen minutes ♡") */}
                        <input
                          type="text"
                          placeholder="Bottom Tag (e.g. stolen minutes ♡ or empty)"
                          value={mem.tag || ""}
                          onChange={(e) => {
                            const newMems = [...draftConfig.memories];
                            newMems[index].tag = e.target.value;
                            setDraftConfig({ ...draftConfig, memories: newMems });
                          }}
                          style={{
                            flex: 1,
                            background: "#0c0810",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            color: "#fda4af",
                            fontSize: "11px",
                          }}
                          title="This is the bottom sticker label (like 'stolen minutes ♡'). You can change or delete it."
                        />
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Caption (e.g. I was really happy on that day...)"
                        value={mem.caption}
                        onChange={(e) => {
                          const newMems = [...draftConfig.memories];
                          newMems[index].caption = e.target.value;
                          setDraftConfig({ ...draftConfig, memories: newMems });
                        }}
                        style={{
                          background: "#0c0810",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          color: "#fff",
                          fontSize: "12px",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => triggerPhotoUpload()}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px dashed rgba(255, 255, 255, 0.2)",
                    borderRadius: "12px",
                    padding: "12px",
                    color: "#fbcfe8",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  + Add another memory photo
                </button>
              </div>
            )}

            {/* Tab 2: Letter */}
            {editingTab === "letter" && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingRight: "4px",
                }}
              >
                <div>
                  <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                    Opening:
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
                      background: "#0c0810",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      marginTop: "3px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                    Letter content (separate paragraphs with an empty line):
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
                      background: "#0c0810",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      color: "#fef3c7",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      boxSizing: "border-box",
                      marginTop: "3px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      Closing:
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
                        background: "#0c0810",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        color: "#fff",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        marginTop: "3px",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      Signature:
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
                        background: "#0c0810",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        color: "#fff",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        marginTop: "3px",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                paddingTop: "12px",
              }}
            >
              {saveSuccessNotice ? (
                <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>
                  ✓ Synced to her phone!
                </span>
              ) : (
                <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)" }}>
                  Changes sync across all devices
                </span>
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setIsEditDrawerOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "7px 14px",
                    color: "rgba(255, 255, 255, 0.7)",
                    fontSize: "12px",
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
                    padding: "7px 18px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save & Sync ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
