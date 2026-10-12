import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

// --- TYPES & DEFAULT CONFIGURATION ---
export interface AnvSlide {
  id: string;
  badge: string;
  title: string;
  metricValue: string;
  metricLabel: string;
  metricValue2?: string;
  metricLabel2?: string;
  story: string;
  accentColor: string;
}

export interface AnvConfig {
  coupleNames: string;
  anniversaryDate: string;
  slides: AnvSlide[];
  letter: {
    salutation: string;
    paragraphs: string[];
    closing: string;
    signature: string;
  };
}

const STORAGE_CONFIG_KEY = "@anv_custom_config_2026";

export const DEFAULT_CONFIG: AnvConfig = {
  coupleNames: "Us",
  anniversaryDate: "October 13, 2026",
  slides: [
    {
      id: "prelude",
      badge: "OUR 1-YEAR STORY",
      title: "The 365-Day Journey",
      metricValue: "365",
      metricLabel: "Days Together",
      metricValue2: "Year 1",
      metricLabel2: "Milestone",
      story: "A private rewind of every commute, stolen minute, inside joke, and secret late-night text that brought us here.",
      accentColor: "#fb7185",
    },
    {
      id: "commute",
      badge: "MILESTONE I",
      title: "The Commute Champion",
      metricValue: "1.5",
      metricLabel: "Hour Bus Rides",
      metricValue2: "100s",
      metricLabel2: "Kilometers Traveled",
      story: "Packed buses, heavy rain, or sheer exhaustion—nothing ever mattered compared to the feeling of finally seeing your face at the stop.",
      accentColor: "#38bdf8",
    },
    {
      id: "stealth",
      badge: "MILESTONE II",
      title: "Stealth Mode: Level 100",
      metricValue: "10,000+",
      metricLabel: "Encrypted Messages",
      metricValue2: "2:00 AM",
      metricLabel2: "Usual Bedtime",
      story: "Our quiet sanctuary on our private app. Whispering in secret codes, typing indicators that made hearts race, and conversations that never ran dry.",
      accentColor: "#c084fc",
    },
    {
      id: "heists",
      badge: "MILESTONE III",
      title: "The 35-Minute Heists",
      metricValue: "35",
      metricLabel: "Minute Quick Dates",
      metricValue2: "∞",
      metricLabel2: "Stolen Smiles",
      story: "Rushing across the city for a quick 35-minute coffee date. Sitting at that corner table, sharing food, making memories that defied the ticking clock.",
      accentColor: "#fbbf24",
    },
    {
      id: "odometer",
      badge: "THE TIME SCALE",
      title: "One Whole Year",
      metricValue: "365",
      metricLabel: "Days Complete",
      metricValue2: "31.5M",
      metricLabel2: "Seconds Of Love",
      story: "8,760 hours. 525,600 minutes. 365 days of choosing you, laughing with you, and building a world that only the two of us understand.",
      accentColor: "#f43f5e",
    },
  ],
  letter: {
    salutation: "To My Favorite Person,",
    paragraphs: [
      "365 days ago, our story officially began. Looking back at everything we've shared, I still catch myself smiling at how effortless and magical being with you feels.",
      "From running for buses just to steal 35 minutes together, to texting until the early morning hours, you've made every ordinary day feel like an adventure.",
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
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.03);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playCelebrationFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0.06, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 1.8);
    });
  }
}

const audio = new AnvAudioEngine();

