export type FeatureKey =
  | "ghost_typing"
  | "custom_fonts"
  | "wallpapers"
  | "alapin_decoy"
  | "custom_alerts"
  | "glass_keyboard";

export interface UserProfile {
  id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  is_admin?: boolean;
  is_banned?: boolean;
  awarded_features?: string[];
  created_at?: string;
  last_seen_at?: string;
}

export const DEFAULT_PUBLIC_FEATURES: FeatureKey[] = [
  "ghost_typing",
  "custom_fonts",
  "wallpapers",
  "alapin_decoy",
  "custom_alerts",
];

export function isFeatureEnabled(
  featureKey: FeatureKey,
  userProfile: UserProfile | null | undefined,
  publicFeatures: string[] | null | undefined
): boolean {
  const activePublic = Array.isArray(publicFeatures) ? publicFeatures : DEFAULT_PUBLIC_FEATURES;
  if (!userProfile) return activePublic.includes(featureKey);
  
  // 1. If feature is globally released in public features:
  if (activePublic.includes(featureKey)) return true;

  // 2. If feature is individually awarded to this user:
  if (Array.isArray(userProfile.awarded_features) && userProfile.awarded_features.includes(featureKey)) {
    return true;
  }

  // 3. Admins get core features by default, but beta features (like glass_keyboard)
  // must be explicitly awarded or enabled in Overseer so admins can test assignments!
  if (userProfile.is_admin) {
    if (featureKey === "glass_keyboard") {
      return false;
    }
    return true;
  }

  return false;
}
