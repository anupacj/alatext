// Dynamic Image Color Extractor for Smart Chat Bubble Theming
import { Platform } from "react-native";

export interface ExtractedPalette {
  sent: string;
  received: string;
  accent: string;
  isLight: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (h % 360) / 360;
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return [r, g, b];
}

// Fallback palette generator from URL hash
function getFallbackPalette(url: string): ExtractedPalette {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const [sr, sg, sb] = hslToRgb(hue, 0.65, 0.42);
  const [rr, rg, rb] = hslToRgb(hue, 0.25, 0.16);

  return {
    sent: rgbToHex(sr, sg, sb),
    received: rgbToHex(rr, rg, rb),
    accent: rgbToHex(sr, sg, sb),
    isLight: false,
  };
}

export async function extractPaletteFromImageUrl(imageUrl: string): Promise<ExtractedPalette> {
  if (!imageUrl) {
    return { sent: "#d97706", received: "#1e293b", accent: "#d97706", isLight: false };
  }

  if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") {
    return getFallbackPalette(imageUrl);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const timer = setTimeout(() => {
        resolve(getFallbackPalette(imageUrl));
      }, 3500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement("canvas");
          const size = 48;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(getFallbackPalette(imageUrl));
            return;
          }

          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;

          // Color buckets by hue (12 buckets of 30 degrees each)
          const buckets: { count: number; totalS: number; totalL: number; r: number; g: number; b: number }[] = Array.from(
            { length: 12 },
            () => ({ count: 0, totalS: 0, totalL: 0, r: 0, g: 0, b: 0 })
          );

          let totalLuminance = 0;
          let validPixels = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue; // skip transparent

            const [h, s, l] = rgbToHsl(r, g, b);
            totalLuminance += l;
            validPixels++;

            // Skip almost completely greys for hue scoring, but keep for overall lightness
            if (s > 0.15 && l > 0.12 && l < 0.88) {
              const bucketIdx = Math.floor(h / 30) % 12;
              const bkt = buckets[bucketIdx];
              bkt.count++;
              bkt.totalS += s;
              bkt.totalL += l;
              bkt.r += r;
              bkt.g += g;
              bkt.b += b;
            }
          }

          const avgLightness = validPixels > 0 ? totalLuminance / validPixels : 0.5;

          // Find the most vibrant/frequent bucket
          let bestBucket = buckets[0];
          let maxScore = -1;

          for (let i = 0; i < 12; i++) {
            const bkt = buckets[i];
            if (bkt.count === 0) continue;
            const avgS = bkt.totalS / bkt.count;
            // score combines saturation and pixel volume
            const score = bkt.count * (1 + avgS * 2);
            if (score > maxScore) {
              maxScore = score;
              bestBucket = bkt;
            }
          }

          if (bestBucket.count > 0) {
            const avgR = bestBucket.r / bestBucket.count;
            const avgG = bestBucket.g / bestBucket.count;
            const avgB = bestBucket.b / bestBucket.count;
            const [domH, domS] = rgbToHsl(avgR, avgG, avgB);

            // Craft rich Sent color: rich tone, comfortable contrast
            // For warm tones (yellow/amber 30-65deg, like minion/sun):
            // deepen slightly so white text remains 100% legible!
            let sentLightness = 0.44;
            if (domH >= 35 && domH <= 65) {
              sentLightness = 0.38; // deep amber/gold for crisp white text
            }
            const [sr, sg, sb] = hslToRgb(domH, Math.min(0.85, Math.max(0.55, domS)), sentLightness);

            // Craft harmonious Received color:
            // Either complementary hue (+180 deg) or deep dark tinted slate
            const compH = (domH + 180) % 360;
            // In dark mode, received bubble should be dark, subtle, and tinted with complementary hue
            const [rr, rg, rb] = hslToRgb(compH, 0.28, 0.17);

            resolve({
              sent: rgbToHex(sr, sg, sb),
              received: rgbToHex(rr, rg, rb),
              accent: rgbToHex(sr, sg, sb),
              isLight: avgLightness > 0.65,
            });
          } else {
            resolve(getFallbackPalette(imageUrl));
          }
        } catch (e) {
          resolve(getFallbackPalette(imageUrl));
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(getFallbackPalette(imageUrl));
      };

      img.src = imageUrl;
    } catch (e) {
      resolve(getFallbackPalette(imageUrl));
    }
  });
}
