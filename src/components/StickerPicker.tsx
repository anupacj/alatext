import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList, Image, Dimensions, TextInput } from "react-native";
import { X, Plus, Download, AlertCircle } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { uploadImageToR2 } from "../lib/r2";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StickerPickerProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  onSelectSticker: (url: string) => void;
}

export default function StickerPicker({ visible, onClose, chatId, userId, onSelectSticker }: StickerPickerProps) {
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
    setLoading(true);
    const { data } = await supabase
      .from("sticker_packs")
      .select("*")
      .or(`chat_id.is.null,chat_id.eq.${chatId}`)
      .order("created_at", { ascending: false });
    
    if (data) {
      setPacks(data);
      if (data.length > 0 && !selectedPackId) setSelectedPackId(data[0].id);
    }
    setLoading(false);
  };

  const fetchStickers = async (packId: string) => {
    const { data } = await supabase.from("stickers").select("*").eq("pack_id", packId).order("created_at", { ascending: true });
    if (data) setStickers(data);
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
      const validStickers = stickerSet.stickers.filter((s: any) => !s.is_animated && !s.is_video);
      if (validStickers.length === 0) throw new Error("Pack contains no static stickers.");

      setImportProgress("Creating pack...");
      const { data: pack, error: packErr } = await supabase.from("sticker_packs").insert({
        name: stickerSet.title || parsedName,
        chat_id: isPrivate ? chatId : null,
        creator_id: userId,
      }).select().single();

      if (packErr) throw packErr;

      let coverUrl = null;

      setImportProgress(`Importing 0 / ${validStickers.length} stickers...`);
      for (let i = 0; i < validStickers.length; i++) {
        const s = validStickers[i];
        try {
          const fRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${s.file_id}`);
          const fData = await fRes.json();
          if (!fData.ok) continue;

          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fData.result.file_path}`;
          const imgRes = await fetch(fileUrl);
          const blob = await imgRes.blob();
          const ext = fData.result.file_path.split('.').pop() || 'webp';
          const fileName = `stickers/${pack.id}/${s.file_id}.${ext}`;
          
          const uploadedUrl = await uploadImageToR2(new File([blob], fileName, { type: blob.type }));
          if (i === 0) coverUrl = uploadedUrl;
          
          await supabase.from("stickers").insert({
            pack_id: pack.id,
            file_url: uploadedUrl,
            emoji: s.emoji || ""
          });

          setImportProgress(`Importing ${i + 1} / ${validStickers.length} stickers...`);
        } catch (e) { console.error("Error on sticker", i, e); }
      }

      if (coverUrl) await supabase.from("sticker_packs").update({ cover_url: coverUrl }).eq("id", pack.id);

      alert("Import complete!");
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
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          
          <View style={styles.header}>
            <Text style={styles.title}>{isImporting ? "Import Sticker Pack" : "Stickers"}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {!isImporting && (
                <TouchableOpacity onPress={() => setIsImporting(true)} style={styles.iconBtn}>
                  <Plus size={20} color="#f2f3f5" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => isImporting ? setIsImporting(false) : onClose()} style={styles.iconBtn}>
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
                data={stickers}
                keyExtractor={s => s.id}
                numColumns={4}
                contentContainerStyle={{ padding: 12, gap: 12 }}
                columnWrapperStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.stickerWrapper} 
                    onPress={() => { onSelectSticker(item.file_url); onClose(); }}
                  >
                    <Image source={{ uri: item.file_url }} style={styles.stickerImg} resizeMode="contain" />
                  </TouchableOpacity>
                )}
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
                      style={[styles.tabBtn, selectedPackId === item.id && styles.tabBtnActive]}
                      onPress={() => setSelectedPackId(item.id)}
                    >
                      {item.cover_url ? (
                        <Image source={{ uri: item.cover_url }} style={styles.tabIcon} />
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
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  container: { height: SCREEN_HEIGHT * 0.5, backgroundColor: "#2b2d31", borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  title: { color: "#f2f3f5", fontSize: 18, fontWeight: "bold" },
  iconBtn: { padding: 4, backgroundColor: "#1e1f22", borderRadius: 8 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { color: "#949ba4", fontSize: 15, marginBottom: 16 },
  addBtn: { backgroundColor: "#5865F2", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  stickerWrapper: { flex: 1, aspectRatio: 1, maxWidth: "23%", backgroundColor: "#1e1f22", borderRadius: 8, padding: 4 },
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
