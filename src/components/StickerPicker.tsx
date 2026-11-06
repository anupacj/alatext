import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  TextInput,
  Platform,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from "react-native";
import {
  X,
  Plus,
  Trash2,
  Sticker,
  Smile,
  Clock,
  Search,
  Heart,
  User,
  Sparkles,
  Coffee,
  Trophy,
  Car,
  Hash,
  Star,
  Send,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { uploadBlobToR2, getThumbnailUrl } from "../lib/r2";
import pako from "pako";
import { LottieSticker } from "./LottieSticker";
import { EMOJI_DATABASE, EmojiItem } from "./CustomEmojiPicker";
import { useTheme } from "../context/ThemeContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface StickerUsageItem {
  id: string;
  file_url: string;
  count: number;
  lastUsed: number;
}

export async function recordStickerUsage(url: string) {
  try {
    const raw = await AsyncStorage.getItem("@frequent_stickers");
    let map: Record<string, { count: number; lastUsed: number }> = raw ? JSON.parse(raw) : {};
    if (!map[url]) {
      map[url] = { count: 1, lastUsed: Date.now() };
    } else {
      map[url].count = (map[url].count || 0) + 1;
      map[url].lastUsed = Date.now();
    }
    await AsyncStorage.setItem("@frequent_stickers", JSON.stringify(map));
  } catch (e) {}
}

export async function getTopRecentStickers(limit: number = 20): Promise<StickerUsageItem[]> {
  try {
    const raw = await AsyncStorage.getItem("@frequent_stickers");
    if (!raw) return [];
    const map: Record<string, { count: number; lastUsed: number }> = JSON.parse(raw);
    const items: StickerUsageItem[] = Object.entries(map).map(([url, data]) => ({
      id: `recent_${url}`,
      file_url: url,
      count: data?.count || 1,
      lastUsed: data?.lastUsed || 0,
    }));

    // Frequency first (count descending), then recency (lastUsed descending)
    items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastUsed - a.lastUsed;
    });

    return items.slice(0, limit);
  } catch (e) {
    return [];
  }
}

export async function getFavoriteStickers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem("@favorite_stickers");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export async function toggleFavoriteSticker(url: string): Promise<boolean> {
  try {
    const current = await getFavoriteStickers();
    let updated: string[];
    const isFav = current.includes(url);
    if (isFav) {
      updated = current.filter((u) => u !== url);
    } else {
      updated = [url, ...current];
    }
    await AsyncStorage.setItem("@favorite_stickers", JSON.stringify(updated));
    return !isFav;
  } catch (e) {
    return false;
  }
}

const EMOJI_CATEGORIES = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "smileys", label: "Smileys", icon: Smile },
  { id: "hearts", label: "Hearts", icon: Heart },
  { id: "people", label: "People", icon: User },
  { id: "nature", label: "Nature", icon: Sparkles },
  { id: "food", label: "Food", icon: Coffee },
  { id: "activities", label: "Activity", icon: Trophy },
  { id: "travel", label: "Travel", icon: Car },
  { id: "symbols", label: "Symbols", icon: Hash },
];

export interface StickerPickerProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  onSelectSticker: (url: string) => void;
  onSelectEmoji?: (emoji: string) => void;
  initialMode?: "stickers" | "emojis";
}

