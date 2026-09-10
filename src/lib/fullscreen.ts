import { Platform } from "react-native";

export function isFullscreenActive(): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

export function tryEnterFullscreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    }
  } catch (e) {}
}

export function exitFullscreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    const doc = document as any;
    if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
  } catch (e) {}
}
