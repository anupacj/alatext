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

export function isFeatureEnabled(
  featureKey: FeatureKey,
  userProfile: UserProfile | null | undefined,
  publicFeatures: string[] = []
): boolean {
  if (!userProfile) return false;
  if (userProfile.is_admin) return true;
  if (publicFeatures.includes(featureKey)) return true;
  if (Array.isArray(userProfile.awarded_features) && userProfile.awarded_features.includes(featureKey)) {
    return true;
  }
  return false;
}