export default function StickerPicker({
  visible,
  onClose,
  chatId,
  userId,
  onSelectSticker,
  onSelectEmoji,
  initialMode = "stickers",
}: StickerPickerProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && windowWidth >= 768;

  // Active Picker Mode: default is ALWAYS "stickers"
  const [activeMode, setActiveMode] = useState<"stickers" | "emojis">(initialMode);

  // Sticker State
  const [packs, setPacks] = useState<any[]>([]);
  const [recentStickers, setRecentStickers] = useState<StickerUsageItem[]>([]);
  const [favoriteStickers, setFavoriteStickers] = useState<string[]>([]);
  const [previewStickerUrl, setPreviewStickerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<any[]>([]);

  // Emoji State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeEmojiCategory, setActiveEmojiCategory] = useState("smileys");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [packNameInput, setPackNameInput] = useState("");
  const [botToken, setBotToken] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [importProgress, setImportProgress] = useState("");
  const [importingState, setImportingState] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveMode(initialMode || "stickers");
      setIsImporting(false);
      setImportProgress("");
      setImportingState(false);
      loadRecentStickers();
      loadFavoriteStickers();
      loadRecentEmojis();
      fetchPacks();
    }
  }, [visible, initialMode]);

  useEffect(() => {
    if (!selectedPackId || isImporting) return;
    if (selectedPackId === "favorites") {
      getFavoriteStickers().then((favs) => {
        setFavoriteStickers(favs);
        setStickers(favs.map((url, idx) => ({ id: `fav-${idx}`, file_url: url })));
      });
    } else if (selectedPackId === "recent") {
      getTopRecentStickers(20).then((items) => {
        setStickers(items);
        setRecentStickers(items);
      });
    } else {
      fetchStickers(selectedPackId);
    }
  }, [selectedPackId, isImporting]);

  const loadFavoriteStickers = async () => {
    const favs = await getFavoriteStickers();
    setFavoriteStickers(favs);
  };

  const handleToggleFavorite = async (url: string) => {
    await toggleFavoriteSticker(url);
    const updated = await getFavoriteStickers();
    setFavoriteStickers(updated);
    if (selectedPackId === "favorites") {
      setStickers(updated.map((u, idx) => ({ id: `fav-${idx}`, file_url: u })));
    }
  };

  const loadRecentStickers = async () => {
    const top = await getTopRecentStickers(20);
    setRecentStickers(top);
    if (top.length > 0 && (!selectedPackId || selectedPackId === "recent")) {
      setSelectedPackId("recent");
      setStickers(top);
    }
  };

  const loadRecentEmojis = async () => {
    try {
      const stored = await AsyncStorage.getItem("@recent_emojis");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentEmojis(parsed);
          setActiveEmojiCategory("recent");
        }
      }
    } catch (e) {}
  };

  const handleSelectEmoji = useCallback((emoji: string) => {
    onSelectEmoji?.(emoji);
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 32);
      AsyncStorage.setItem("@recent_emojis", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [onSelectEmoji]);

  const fetchPacks = async () => {
    try {
      const cached = await AsyncStorage.getItem(`cached_sticker_packs_${chatId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setPacks(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    const { data } = await supabase
      .from("sticker_packs")
      .select("*")
      .or(`chat_id.is.null,chat_id.eq.${chatId}`)
      .order("created_at", { ascending: false });

    if (data) {
      setPacks(data);
      AsyncStorage.setItem(`cached_sticker_packs_${chatId}`, JSON.stringify(data)).catch(() => {});
      // If no recent stickers, select the first pack
      const top = await getTopRecentStickers(20);
      if (top.length === 0 && data.length > 0 && !selectedPackId) {
        setSelectedPackId(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchStickers = async (packId: string) => {
    try {
      const cached = await AsyncStorage.getItem(`cached_stickers_${packId}`);
      if (cached) {
        setStickers(JSON.parse(cached));
      }
    } catch (e) {}

    const { data } = await supabase
      .from("stickers")
      .select("*")
      .eq("pack_id", packId)
      .order("created_at", { ascending: true });

    if (data) {
      setStickers(data);
      AsyncStorage.setItem(`cached_stickers_${packId}`, JSON.stringify(data)).catch(() => {});
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Are you sure you want to delete this sticker pack?")) return;
    try {
      await supabase.from("stickers").delete().eq("pack_id", packId);
      await supabase.from("sticker_packs").delete().eq("id", packId);
      await AsyncStorage.removeItem(`cached_stickers_${packId}`);
      await AsyncStorage.removeItem(`cached_sticker_packs_${chatId}`);
      setSelectedPackId(recentStickers.length > 0 ? "recent" : null);
      setStickers(recentStickers.length > 0 ? recentStickers : []);
      fetchPacks();
    } catch (e: any) {
      alert("Error deleting pack: " + e.message);
    }
  };

  const handleImport = async () => {
    if (!packNameInput || !botToken) return alert("Fill all fields");
    setImportingState(true);

    let parsedName = packNameInput.trim();
    if (parsedName.includes("set=")) {
      parsedName = parsedName.split("set=")[1].split("&")[0];
    } else if (parsedName.includes("/addstickers/")) {
      parsedName = parsedName.split("/addstickers/")[1].split("/")[0].split("?")[0];
    }

    try {
      setImportProgress("Fetching pack info from Telegram...");
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${parsedName}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || "Failed to find pack");

      const stickerSet = data.result;
      const validStickers = stickerSet.stickers || [];
      if (validStickers.length === 0) {
        throw new Error("This sticker pack has no stickers.");
      }

      setImportProgress("Creating pack...");
      const { data: pack, error: packErr } = await supabase
        .from("sticker_packs")
        .insert({
          name: stickerSet.title || parsedName,
          chat_id: isPrivate ? chatId : null,
          creator_id: userId,
        })
        .select()
        .single();

      if (packErr) throw packErr;

      setImportProgress(`Importing 0 / ${validStickers.length} stickers...`);

      const fetchTelegramBlob = async (directUrl: string, isStaticImageOnly = false): Promise<Blob | null> => {
        if (Platform.OS === "web") {
          try {
            const isLocal =
              typeof window !== "undefined" &&
              (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
            const origin = isLocal ? "https://alatext.pages.dev" : "";
            const proxyUrl = `${origin}/api/telegram-file?url=${encodeURIComponent(directUrl)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const b = await res.blob();
              if (b && b.size > 0) return b;
            }
          } catch (e) {
            console.warn("Pages function proxy fetch failed:", e);
          }
        }

        try {
          const res = await fetch(directUrl);
          if (res.ok) {
            const b = await res.blob();
            if (b && b.size > 0) return b;
          }
        } catch (e) {
          console.warn("Direct fetch failed:", e);
        }

        if (isStaticImageOnly) {
          try {
            const rawUrl = directUrl.replace(/^https?:\/\//, "");
            const res = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}`);
            if (res.ok) {
              const b = await res.blob();
              if (b && b.size > 0) return b;
            }
          } catch (e) {
            console.warn("weserv proxy failed:", e);
          }
        }

        return null;
      };

      const CONCURRENCY = 6;
      let currentIndex = 0;
      let completedCount = 0;
      let lastProcessError: string | null = null;
      const uploadedRecords: { pack_id: string; file_url: string; emoji: string }[] = [];

      const processSticker = async (s: any, idx: number) => {
        try {
          const fRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${s.file_id}`);
          const fData = await fRes.json();
          if (!fData.ok || !fData.result?.file_path) {
            lastProcessError = fData?.description || "Telegram getFile failed";
            return;
          }

          const filePath = fData.result.file_path;
          const isTgs = filePath.endsWith(".tgs") || s.is_animated;
          const isVideoFile = filePath.endsWith(".webm") || s.is_video;
          const directFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

          const blob = await fetchTelegramBlob(directFileUrl, !isTgs && !isVideoFile);
          if (!blob || blob.size === 0) {
            lastProcessError = `Could not download sticker asset (${filePath})`;
            return;
          }

          let uploadBlob: Blob;
          if (isTgs) {
            let decompressedStr = "";
            try {
              const text = await blob.text();
              JSON.parse(text);
              decompressedStr = text;
            } catch (notJson) {
              if (typeof DecompressionStream !== "undefined") {
                try {
                  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
                  const text = await new Response(stream).text();
                  JSON.parse(text);
                  decompressedStr = text;
                } catch (e) {
                  console.warn("DecompressionStream error", e);
                }
              }
              if (!decompressedStr) {
                try {
                  const ungzipFn = (pako as any).ungzip || (pako as any).default?.ungzip;
                  if (typeof ungzipFn === "function") {
                    const arrayBuffer = await blob.arrayBuffer();
                    const decompressedBytes = ungzipFn(new Uint8Array(arrayBuffer));
                    const text = new TextDecoder().decode(decompressedBytes);
                    JSON.parse(text);
                    decompressedStr = text;
                  }
                } catch (e) {
                  console.warn("pako fallback error", e);
                }
              }
            }

            if (!decompressedStr) {
              throw new Error("Unable to unpack sticker to valid Lottie JSON");
            }

            uploadBlob = new Blob([decompressedStr], { type: "application/json" });
          } else if (isVideoFile) {
            uploadBlob = new Blob([await blob.arrayBuffer()], { type: "video/webm" });
          } else {
            uploadBlob = new Blob([await blob.arrayBuffer()], { type: "image/webp" });
          }

          const uploadedUrl = await uploadBlobToR2(`stickers/${pack.id}/${s.file_id}`, uploadBlob);
          uploadedRecords.push({
            pack_id: pack.id,
            file_url: uploadedUrl,
            emoji: s.emoji || "",
          });
        } catch (err: any) {
          lastProcessError = err?.message || String(err);
          console.error("Error importing sticker index", idx, err);
        } finally {
          completedCount++;
          setImportProgress(`Importing ${completedCount} / ${validStickers.length} stickers...`);
        }
      };

      const worker = async () => {
        while (currentIndex < validStickers.length) {
          const idx = currentIndex++;
          await processSticker(validStickers[idx], idx);
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, validStickers.length) }, () => worker());
      await Promise.all(workers);

      if (uploadedRecords.length === 0) {
        throw new Error(
          `Failed to download or upload stickers from this pack (${lastProcessError || "unknown error"}).`
        );
      }

      setImportProgress("Saving stickers to database...");
      for (let i = 0; i < uploadedRecords.length; i += 25) {
        const chunk = uploadedRecords.slice(i, i + 25);
        const { error: insertErr } = await supabase.from("stickers").insert(chunk);
        if (insertErr) {
          console.error("Batch insert error:", insertErr);
        }
      }

      let coverUrl = uploadedRecords[0]?.file_url || null;
      const thumbFileId =
        stickerSet.thumbnail?.file_id || validStickers[0]?.thumbnail?.file_id || validStickers[0]?.thumb?.file_id;
      if (thumbFileId) {
        try {
          const tRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${thumbFileId}`);
          const tData = await tRes.json();
          if (tData.ok && tData.result?.file_path) {
            const tUrl = `https://api.telegram.org/file/bot${botToken}/${tData.result.file_path}`;
            const tBlob = await fetchTelegramBlob(tUrl, true);
            if (tBlob) {
              coverUrl = await uploadBlobToR2(`stickers/${pack.id}/cover`, tBlob);
            }
          }
        } catch (e) {
          console.warn("Could not fetch thumbnail cover", e);
        }
      }

      if (coverUrl) {
        await supabase.from("sticker_packs").update({ cover_url: coverUrl }).eq("id", pack.id);
      }

      alert(`Import complete! Added ${uploadedRecords.length} stickers.`);
      setPackNameInput("");
      setIsImporting(false);
      fetchPacks();
      setSelectedPackId(pack.id);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setImportingState(false);
    }
  };

  // Filtered Emojis
  const filteredEmojis = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return EMOJI_DATABASE.filter(
        (item) => item.name.toLowerCase().includes(q) || item.emoji.includes(q)
      );
    }
    if (activeEmojiCategory === "recent") {
      return recentEmojis.map((emoji) => {
        const found = EMOJI_DATABASE.find((item) => item.emoji === emoji);
        return found || { emoji, name: "recent emoji", category: "recent" };
      });
    }
    return EMOJI_DATABASE.filter((item) => item.category === activeEmojiCategory);
  }, [searchQuery, activeEmojiCategory, recentEmojis]);

  const bg = isAmoled ? "#101014" : theme.surface || "#2b2d31";
  const headerBg = isAmoled ? "#0a0a0d" : "#1e1f22";
  const borderCol = isAmoled ? "#242428" : "rgba(255, 255, 255, 0.08)";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.container,
            { backgroundColor: bg, borderColor: borderCol },
            isWeb && {
              width: "100%",
              maxWidth: 440,
              height: isDesktop ? Math.min(windowHeight * 0.65, 480) : Math.min(windowHeight * 0.62, 450),
              borderRadius: 20,
              borderWidth: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.45,
              shadowRadius: 20,
              elevation: 15,
            } as any,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderCol }]}>
            <View style={styles.headerLeft}>
              {/* Sleek Segmented Switcher Pill: Default is Stickers */}
              <View style={styles.modeSwitcherPill}>
                <TouchableOpacity
                  style={[styles.modeTab, activeMode === "stickers" && styles.modeTabActive]}
                  onPress={() => setActiveMode("stickers")}
                  activeOpacity={0.8}
                >
                  <Sticker size={13} color={activeMode === "stickers" ? "#ffffff" : "#949ba4"} />
                  <Text style={[styles.modeTabText, activeMode === "stickers" && styles.modeTabTextActive]}>
                    Stickers
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeTab, activeMode === "emojis" && styles.modeTabActive]}
                  onPress={() => setActiveMode("emojis")}
                  activeOpacity={0.8}
                >
                  <Smile size={13} color={activeMode === "emojis" ? "#ffffff" : "#949ba4"} />
                  <Text style={[styles.modeTabText, activeMode === "emojis" && styles.modeTabTextActive]}>
                    Emojis
                  </Text>
                </TouchableOpacity>
              </View>

              {activeMode === "stickers" && selectedPackId === "recent" && (
                <Text style={styles.topRecentBadge}>• Top & Recent</Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {activeMode === "stickers" && !isImporting && selectedPackId && selectedPackId !== "recent" && (
                <TouchableOpacity
                  onPress={() => handleDeletePack(selectedPackId)}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: "rgba(237, 66, 69, 0.15)" },
                    isWeb && ({ cursor: "pointer" } as any),
                  ]}
                  accessibilityLabel="Delete sticker pack"
                >
                  <Trash2 size={16} color="#ed4245" />
                </TouchableOpacity>
              )}
              {activeMode === "stickers" && !isImporting && (
                <TouchableOpacity
                  onPress={() => setIsImporting(true)}
                  style={[styles.iconBtn, isWeb && ({ cursor: "pointer" } as any)]}
                  accessibilityLabel="Import Telegram Sticker Pack"
                >
                  <Plus size={18} color="#f2f3f5" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => (isImporting ? setIsImporting(false) : onClose())}
                style={[styles.iconBtn, isWeb && ({ cursor: "pointer" } as any)]}
                accessibilityLabel="Close picker"
              >
                <X size={18} color="#b5bac1" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ========================================================= */}
          {/* VIEW A: STICKERS MODE                                     */}
          {/* ========================================================= */}
          {activeMode === "stickers" ? (
            isImporting ? (
              <View style={{ padding: 16, flex: 1 }}>
                <Text style={styles.label}>Telegram Bot Token</Text>
                <TextInput
                  style={styles.input}
                  value={botToken}
                  onChangeText={setBotToken}
                  placeholder="123456:ABC-DEF..."
                  placeholderTextColor="#5c5e66"
                  editable={!importingState}
                />
                <Text style={styles.hint}>Get this from @BotFather on Telegram. You can reuse the same token.</Text>

                <Text style={styles.label}>Sticker Pack Link or Name</Text>
                <TextInput
                  style={styles.input}
                  value={packNameInput}
                  onChangeText={setPackNameInput}
                  placeholder="https://t.me/addstickers/Animals"
                  placeholderTextColor="#5c5e66"
                  editable={!importingState}
                />

                <View style={styles.toggleRow}>
                  <Text style={{ color: "#dbdee1", fontSize: 14 }}>Private to this chat?</Text>
                  <TouchableOpacity
                    style={[styles.toggle, isPrivate && styles.toggleOn]}
                    onPress={() => !importingState && setIsPrivate(!isPrivate)}
                  >
                    <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>

                {importingState ? (
                  <View style={{ alignItems: "center", marginTop: 32 }}>
                    <ActivityIndicator color="#5865F2" size="large" />
                    <Text style={{ color: "#dbdee1", marginTop: 12 }}>{importProgress}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
                    <Text style={styles.importBtnText}>Import Pack</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#5865F2" />
            ) : packs.length === 0 && recentStickers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No sticker packs yet.</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setIsImporting(true)}>
                  <Text style={styles.addBtnText}>Import a Telegram Pack</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <FlatList
                  key={isWeb ? "web-stickers-5" : "mobile-stickers-4"}
                  data={stickers}
                  keyExtractor={(s) => s.id}
                  numColumns={isWeb ? 5 : 4}
                  contentContainerStyle={{ padding: 12, gap: 10 }}
                  columnWrapperStyle={{ gap: 10 }}
                  ListHeaderComponent={
                    favoriteStickers.length > 0 && selectedPackId !== "favorites" ? (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingHorizontal: 2 }}>
                          <Star size={13} color="#f59e0b" fill="#f59e0b" />
                          <Text style={{ color: "#dbdee1", fontSize: 12, fontWeight: "700", fontFamily: "Josefin Sans", letterSpacing: 0.3 }}>
                            FAVORITES
                          </Text>
                          <Text style={{ color: "#949ba4", fontSize: 11, fontFamily: "Josefin Sans" }}>
                            ({favoriteStickers.length})
                          </Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                          {favoriteStickers.map((favUrl, idx) => (
                            <TouchableOpacity
                              key={`pinned-fav-${idx}`}
                              style={[
                                styles.stickerWrapper,
                                { width: 62, height: 62, minHeight: 62, maxHeight: 62, padding: 4 },
                                isWeb && ({ cursor: "pointer" } as any),
                              ]}
                              onPress={() => {
                                recordStickerUsage(favUrl);
                                onSelectSticker(favUrl);
                                onClose();
                              }}
                              onLongPress={() => setPreviewStickerUrl(favUrl)}
                              delayLongPress={280}
                              {...(isWeb ? ({ onContextMenu: (e: any) => { e.preventDefault(); setPreviewStickerUrl(favUrl); } } as any) : {})}
                            >
                              {favUrl.includes(".json") && isWeb ? (
                                <LottieSticker url={favUrl} size={54} />
                              ) : favUrl.includes(".webm") && isWeb ? (
                                <video src={favUrl} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", borderRadius: 4 }} />
                              ) : (
                                <Image source={{ uri: getThumbnailUrl(favUrl, 120, 120, 80) }} style={styles.stickerImg} resizeMode="contain" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <View style={{ height: 1, backgroundColor: borderCol, marginTop: 10 }} />
                      </View>
                    ) : null
                  }
                  ListEmptyComponent={
                    <View style={{ padding: 32, alignItems: "center" }}>
                      <Text style={{ color: "#949ba4", fontSize: 13, fontFamily: "Josefin Sans", textAlign: "center" }}>
                        {selectedPackId === "favorites"
                          ? "No favorite stickers yet.\nLong-press any sticker to preview & favorite it!"
                          : selectedPackId === "recent"
                          ? "No frequently used stickers yet. Send stickers to see them here!"
                          : "No stickers in this pack."}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isLottie = typeof item.file_url === "string" && item.file_url.includes(".json");
                    const isVideo = typeof item.file_url === "string" && item.file_url.includes(".webm");
                    return (
                      <TouchableOpacity
                        style={[
                          styles.stickerWrapper,
                          isWeb && { maxWidth: "18.2%", minHeight: 64, maxHeight: 80 },
                          isWeb && ({ cursor: "pointer" } as any),
                        ]}
                        onPress={() => {
                          recordStickerUsage(item.file_url);
                          onSelectSticker(item.file_url);
                          onClose();
                        }}
                        onLongPress={() => setPreviewStickerUrl(item.file_url)}
                        delayLongPress={280}
                        {...(isWeb ? ({ onContextMenu: (e: any) => { e.preventDefault(); setPreviewStickerUrl(item.file_url); } } as any) : {})}
                        activeOpacity={0.7}
                      >
                        {isLottie && isWeb ? (
                          <LottieSticker url={item.file_url} size={64} />
                        ) : isVideo && isWeb ? (
                          <video
                            src={item.file_url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              pointerEvents: "none",
                              borderRadius: 6,
                              background: "transparent",
                            }}
                          />
                        ) : (
                          <Image
                            source={{ uri: getThumbnailUrl(item.file_url, 160, 160, 80) }}
                            style={styles.stickerImg}
                            resizeMode="contain"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Pack Tabs Bar (Favorites, Recent & Top first, then packs) */}
                <View style={[styles.tabsContainer, { borderTopColor: borderCol }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
                  >
                    {/* Favorites Tab */}
                    {favoriteStickers.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.tabBtn,
                          selectedPackId === "favorites" && styles.tabBtnActive,
                          isWeb && ({ cursor: "pointer" } as any),
                        ]}
                        onPress={() => {
                          setSelectedPackId("favorites");
                        }}
                        accessibilityLabel="Favorite Stickers"
                      >
                        <Star size={18} color={selectedPackId === "favorites" ? "#f59e0b" : "#949ba4"} fill={selectedPackId === "favorites" ? "#f59e0b" : "transparent"} />
                      </TouchableOpacity>
                    )}

                    {/* Recent & Frequently Used Tab */}
                    {recentStickers.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.tabBtn,
                          selectedPackId === "recent" && styles.tabBtnActive,
                          isWeb && ({ cursor: "pointer" } as any),
                        ]}
                        onPress={() => {
                          setSelectedPackId("recent");
                          setStickers(recentStickers);
                        }}
                        accessibilityLabel="Top and Frequently Used Stickers"
                      >
                        <Clock size={19} color={selectedPackId === "recent" ? "#ffffff" : "#949ba4"} />
                      </TouchableOpacity>
                    )}

                    {packs.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.tabBtn,
                          selectedPackId === item.id && styles.tabBtnActive,
                          isWeb && ({ cursor: "pointer" } as any),
                        ]}
                        onPress={() => setSelectedPackId(item.id)}
                      >
                        {item.cover_url ? (
                          item.cover_url.includes(".json") && isWeb ? (
                            <LottieSticker url={item.cover_url} size={28} />
                          ) : item.cover_url.includes(".webm") && isWeb ? (
                            <video
                              src={item.cover_url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              style={{
                                width: 28,
                                height: 28,
                                objectFit: "contain",
                                borderRadius: 6,
                                pointerEvents: "none",
                                background: "transparent",
                              }}
                            />
                          ) : (
                            <Image source={{ uri: getThumbnailUrl(item.cover_url, 80, 80, 80) }} style={styles.tabIcon} />
                          )
                        ) : (
                          <Text style={{ color: "#fff", fontSize: 16 }}>📦</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )
          ) : (
            /* ========================================================= */
            /* VIEW B: EMOJIS MODE                                       */
            /* ========================================================= */
            <View style={{ flex: 1 }}>
              {/* Search Bar */}
              <View style={[styles.emojiSearchRow, { borderBottomColor: borderCol }]}>
                <View style={styles.emojiSearchWrapper}>
                  <Search size={16} color="#80848e" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.emojiSearchInput}
                    placeholder="Search emojis..."
                    placeholderTextColor="#80848e"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                      <X size={14} color="#80848e" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Category Tabs */}
              {!searchQuery && (
                <View style={[styles.emojiCategoryBar, { borderBottomColor: borderCol }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiCategoryScroll}
                  >
                    {EMOJI_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isActive = activeEmojiCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.emojiCatTab,
                            isActive && styles.emojiCatTabActive,
                          ]}
                          onPress={() => setActiveEmojiCategory(cat.id)}
                        >
                          <Icon size={15} color={isActive ? "#ffffff" : "#949ba4"} />
                          <Text
                            style={[
                              styles.emojiCatLabel,
                              { color: isActive ? "#ffffff" : "#949ba4" },
                              isActive && { fontWeight: "700" },
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Emojis Grid */}
              <FlatList
                data={filteredEmojis}
                keyExtractor={(item, index) => `${item.emoji}-${index}`}
                numColumns={8}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.emojiGrid}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={
                  <View style={{ padding: 32, alignItems: "center" }}>
                    <Text style={{ color: "#949ba4", fontSize: 13, fontFamily: "Josefin Sans" }}>
                      No emojis found for "{searchQuery}"
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.emojiCell}
                    activeOpacity={0.6}
                    onPress={() => handleSelectEmoji(item.emoji)}
                  >
                    <Text style={styles.emojiText}>{item.emoji}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* ========================================================= */}
          {/* ENLARGED STICKER PREVIEW & FAVORITING MODAL OVERLAY       */}
          {/* ========================================================= */}
          {previewStickerUrl && (
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.85)",
                justifyContent: "center",
                alignItems: "center",
                padding: 20,
                zIndex: 1000,
              }}
              onPress={() => setPreviewStickerUrl(null)}
            >
              <Pressable
                style={{
                  backgroundColor: isAmoled ? "#000000" : (theme.id === "light" ? "#ffffff" : "#1e1f22"),
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isAmoled ? "#2e2e2e" : (theme.id === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)"),
                  padding: 20,
                  alignItems: "center",
                  width: Math.min(320, windowWidth - 48),
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.5,
                  shadowRadius: 24,
                }}
                onPress={(e: any) => e?.stopPropagation?.()}
              >
                {/* Header with Title and Close */}
                <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ color: isAmoled ? "#ffffff" : (theme.id === "light" ? "#111827" : "#dbdee1"), fontSize: 13, fontWeight: "700", fontFamily: "Josefin Sans", letterSpacing: 0.5 }}>
                    STICKER PREVIEW
                  </Text>
                  <TouchableOpacity onPress={() => setPreviewStickerUrl(null)} style={{ padding: 4 }}>
                    <X size={18} color="#949ba4" />
                  </TouchableOpacity>
                </View>

                {/* Large Animated Preview */}
                <View style={{ width: 180, height: 180, justifyContent: "center", alignItems: "center", marginVertical: 8 }}>
                  {previewStickerUrl.includes(".json") && isWeb ? (
                    <LottieSticker url={previewStickerUrl} size={170} />
                  ) : previewStickerUrl.includes(".webm") && isWeb ? (
                    <video
                      src={previewStickerUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: "170px",
                        height: "170px",
                        objectFit: "contain",
                        borderRadius: "12px",
                      }}
                    />
                  ) : (
                    <Image
                      source={{ uri: getThumbnailUrl(previewStickerUrl, 320, 320, 90) }}
                      style={{ width: 170, height: 170 }}
                      resizeMode="contain"
                    />
                  )}
                </View>

                {/* Action Row: Favorite toggle & Send button */}
                <View style={{ width: "100%", flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 11,
                      borderRadius: 14,
                      backgroundColor: favoriteStickers.includes(previewStickerUrl)
                        ? "rgba(245, 158, 11, 0.16)"
                        : (isAmoled ? "#161616" : (theme.id === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)")),
                      borderWidth: 1,
                      borderColor: favoriteStickers.includes(previewStickerUrl)
                        ? "#f59e0b"
                        : (isAmoled ? "#2a2a2a" : (theme.id === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)")),
                    }}
                    onPress={() => handleToggleFavorite(previewStickerUrl)}
                  >
                    <Star
                      size={16}
                      color={favoriteStickers.includes(previewStickerUrl) ? "#f59e0b" : "#949ba4"}
                      fill={favoriteStickers.includes(previewStickerUrl) ? "#f59e0b" : "transparent"}
                    />
                    <Text
                      style={{
                        color: favoriteStickers.includes(previewStickerUrl) ? "#f59e0b" : (theme.id === "light" ? "#374151" : "#dbdee1"),
                        fontSize: 13,
                        fontWeight: "700",
                        fontFamily: "Josefin Sans",
                      }}
                    >
                      {favoriteStickers.includes(previewStickerUrl) ? "Favorited" : "Favorite"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1.2,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 11,
                      borderRadius: 14,
                      backgroundColor: theme.accent || "#5865F2",
                    }}
                    onPress={() => {
                      const url = previewStickerUrl;
                      setPreviewStickerUrl(null);
                      recordStickerUsage(url);
                      onSelectSticker(url);
                      onClose();
                    }}
                  >
                    <Send size={15} color="#ffffff" />
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700", fontFamily: "Josefin Sans" }}>
                      Send
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  overlayDesktop: {
    justifyContent: "center",
  },
  container: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.52,
    backgroundColor: "#2b2d31",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1f22",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeSwitcherPill: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 13,
  },
  modeTabActive: {
    backgroundColor: "#5865F2",
    shadowColor: "#5865F2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabText: {
    color: "#949ba4",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  modeTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  topRecentBadge: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },
  iconBtn: {
    padding: 6,
    backgroundColor: "#1e1f22",
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#949ba4",
    fontSize: 14,
    marginBottom: 14,
    fontFamily: "Josefin Sans",
  },
  addBtn: {
    backgroundColor: "#5865F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  stickerWrapper: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: "23%",
    backgroundColor: "#1e1f22",
    borderRadius: 10,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  stickerImg: {
    width: "100%",
    height: "100%",
  },
  tabsContainer: {
    backgroundColor: "#1e1f22",
    borderTopWidth: 1,
    borderTopColor: "#1e1f22",
  },
  tabBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2b2d31",
  },
  tabBtnActive: {
    backgroundColor: "#5865F2",
  },
  tabIcon: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },
  label: {
    color: "#dbdee1",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    fontFamily: "Josefin Sans",
  },
  input: {
    backgroundColor: "#1e1f22",
    color: "#f2f3f5",
    borderRadius: 8,
    padding: 11,
    marginTop: 6,
    fontFamily: "Josefin Sans",
  },
  hint: {
    color: "#949ba4",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "Josefin Sans",
  },
  importBtn: {
    backgroundColor: "#5865F2",
    marginTop: 20,
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
  },
  importBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    fontFamily: "Josefin Sans",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4e5058",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: "#5865F2",
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  toggleThumbOn: {
    transform: [{ translateX: 16 }],
  },
  // Emoji View Styles
  emojiSearchRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  emojiSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
  },
  emojiSearchInput: {
    flex: 1,
    color: "#f2f3f5",
    fontSize: 13,
    fontFamily: "Josefin Sans",
    paddingVertical: 2,
    outlineStyle: "none" as any,
  },
  emojiCategoryBar: {
    borderBottomWidth: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  emojiCategoryScroll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    alignItems: "center",
  },
  emojiCatTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  emojiCatTabActive: {
    backgroundColor: "#5865F2",
  },
  emojiCatLabel: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Josefin Sans",
  },
  emojiGrid: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  emojiCell: {
    flex: 1 / 8,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 3,
    borderRadius: 8,
  },
  emojiText: {
    fontSize: Platform.OS === "web" ? 26 : 24,
  },
});
