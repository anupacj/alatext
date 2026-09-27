import { Platform } from "react-native";

export function isFullscreenActive(): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

export function tryEnterFullscreen() {
  // Disabled auto-entering fullscreen on navigation to prevent mobile browser black-screen bug and back-button capture.
  return;
}

export function exitFullscreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    const doc = document as any;
    if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
  } catch (e) {}
}
