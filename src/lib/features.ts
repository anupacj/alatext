export type FeatureKey =
  | "ghost_typing"
  | "custom_fonts"
  | "wallpapers"
  | "alapin_decoy"
  | "custom_alerts";

export interface UserProfile {
  id?: string;
  username?: string;
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
  if (userProfile.is_admin) return true;
  if (activePublic.includes(featureKey)) return true;
  if (Array.isArray(userProfile.awarded_features) && userProfile.awarded_features.includes(featureKey)) {
    return true;
  }
  return false;
}
