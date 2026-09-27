import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Triggers a realistic 4-cycle "lub-dub" human heartbeat haptic vibration
 * Each cycle:
 *   Lub (70ms) -> pause 80ms -> Dub (140ms) -> rest 420ms
 * Plays 4 continuous cycles (~2.6s total), matching the thinking of you pulse!
 */
export async function triggerHeartbeatHaptic(): Promise<void> {
  // Web vibration API
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([
        70, 80, 140, // Cycle 1
        420,
        70, 80, 140, // Cycle 2
        420,
        70, 80, 140, // Cycle 3
        420,
        70, 80, 140, // Cycle 4
      ]);
    } catch {}
  }

  // Native iOS / Android haptic engine
  try {
    const playOneCycle = async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch {}
        }, 90);
      } catch {}
    };

    // Cycle 1
    playOneCycle();
    // Cycle 2
    setTimeout(playOneCycle, 680);
    // Cycle 3
    setTimeout(playOneCycle, 1360);
    // Cycle 4
    setTimeout(playOneCycle, 2040);
  } catch {}
}
