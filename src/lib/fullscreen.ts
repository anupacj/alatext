import { Platform } from "react-native";

export function isFullscreenActive(): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

export function isMobileDevice(): boolean {
  if (Platform.OS !== "web") return true;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  const isNarrow = window.innerWidth < 768;
  return isMobileUA || (isTouch && isNarrow);
}

export function tryEnterFullscreen(onlyOnMobile = false) {
  if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") return;
  if (isFullscreenActive()) return;

  if (onlyOnMobile && !isMobileDevice()) {
    return;
  }

  try {
    const el = document.documentElement as any;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (rfs) {
      const p = rfs.call(el);
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  } catch (e) {}
}

export function exitFullscreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    const doc = document as any;
    const efs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
    if (efs) {
      const p = efs.call(doc);
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  } catch (e) {}
}
