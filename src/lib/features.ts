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
  "custom_fonts",
  "wallpapers",
  "alapin_decoy",
  "custom_alerts",
];

export const BETA_FEATURES: FeatureKey[] = [
  "ghost_typing",
  "glass_keyboard",
];

export function isFeatureEnabled(
  featureKey: FeatureKey,
  userProfile: UserProfile | null | undefined,
  publicFeatures: string[] | null | undefined
): boolean {
  // 1. Beta features can only be enabled if individually awarded to the user profile in Overseer
  if (BETA_FEATURES.includes(featureKey)) {
    return !!(userProfile && Array.isArray(userProfile.awarded_features) && userProfile.awarded_features.includes(featureKey));
  }

  const activePublic = Array.isArray(publicFeatures) ? publicFeatures : DEFAULT_PUBLIC_FEATURES;
  
  // 2. If feature is globally released in public features (free / standard tier):
  if (activePublic.includes(featureKey)) return true;

  // 3. If feature is individually awarded to this user (exclusive / paid / beta tier):
  if (userProfile && Array.isArray(userProfile.awarded_features) && userProfile.awarded_features.includes(featureKey)) {
    return true;
  }

  return false;
}
