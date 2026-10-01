import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList, Image, Dimensions, TextInput, Platform, useWindowDimensions } from "react-native";
import { X, Plus, Download, AlertCircle } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { uploadBlobToR2, getThumbnailUrl } from "../lib/r2";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StickerPickerProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  onSelectSticker: (url: string) => void;
}

export default function StickerPicker({ visible, onClose, chatId, userId, onSelectSticker }: StickerPickerProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && windowWidth >= 768;

  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<any[]>([]);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [packNameInput, setPackNameInput] = useState("");
  const [botToken, setBotToken] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [importProgress, setImportProgress] = useState("");
  const [importingState, setImportingState] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPacks();
      setIsImporting(false);
      setImportProgress("");
      setImportingState(false);
    }
  }, [visible]);

  useEffect(() => {
    if (selectedPackId && !isImporting) fetchStickers(selectedPackId);
  }, [selectedPackId, isImporting]);

  const fetchPacks = async () => {
    try {
      const cached = await AsyncStorage.getItem(`cached_sticker_packs_${chatId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setPacks(parsed);
          if (!selectedPackId) setSelectedPackId(parsed[0].id);
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
      if (data.length > 0 && !selectedPackId) setSelectedPackId(data[0].id);
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

    const { data } = await supabase.from("stickers").select("*").eq("pack_id", packId).order("created_at", { ascending: true });
    if (data) {
      setStickers(data);
      AsyncStorage.setItem(`cached_stickers_${packId}`, JSON.stringify(data)).catch(() => {});
    }
  };

  const handleImport = async () => {
    if (!packNameInput || !botToken) return alert("Fill all fields");
    setImportingState(true);
    
    let parsedName = packNameInput.trim();
    if (parsedName.includes('set=')) {
      parsedName = parsedName.split('set=')[1].split('&')[0];
    } else if (parsedName.includes('/addstickers/')) {
      parsedName = parsedName.split('/addstickers/')[1].split('/')[0].split('?')[0];
    }

    try {
      setImportProgress("Fetching pack info from Telegram...");
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${parsedName}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || "Failed to find pack");
      
      const stickerSet = data.result;
      // Allow static (WebP) and video (.webm) stickers; only exclude .tgs vector animations
      const validStickers = stickerSet.stickers.filter((s: any) => !s.is_animated);
      if (validStickers.length === 0) {
        throw new Error("Pack contains only .tgs vector animations (no static or video stickers).");
      }

      setImportProgress("Creating pack...");
      const { data: pack, error: packErr } = await supabase.from("sticker_packs").insert({
        name: stickerSet.title || parsedName,
        chat_id: isPrivate ? chatId : null,
        creator_id: userId,
      }).select().single();

      if (packErr) throw packErr;

      setImportProgress(`Importing 0 / ${validStickers.length} stickers...`);
      
      // Parallel concurrent processing
      const CONCURRENCY = 6;
      let currentIndex = 0;
      let completedCount = 0;
      const uploadedRecords: { pack_id: string; file_url: string; emoji: string }[] = [];

      const processSticker = async (s: any, idx: number) => {
        try {
          const fRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${s.file_id}`);
          const fData = await fRes.json();
          if (!fData.ok || !fData.result?.file_path) return;

          const filePath = fData.result.file_path;
          const isVideoFile = filePath.endsWith(".webm") || s.is_video;
          const directFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

          let blob: Blob | null = null;
          try {
            const resp = await fetch(directFileUrl);
            if (resp.ok) {
              blob = await resp.blob();
            }
          } catch (e) {
            console.warn("Direct fetch error", e);
          }

          if (!blob || blob.size === 0) {
            if (isVideoFile) {
              return;
            }
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(`api.telegram.org/file/bot${botToken}/${filePath}`)}`;
            const imgRes = await fetch(proxyUrl);
            blob = await imgRes.blob();
          }

          if (isVideoFile) {
            if (!blob.type || !blob.type.includes("webm")) {
              blob = new Blob([await blob.arrayBuffer()], { type: "video/webm" });
            }
          } else {
            if (!blob.type || blob.type === "application/octet-stream") {
              blob = new Blob([await blob.arrayBuffer()], { type: "image/webp" });
            }
          }

          const uploadedUrl = await uploadBlobToR2(`stickers/${pack.id}/${s.file_id}`, blob);
          uploadedRecords.push({
            pack_id: pack.id,
            file_url: uploadedUrl,
            emoji: s.emoji || "",
          });
        } catch (err) {
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
        throw new Error("Failed to download or upload any stickers from this pack.");
      }

      setImportProgress("Saving stickers to database...");
      for (let i = 0; i < uploadedRecords.length; i += 25) {
        const chunk = uploadedRecords.slice(i, i + 25);
        const { error: insertErr } = await supabase.from("stickers").insert(chunk);
        if (insertErr) {
          console.error("Batch insert error:", insertErr);
        }
      }

      const coverUrl = uploadedRecords[0]?.file_url || null;
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[
          styles.container,
          isWeb && {
            width: "100%",
            maxWidth: 440,
            height: isDesktop ? Math.min(windowHeight * 0.62, 460) : Math.min(windowHeight * 0.6, 440),
            borderRadius: 16,
            marginBottom: isDesktop ? 0 : 0,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45,
            shadowRadius: 20,
            elevation: 15,
          } as any
        ]}>
          
          <View style={styles.header}>
            <Text style={styles.title}>{isImporting ? "Import Sticker Pack" : "Stickers"}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {!isImporting && (
                <TouchableOpacity onPress={() => setIsImporting(true)} style={[styles.iconBtn, isWeb && ({ cursor: "pointer" } as any)]}>
                  <Plus size={20} color="#f2f3f5" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => isImporting ? setIsImporting(false) : onClose()} style={[styles.iconBtn, isWeb && ({ cursor: "pointer" } as any)]}>
                <X size={20} color="#b5bac1" />
              </TouchableOpacity>
            </View>
          </View>

          {isImporting ? (
            <View style={{ padding: 16, flex: 1 }}>
              <Text style={styles.label}>Telegram Bot Token</Text>
              <TextInput style={styles.input} value={botToken} onChangeText={setBotToken} placeholder="123456:ABC-DEF..." placeholderTextColor="#5c5e66" editable={!importingState} />
              <Text style={styles.hint}>Get this from @BotFather on Telegram. You can reuse the same token.</Text>

              <Text style={styles.label}>Sticker Pack Link or Name</Text>
              <TextInput style={styles.input} value={packNameInput} onChangeText={setPackNameInput} placeholder="https://t.me/addstickers/Animals" placeholderTextColor="#5c5e66" editable={!importingState} />
              
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
                <View style={{ alignItems: 'center', marginTop: 32 }}>
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
          ) : packs.length === 0 ? (
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
                keyExtractor={s => s.id}
                numColumns={isWeb ? 5 : 4}
                contentContainerStyle={{ padding: 12, gap: 10 }}
                columnWrapperStyle={{ gap: 10 }}
                renderItem={({ item }) => {
                  const isVideo = typeof item.file_url === "string" && item.file_url.includes(".webm");
                  return (
                    <TouchableOpacity 
                      style={[
                        styles.stickerWrapper,
                        isWeb && { maxWidth: "18.2%", minHeight: 64, maxHeight: 80 },
                        isWeb && ({ cursor: "pointer" } as any)
                      ]} 
                      onPress={() => { onSelectSticker(item.file_url); onClose(); }}
                      activeOpacity={0.7}
                    >
                      {isVideo && isWeb ? (
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
                        <Image source={{ uri: getThumbnailUrl(item.file_url, 160, 160, 80) }} style={styles.stickerImg} resizeMode="contain" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              
              {/* Pack Tabs */}
              <View style={styles.tabsContainer}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={packs}
                  keyExtractor={p => p.id}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[
                        styles.tabBtn, 
                        selectedPackId === item.id && styles.tabBtnActive,
                        isWeb && ({ cursor: "pointer" } as any)
                      ]} 
                      onPress={() => setSelectedPackId(item.id)}
                    >
                      {item.cover_url ? (
                        item.cover_url.includes(".webm") && isWeb ? (
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
                  )}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", alignItems: "center" },
  overlayDesktop: { justifyContent: "center" },
  container: { width: "100%", height: SCREEN_HEIGHT * 0.5, backgroundColor: "#2b2d31", borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  title: { color: "#f2f3f5", fontSize: 18, fontWeight: "bold" },
  iconBtn: { padding: 4, backgroundColor: "#1e1f22", borderRadius: 8 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { color: "#949ba4", fontSize: 15, marginBottom: 16 },
  addBtn: { backgroundColor: "#5865F2", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  stickerWrapper: { flex: 1, aspectRatio: 1, maxWidth: "23%", backgroundColor: "#1e1f22", borderRadius: 8, padding: 6, justifyContent: "center", alignItems: "center" },
  stickerImg: { width: "100%", height: "100%" },
  tabsContainer: { backgroundColor: "#1e1f22", borderTopWidth: 1, borderTopColor: "#1e1f22" },
  tabBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#2b2d31" },
  tabBtnActive: { backgroundColor: "#4e5058" },
  tabIcon: { width: 32, height: 32, borderRadius: 4 },
  label: { color: "#dbdee1", fontSize: 13, fontWeight: "600", marginTop: 16 },
  input: { backgroundColor: "#1e1f22", color: "#f2f3f5", borderRadius: 8, padding: 12, marginTop: 6 },
  hint: { color: "#949ba4", fontSize: 11, marginTop: 4 },
  importBtn: { backgroundColor: "#5865F2", marginTop: 24, padding: 14, borderRadius: 8, alignItems: "center" },
  importBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  toggle: { width: 40, height: 24, borderRadius: 12, backgroundColor: "#4e5058", justifyContent: "center", paddingHorizontal: 2 },
  toggleOn: { backgroundColor: "#5865F2" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  toggleThumbOn: { transform: [{ translateX: 16 }] }
});