// --- MAIN WRAPPED PAGE COMPONENT ---
export default function AnniversaryWrappedPage() {
  const router = useRouter();

  // Load custom config from localStorage if present
  const [config, setConfig] = useState<AnvConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(STORAGE_CONFIG_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_CONFIG;
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const totalSteps = config.slides.length + 1; // 5 story slides + 1 final letter slide
  const isFinalSlide = activeSlideIndex === config.slides.length;

  // Story progression timer & pause on hold
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Wax Seal & Letter Reveal State
  const [isSealBroken, setIsSealBroken] = useState(false);
  const [isLetterOpened, setIsLetterOpened] = useState(false);
  const [celebrationFired, setCelebrationFired] = useState(false);

  // Edit Drawer State
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [draftConfigJson, setDraftConfigJson] = useState("");

  // Canvas Particle System
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<any[]>([]);

  // Rolling odometer state
  const [odometerValue, setOdometerValue] = useState(0);

  // Touch swipe tracking
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // 1. Check if ?edit=true is in the query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") === "true") {
        setDraftConfigJson(JSON.stringify(config, null, 2));
        setIsEditDrawerOpen(true);
      }
    }
  }, []);

  // 2. Animate Odometer on Slide Change
  useEffect(() => {
    const currentSlide = config.slides[activeSlideIndex];
    if (currentSlide && !isNaN(Number(currentSlide.metricValue))) {
      const target = Number(currentSlide.metricValue);
      const start = performance.now();
      const duration = 1200;
      const animate = (time: number) => {
        const elapsed = time - start;
        const p = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        setOdometerValue(Math.floor(ease * target));
        if (p < 1) requestAnimationFrame(animate);
        else setOdometerValue(target);
      };
      requestAnimationFrame(animate);
    } else {
      setOdometerValue(0);
    }
  }, [activeSlideIndex, config.slides]);

  // 3. Navigation Controls
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

  // 4. Auto-advance Progress Bar (Story mode, stops on final letter slide)
  useEffect(() => {
    if (isFinalSlide || isEditDrawerOpen) return;

    const SLIDE_DURATION_MS = 6500;
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
  }, [activeSlideIndex, isFinalSlide, isEditDrawerOpen, goToNextSlide]);

  // 5. Canvas Particles Engine (Ambient Dust + Celebration Confetti)
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

    // Initial ambient star particles
    particlesRef.current = [];
    const colors = ["#fda4af", "#f43f5e", "#fde047", "#fbbf24", "#e0e7ff", "#c084fc"];
    for (let i = 0; i < 45; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.45,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
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
          p.vy += 0.08; // gravity for burst
          p.vx *= 0.985; // air resistance
        } else {
          // Loop ambient
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.decay > 0 ? 10 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Filter dead confetti
      particlesRef.current = particlesRef.current.filter((p) => p.decay === 0 || p.alpha > 0);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 6. Confetti Burst Helper
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

  // 7. Wax Seal Break & Letter Unfold Action
  const handleBreakSeal = () => {
    if (isSealBroken) return;
    audio.playSealBreak();
    setIsSealBroken(true);

    setTimeout(() => {
      setIsLetterOpened(true);
      spawnCelebrationBurst();
    }, 650);
  };

  // 8. Save / Reset Config in Edit Drawer
  const handleSaveDraftConfig = () => {
    try {
      const parsed = JSON.parse(draftConfigJson);
      setConfig(parsed);
      window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(parsed));
      setIsEditDrawerOpen(false);
      setActiveSlideIndex(0);
      setProgress(0);
      alert("Anniversary story config saved successfully! ✨");
    } catch (e: any) {
      alert("Invalid JSON format: " + e.message);
    }
  };

  const handleResetDefaultConfig = () => {
    if (window.confirm("Reset all slides to the default anniversary story?")) {
      setConfig(DEFAULT_CONFIG);
      window.localStorage.removeItem(STORAGE_CONFIG_KEY);
      setDraftConfigJson(JSON.stringify(DEFAULT_CONFIG, null, 2));
      setIsEditDrawerOpen(false);
      setActiveSlideIndex(0);
      setProgress(0);
    }
  };

  const currentStorySlide = config.slides[activeSlideIndex];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#08060b",
        color: "#ffffff",
        overflow: "hidden",
        fontFamily: "'Josefin Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        userSelect: "none",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <style>{`
        @keyframes anvFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes anvSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sealGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(225, 29, 72, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.2); }
          50% { box-shadow: 0 0 40px rgba(225, 29, 72, 0.8), inset 0 0 16px rgba(255, 255, 255, 0.4); }
        }
        @keyframes envelopeOpen {
          from { transform: rotateX(0deg); }
          to { transform: rotateX(180deg); }
        }
        @keyframes letterSlideOut {
          from { transform: translateY(40px) scale(0.92); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .anv-glass-card {
          background: rgba(22, 17, 30, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75), inset 0 0 30px rgba(244, 63, 94, 0.08);
        }
      `}</style>

      {/* Background HTML5 Canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} />

      {/* Radial Twilight Nebula Glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(88, 28, 135, 0.25) 0%, rgba(225, 29, 72, 0.15) 45%, rgba(8, 6, 11, 0.98) 85%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* TOP BAR: Instagram-style Story Progress Bars & Header Actions */}
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
        {/* Progress Bar Segmented Line */}
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

        {/* Top Controls: Return to Chat & Admin Customize Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
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
            <button
              onClick={() => {
                setDraftConfigJson(JSON.stringify(config, null, 2));
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
              title="Edit Slide Text & Letter"
            >
              <span>✎</span> Customize Story
            </button>
          </div>
        </div>
      </div>

      {/* MAIN STORY CONTENT AREA */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 20px 24px",
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

        {/* --- SCENARIO A: STORY SLIDES (0 to 4) --- */}
        {!isFinalSlide && currentStorySlide && (
          <div
            key={currentStorySlide.id}
            className="anv-glass-card"
            style={{
              position: "relative",
              width: "100%",
              borderRadius: "32px",
              padding: "36px 28px",
              textAlign: "center",
              animation: "anvSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
              boxSizing: "border-box",
            }}
          >
            {/* Slide Category Badge */}
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.08)",
                border: `1px solid ${currentStorySlide.accentColor}66`,
                color: currentStorySlide.accentColor,
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "1.8px",
                marginBottom: "16px",
              }}
            >
              {currentStorySlide.badge}
            </div>

            {/* Slide Title */}
            <h1
              style={{
                fontSize: "30px",
                fontWeight: 800,
                margin: "0 0 22px",
                lineHeight: "1.25",
                background: `linear-gradient(135deg, #fff 40%, ${currentStorySlide.accentColor} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {currentStorySlide.title}
            </h1>

            {/* Big Impact Metric Cards */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                margin: "18px 0 24px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "rgba(0, 0, 0, 0.38)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "20px",
                  padding: "16px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "38px",
                    fontWeight: 900,
                    color: currentStorySlide.accentColor,
                    lineHeight: "1",
                    marginBottom: "6px",
                  }}
                >
                  {!isNaN(Number(currentStorySlide.metricValue))
                    ? odometerValue
                    : currentStorySlide.metricValue}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255, 255, 255, 0.65)",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {currentStorySlide.metricLabel}
                </div>
              </div>

              {currentStorySlide.metricValue2 && (
                <div
                  style={{
                    flex: 1,
                    background: "rgba(0, 0, 0, 0.38)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "20px",
                    padding: "16px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "38px",
                      fontWeight: 900,
                      color: "#fbbf24",
                      lineHeight: "1",
                      marginBottom: "6px",
                    }}
                  >
                    {currentStorySlide.metricValue2}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255, 255, 255, 0.65)",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {currentStorySlide.metricLabel2}
                  </div>
                </div>
              )}
            </div>

            {/* Narrative Story Passage */}
            <p
              style={{
                fontSize: "15px",
                lineHeight: "1.7",
                color: "rgba(255, 255, 255, 0.9)",
                margin: "0 0 16px",
                padding: "0 8px",
              }}
            >
              {currentStorySlide.story}
            </p>

            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.35)", marginTop: "12px" }}>
              Tap right to continue · Tap left to rewind
            </div>
          </div>
        )}

        {/* --- SCENARIO B: GRAND FINALE (Slide 5: Wax Seal & Letter) --- */}
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

                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px", textAlign: "center" }}>
                  A Letter for You
                </h2>
                <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.65)", margin: "0 0 30px", textAlign: "center" }}>
                  Sealed with one year of memories. Tap the wax seal to break it open.
                </p>

                {/* Aesthetic 3D Envelope Container */}
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
                  {/* Envelope Triangular Top Flap */}
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
                    <div style={{ fontSize: "28px", color: "#ffe4e6", fontWeight: "900" }}>❦</div>
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
              /* Unfolded Handwritten Love Letter Reading Mode */
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
                    <div style={{ fontSize: "16px", fontStyle: "italic", color: "rgba(255, 255, 255, 0.7)" }}>
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

                {/* Interactive Celebration Fireworks Trigger */}
                <button
                  onClick={spawnCelebrationBurst}
                  style={{
                    marginTop: "26px",
                    background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #fbbf24 100%)",
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
                  <span>{celebrationFired ? "Ignite More Fireworks ✨" : "Celebrate Our First Year 💕"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER NAVIGATION BUTTONS */}
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

      {/* --- EDIT / CUSTOMIZE SLIDE DRAWER --- */}
      {isEditDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(16px)",
            zIndex: 9999999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              backgroundColor: "#161220",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "24px",
              padding: "24px",
              width: "100%",
              maxWidth: "640px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              color: "#fff",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#fbbf24" }}>
                ✎ Customize Story JSON
              </h3>
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

            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255, 255, 255, 0.65)" }}>
              Edit the titles, numbers, bus ride descriptions, or letter paragraphs below. Changes are saved to your browser's local storage.
            </p>

            <textarea
              value={draftConfigJson}
              onChange={(e) => setDraftConfigJson(e.target.value)}
              style={{
                flex: 1,
                minHeight: "340px",
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={handleResetDefaultConfig}
                style={{
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#f43f5e",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset to Defaults
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveDraftConfig}
                  style={{
                    background: "#10b981",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 20px",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save & Apply ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
