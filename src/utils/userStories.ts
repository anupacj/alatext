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

const INITIAL_STORIES: StoryItem[] = [
  {
    id: "story_1",
    userId: "kaja_1",
    userName: "Kaja",
    userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
    mediaUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&fit=crop",
    timestamp: Date.now() - 25 * 60 * 1000,
    caption: "Coffee stroll in Paris ☕️✨",
  },
  {
    id: "story_2",
    userId: "imran_2",
    userName: "Imran",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    mediaUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&fit=crop",
    timestamp: Date.now() - 75 * 60 * 1000,
    caption: "Night out with the crew 🌃",
  },
  {
    id: "story_3",
    userId: "stella_3",
    userName: "Stella",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&fit=crop",
    timestamp: Date.now() - 140 * 60 * 1000,
    caption: "Golden hour glow ✨",
  },
];

export async function getStoredStories(): Promise<StoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORIES_KEY);
    if (!raw) return INITIAL_STORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STORIES;
  } catch {
    return INITIAL_STORIES;
  }
}

export async function addStory(item: StoryItem): Promise<void> {
  try {
    const current = await getStoredStories();
    const updated = [item, ...current];
    await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(updated));
  } catch {}
}
