import React, { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "@anniversary_milestone_oct13_2026";
const TARGET_MONTH = 9; // October (0-indexed: 9 = October)
const TARGET_DAY = 13;

const LETTER_TEXT =
  "365 days ago, our story officially began. " +
  "Through every late-night conversation, every quiet morning, every shared laugh, " +
  "and all the moments in between—you've made this year the most special chapter of my life. " +
  "Here's to all 31,536,000 seconds of love, and to forever more. Happy One Year Anniversary! 💕";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  rotation: number;
  vRot: number;
  decay: number;
  isHeart?: boolean;
}

// Web Audio API Synthesis Engine (Zero MP3 dependencies)
class WebAudioChimeEngine {
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

  // Ethereal major-ninth celestial crystal chord
  playCelestialChord() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // C5, E5, G5, B5, D6
    const freqs = [523.25, 659.25, 783.99, 987.77, 1174.66];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 2.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 3.0);
    });
  }

  // Soft vintage mechanical typewriter click
  playTypewriterClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(740 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Warm firework sparkle burst chime
  playBurstFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Resonant whoosh + shimmer
    const burstNotes = [587.33, 739.99, 880.0, 1046.5, 1318.51, 1567.98];
    burstNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.04);

      gain.gain.setValueAtTime(0.07, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 1.8);
    });
  }

  stopAll() {
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    }
  }
}

const audioEngine = new WebAudioChimeEngine();

