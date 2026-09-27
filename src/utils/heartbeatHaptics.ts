import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Triggers a realistic dual-cycle "lub-dub" human heartbeat haptic vibration
 * Pattern:
 *   Beat 1: Medium (lub, 70ms) -> pause 90ms -> Heavy (dub, 150ms)
 *   Pause: 450ms
 *   Beat 2: Medium (lub, 70ms) -> pause 90ms -> Heavy (dub, 150ms)
 */
export async function triggerHeartbeatHaptic(): Promise<void> {
  // Web vibration API
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([70, 90, 150, 450, 70, 90, 150]);
    } catch {}
  }

  // Native iOS / Android haptic engine
  try {
    // Beat 1: Lub
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Pause 90ms -> Dub
    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}

      // Pause 450ms -> Beat 2: Lub
      setTimeout(async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}

        // Pause 90ms -> Beat 2: Dub
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch {}
        }, 90);
      }, 450);
    }, 90);
  } catch {}
}
