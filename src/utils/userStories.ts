import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { deleteFileFromR2ByUrl } from "../lib/r2";

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
export const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours strict lifetime

/**
 * Sweeps a list of stories, purges any older than 24h from Cloudflare R2,
 * and returns only the active unexpired stories.
 */
async function cleanAndPurgeExpiredStories(list: StoryItem[]): Promise<StoryItem[]> {
  const now = Date.now();
  const validStories: StoryItem[] = [];
  const expiredStories: StoryItem[] = [];

  for (const s of list) {
    if (!s || !s.id) continue;
    // Discard stale mock stories
    if (["story_1", "story_2", "story_3"].includes(s.id) || ["Kaja", "Imran", "Stella"].includes(s.userName)) {
      continue;
    }
    const age = now - (s.timestamp || 0);
    if (age >= STORY_TTL_MS) {
      expiredStories.push(s);
    } else {
      validStories.push(s);
    }
  }

  // Permanently delete expired media files from Cloudflare R2 to save bucket storage
  if (expiredStories.length > 0) {
    Promise.allSettled(
      expiredStories.map(async (st) => {
        if (st.mediaUrl && (st.mediaUrl.startsWith("http://") || st.mediaUrl.startsWith("https://"))) {
          try {
            await deleteFileFromR2ByUrl(st.mediaUrl);
            console.log(`[Stories] Purged expired 24h story asset from R2: ${st.mediaUrl}`);
          } catch (e) {
            console.warn("[Stories] Error deleting expired story from R2:", e);
          }
        }
      })
    ).catch(() => {});
  }

  return validStories;
}

/**
 * Retrieves all valid stories for the user and their partner,
 * automatically purging any stories older than 24 hours from both DB and R2.
 */
export async function getStoredStories(currentUserId?: string): Promise<StoryItem[]> {
  try {
    let localList: StoryItem[] = [];
    const raw = await AsyncStorage.getItem(STORIES_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localList = parsed;
        }
      } catch {}
    }

    // 1. Purge expired local stories from R2 and storage
    const cleanedLocal = await cleanAndPurgeExpiredStories(localList);
    if (cleanedLocal.length !== localList.length) {
      await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(cleanedLocal));
    }

    // 2. Fetch cloud stories from Supabase app_settings (to receive partner stories)
    let cloudStories: StoryItem[] = [];
    try {
      const { data: cloudRecords } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "user_story_%");

      if (cloudRecords && Array.isArray(cloudRecords)) {
        for (const record of cloudRecords) {
          if (record?.value) {
            const st: StoryItem = record.value;
            const age = Date.now() - (st.timestamp || 0);
            if (age >= STORY_TTL_MS) {
              // Cloud story is expired: delete from R2 and clean record from Supabase
              if (st.mediaUrl) {
                deleteFileFromR2ByUrl(st.mediaUrl).catch(() => {});
              }
              try {
                await supabase.from("app_settings").delete().eq("key", record.key);
              } catch {}
            } else {
              cloudStories.push(st);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Stories] Cloud fetch error:", err);
    }

    // Combine local and cloud stories, deduplicate by ID, sort newest first
    const storyMap = new Map<string, StoryItem>();
    [...cloudStories, ...cleanedLocal].forEach((s) => {
      if (s?.id && !storyMap.has(s.id)) {
        storyMap.set(s.id, s);
      }
    });

    const merged = Array.from(storyMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return merged;
  } catch {
    return [];
  }
}

/**
 * Adds a new story, saves to local storage, and publishes to Supabase app_settings
 * so the partner can see it in real-time.
 */
export async function addStory(item: StoryItem): Promise<void> {
  try {
    const current = await getStoredStories(item.userId);
    const updated = [item, ...current.filter((s) => s.id !== item.id)];
    await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(updated));

    // Upsert to Supabase app_settings for partner synchronization
    if (item.userId) {
      try {
        await supabase
          .from("app_settings")
          .upsert({
            key: `user_story_${item.userId}`,
            value: item,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn("[Stories] Cloud sync error:", err);
      }
    }
  } catch (e) {
    console.warn("[Stories] addStory error:", e);
  }
}

/**
 * Deletes a story explicitly (manual remove) and removes its media from Cloudflare R2.
 */
export async function deleteStory(storyId: string, userId?: string): Promise<void> {
  try {
    const current = await getStoredStories();
    const target = current.find((s) => s.id === storyId);
    if (target?.mediaUrl) {
      await deleteFileFromR2ByUrl(target.mediaUrl);
    }
    const filtered = current.filter((s) => s.id !== storyId);
    await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(filtered));

    if (userId) {
      await supabase.from("app_settings").delete().eq("key", `user_story_${userId}`);
    }
  } catch (e) {
    console.warn("[Stories] deleteStory error:", e);
  }
}