export default function AnniversaryMilestoneWeb() {
  if (Platform.OS !== "web") return null;

  const [isOpen, setIsOpen] = useState(false);
  const [displayDays, setDisplayDays] = useState(0);
  const [showOdometerDetails, setShowOdometerDetails] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [isTypewriterDone, setIsTypewriterDone] = useState(false);
  const [celebrationCount, setCelebrationCount] = useState(0);

  // 3D Perspective Card Tilt
  const [cardTilt, setCardTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const keySequenceRef = useRef<string>("");

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setDisplayDays(0);
    setShowOdometerDetails(false);
    setDisplayText("");
    setIsTypewriterDone(false);
    audioEngine.playCelestialChord();
  }, []);

  const handleClose = useCallback(() => {
    audioEngine.stopAll();
    setIsOpen(false);
  }, []);

  // 1. Trigger Hooks: URL query, Console helper, Oct 13 check, Secret key combo, Custom event
  useEffect(() => {
    if (typeof window === "undefined") return;

    // A. Console tester
    (window as any).triggerAnniversary = handleOpen;

    // B. URL parameter tester (?anniversary=1 or ?milestone=1)
    if (window.location.search.includes("anniversary=1") || window.location.search.includes("milestone=1")) {
      handleOpen();
    }

    // C. Oct 13th Automatic Check
    const now = new Date();
    if (now.getMonth() === TARGET_MONTH && now.getDate() === TARGET_DAY) {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, "true");
        handleOpen();
      }
    }

    // D. Custom Event from Header Triple-Tap
    const handleCustomEvent = () => handleOpen();

    // E. Secret keystroke chord: typing "365" or "one" or pressing '1'+'3'
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      keySequenceRef.current += e.key.toLowerCase();
      if (keySequenceRef.current.length > 8) {
        keySequenceRef.current = keySequenceRef.current.slice(-8);
      }
      if (
        keySequenceRef.current.endsWith("365") ||
        keySequenceRef.current.endsWith("one") ||
        keySequenceRef.current.endsWith("love")
      ) {
        keySequenceRef.current = "";
        handleOpen();
      }
    };

    window.addEventListener("open_anniversary_milestone", handleCustomEvent);
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      delete (window as any).triggerAnniversary;
      window.removeEventListener("open_anniversary_milestone", handleCustomEvent);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [handleOpen, handleClose]);

  // 2. Rolling Odometer Effect: Rolls 0 -> 365 Days over 1.6s
  useEffect(() => {
    if (!isOpen) return;
    const duration = 1600;
    const start = performance.now();
    const frame = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.floor(ease * 365);
      setDisplayDays(val);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        setDisplayDays(365);
        setShowOdometerDetails(true);
      }
    };
    requestAnimationFrame(frame);
  }, [isOpen]);

  // 3. Typewriter Effect with Audio Clicks
  useEffect(() => {
    if (!isOpen || !showOdometerDetails) return;
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setDisplayText(LETTER_TEXT.slice(0, idx));
      if (idx % 3 === 0) {
        audioEngine.playTypewriterClick();
      }
      if (idx >= LETTER_TEXT.length) {
        clearInterval(timer);
        setIsTypewriterDone(true);
      }
    }, 28);
    return () => clearInterval(timer);
  }, [isOpen, showOdometerDetails]);

  // 4. HTML5 Canvas Ambient Motes & Fireworks Sky Engine
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
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

    // Initial ambient starlight motes
    const ambientColors = ["#f43f5e", "#fb7185", "#fde047", "#f472b6", "#e0e7ff", "#fda4af"];
    particlesRef.current = [];
    for (let i = 0; i < 48; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.55,
        size: 1.8 + Math.random() * 2.8,
        alpha: 0.15 + Math.random() * 0.55,
        color: ambientColors[Math.floor(Math.random() * ambientColors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 1.5,
        decay: 0,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.decay > 0) {
          p.alpha -= p.decay;
          p.vy += 0.085; // Gravity for firework sparks
          p.vx *= 0.985; // Air resistance
        } else {
          // Ambient float loop
          if (p.y < -15) p.y = height + 15;
          if (p.x < -15) p.x = width + 15;
          if (p.x > width + 15) p.x = -15;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.decay > 0 ? 12 : 6;

        if (p.isHeart) {
          // Draw mini heart glyph
          ctx.beginPath();
          const s = p.size * 0.6;
          ctx.moveTo(0, s * 0.3);
          ctx.bezierCurveTo(-s, -s * 0.7, -s * 1.5, s * 0.6, 0, s * 1.8);
          ctx.bezierCurveTo(s * 1.5, s * 0.6, s, -s * 0.7, 0, s * 0.3);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Purge finished burst particles
      particlesRef.current = particlesRef.current.filter((p) => p.decay === 0 || p.alpha > 0);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
      particlesRef.current = [];
    };
  }, [isOpen]);

  // 5. Firework Spawn Helper (usable on button press AND on sky clicking!)
  const spawnFireworkAt = (cx: number, cy: number, count = 70) => {
    const burstColors = ["#fbbf24", "#f43f5e", "#fda4af", "#fde047", "#ffffff", "#c084fc", "#38bdf8"];
    audioEngine.playBurstFanfare();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 9.5;
      const isHeart = Math.random() < 0.28;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.8,
        size: isHeart ? 3.5 + Math.random() * 3.5 : 2.5 + Math.random() * 3.5,
        alpha: 1,
        color: burstColors[Math.floor(Math.random() * burstColors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        decay: 0.012 + Math.random() * 0.016,
        isHeart,
      });
    }
  };

  const handleCelebrateButton = () => {
    setCelebrationCount((c) => c + 1);
    spawnFireworkAt(window.innerWidth / 2, window.innerHeight / 2, 85);
  };

  const handleCanvasSkyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only spawn if clicking outside the modal card
    if ((e.target as HTMLElement).id === "anniversary-sky-backdrop") {
      spawnFireworkAt(e.clientX, e.clientY, 45);
    }
  };

  // 6. 3D Mouse Gyro Parallax on Card
  const handleMouseMove = (e: React.MouseEvent) => {
    if (window.innerWidth < 768) return; // Desktop tilt only
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;

    // Max 10 deg tilt
    setCardTilt({
      rx: -dy * 10,
      ry: dx * 10,
      glareX: 50 + dx * 35,
      glareY: 50 + dy * 35,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      id="anniversary-sky-backdrop"
      onClick={handleCanvasSkyClick}
      onMouseMove={handleMouseMove}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, rgba(32, 14, 42, 0.85) 0%, rgba(15, 8, 22, 0.94) 50%, rgba(5, 5, 8, 0.98) 100%)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        animation: "anniversaryFadeIn 0.4s ease-out",
        userSelect: "none",
        cursor: "crosshair",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes anniversaryFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes anniversaryCardPop { from { transform: scale(0.92) translateY(12px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes anniversaryGlowPulse {
          0% { box-shadow: 0 0 35px rgba(244, 63, 94, 0.35), inset 0 0 25px rgba(244, 63, 94, 0.15); }
          50% { box-shadow: 0 0 65px rgba(244, 63, 94, 0.65), inset 0 0 35px rgba(244, 63, 94, 0.28); }
          100% { box-shadow: 0 0 35px rgba(244, 63, 94, 0.35), inset 0 0 25px rgba(244, 63, 94, 0.15); }
        }
        @keyframes anniversaryBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes laurelShine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* HTML5 Canvas Fireworks & Ambient Particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* 3D Glassmorphism Milestone Card */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "92%",
          maxWidth: "480px",
          padding: "36px 30px",
          background: `radial-gradient(circle at ${cardTilt.glareX}% ${cardTilt.glareY}%, rgba(255, 255, 255, 0.14) 0%, rgba(24, 18, 32, 0.86) 65%)`,
          borderRadius: "32px",
          border: "1px solid rgba(244, 63, 94, 0.45)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65)",
          animation: "anniversaryCardPop 0.45s cubic-bezier(0.16, 1, 0.3, 1), anniversaryGlowPulse 4s ease-in-out infinite",
          textAlign: "center",
          color: "#fff",
          transform: `perspective(1000px) rotateX(${cardTilt.rx}deg) rotateY(${cardTilt.ry}deg)`,
          transition: "transform 0.1s ease-out",
          boxSizing: "border-box",
          cursor: "default",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panic / Quick Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "50%",
            width: "34px",
            height: "34px",
            color: "rgba(255, 255, 255, 0.65)",
            cursor: "pointer",
            fontSize: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(244, 63, 94, 0.25)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
          }}
          title="Panic Close (Esc)"
        >
          ✕
        </button>

        {/* Top Glowing Laurel Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 14px",
            borderRadius: "999px",
            background: "rgba(251, 191, 36, 0.12)",
            border: "1px solid rgba(251, 191, 36, 0.35)",
            fontSize: "11px",
            fontWeight: 800,
            color: "#fbbf24",
            letterSpacing: "1.8px",
            marginBottom: "12px",
          }}
        >
          <span>✦</span>
          <span>ONE YEAR MILESTONE</span>
          <span>✦</span>
        </div>

        {/* Rolling Odometer Title */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 900,
            background: "linear-gradient(135deg, #ffffff 0%, #fda4af 40%, #f43f5e 80%, #fbbf24 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "3px",
            margin: "0 0 4px 0",
            fontFamily: "'Josefin Sans', sans-serif",
            textShadow: "0 0 35px rgba(244, 63, 94, 0.4)",
          }}
        >
          {displayDays} DAYS
        </div>

        <div style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255, 255, 255, 0.72)", marginBottom: "16px" }}>
          October 13, 2025 — October 13, 2026
        </div>

        {/* Deep Breakdown Odometer Cards */}
        {showOdometerDetails && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              marginBottom: "20px",
              animation: "anniversaryFadeIn 0.5s ease-out",
            }}
          >
            <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: "12px", padding: "8px 6px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#fda4af" }}>8,760</div>
              <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.55)", letterSpacing: "0.5px" }}>HOURS</div>
            </div>
            <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: "12px", padding: "8px 6px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#fbbf24" }}>525,600</div>
              <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.55)", letterSpacing: "0.5px" }}>MINUTES</div>
            </div>
            <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: "12px", padding: "8px 6px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#f43f5e" }}>31.5M</div>
              <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.55)", letterSpacing: "0.5px" }}>SECONDS</div>
            </div>
          </div>
        )}

        {/* Real-time Typewriter Letter Box */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.45)",
            borderRadius: "18px",
            padding: "18px 20px",
            minHeight: "92px",
            fontSize: "14px",
            lineHeight: "1.65",
            color: "rgba(255, 255, 255, 0.94)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: "22px",
            textAlign: "center",
            boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.3)",
          }}
        >
          {displayText}
          {!isTypewriterDone && (
            <span style={{ color: "#f43f5e", fontWeight: "bold", animation: "anniversaryBlink 0.75s infinite" }}>|</span>
          )}
        </div>

        {/* Celebration Ignite Button */}
        <button
          onClick={handleCelebrateButton}
          style={{
            background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #fbbf24 100%)",
            border: "none",
            borderRadius: "999px",
            padding: "13px 32px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 800,
            letterSpacing: "0.5px",
            cursor: "pointer",
            boxShadow: "0 10px 28px rgba(244, 63, 94, 0.5)",
            transition: "transform 0.15s ease, filter 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <span>✨</span>
          <span>{celebrationCount > 0 ? `Sparked (${celebrationCount}) 💕` : "Celebrate Our Story"}</span>
          <span>✨</span>
        </button>

        {/* Subtle Bottom Sky Hint */}
        <div style={{ marginTop: "14px", fontSize: "11px", color: "rgba(255, 255, 255, 0.45)" }}>
          Tap anywhere in the sky to launch fireworks 🎆
        </div>
      </div>
    </div>
  );
}
