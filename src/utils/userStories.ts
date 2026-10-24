import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoryItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  mediaUrl: string;
  timestamp: number;
  caption?: string;
}

const STORIES_KEY = "@user_stories";

export async function getStoredStories(): Promise<StoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purge any stale demo/placeholder stories (Kaja, Imran, Stella)
      const valid = parsed.filter(
        (s: any) =>
          s &&
          s.id &&
          !["story_1", "story_2", "story_3"].includes(s.id) &&
          s.userName !== "Kaja" &&
          s.userName !== "Imran" &&
          s.userName !== "Stella"
      );
      if (valid.length !== parsed.length) {
        await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(valid));
      }
      return valid;
    }
    return [];
  } catch {
    return [];
  }
}

export async function addStory(item: StoryItem): Promise<void> {
  try {
    const current = await getStoredStories();
    const updated = [item, ...current];
    await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(updated));
  } catch {}
}
