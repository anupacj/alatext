import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Image, ScrollView, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import { X, Upload, Trash2, Image as ImageIcon } from "lucide-react-native";
import { uploadImageToR2 } from "../lib/r2";
import { supabase } from "../lib/supabase";

const FONTS = [
  { name: "System", value: "system" },
  { name: "Serif", value: "serif" },
  { name: "Monospace", value: "monospace" },
  { name: "Cursive", value: "cursive" },
  { name: "Arial", value: "Arial" },
  { name: "Georgia", value: "Georgia" },
  { name: "Verdana", value: "Verdana" },
];

const BUBBLE_COLORS = [
  { label: "Indigo", color: "#5865F2" },
  { label: "Rose", color: "#f43f5e" },
  { label: "Blush", color: "#fb7185" },
  { label: "Coral", color: "#fb923c" },
  { label: "Peach", color: "#fbbf24" },
  { label: "Mint", color: "#34d399" },
  { label: "Sky", color: "#38bdf8" },
  { label: "Lavender", color: "#a78bfa" },
  { label: "Lilac", color: "#c084fc" },
  { label: "Mauve", color: "#e879f9" },
];

const RECEIVED_COLORS = [
  { label: "Charcoal", color: "#2b2d31" },
  { label: "Slate", color: "#374151" },
  { label: "Navy", color: "#1e3a5f" },
  { label: "Plum", color: "#3b1f4f" },
  { label: "Forest", color: "#14532d" },
  { label: "Stone", color: "#44403c" },
  { label: "Blush", color: "#881337" },
  { label: "Ocean", color: "#164e63" },
];

const BUBBLE_SHAPES = [
  { label: "Round", value: "round", radius: 18 },
  { label: "Soft", value: "soft", radius: 10 },
  { label: "Sharp", value: "sharp", radius: 4 },
];

const THEMES = [
  { label: "🌸 Cherry Blossom", name: "cherry", sent: "#f4a5c0", received: "#3b1f30", bg: "#1a0a14" },
  { label: "🌙 Midnight", name: "midnight", sent: "#7c3aed", received: "#1e1b4b", bg: "#0f0a1e" },
  { label: "🍭 Cotton Candy", name: "candy", sent: "#f472b6", received: "#312e81", bg: "#1e1027" },
  { label: "🌿 Garden", name: "garden", sent: "#34d399", received: "#14532d", bg: "#052e16" },
  { label: "🌊 Ocean", name: "ocean", sent: "#38bdf8", received: "#164e63", bg: "#0c1a2e" },
  { label: "🦇 Noir", name: "noir", sent: "#d4af37", received: "#1c1c1c", bg: "#0a0a0a" },
];

const DOODLE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "✨ Sparkles", value: "sparkles" },
  { label: "💕 Hearts", value: "hearts" },
  { label: "⭐ Stars", value: "stars" },
  { label: "❄️ Snow", value: "snow" },
  { label: "🌸 Petals", value: "petals" },
];

export const FONT_OPTIONS = [
  { label: "System", value: "system" },
  { label: "BenchNine", value: "BenchNine" },
  { label: "Playwrite BR", value: "Playwrite BR" },
  { label: "Playwrite DE LA", value: "Playwrite DE LA" },
  { label: "Handjet", value: "Handjet" },
  { label: "Rum Raisin", value: "Rum Raisin" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Raleway", value: "Raleway" },
  { label: "Outfit", value: "Outfit" },
  { label: "Elsie", value: "Elsie" },
  { label: "Lobster Two", value: "Lobster Two" },
  { label: "Josefin Sans", value: "Josefin Sans" },
  { label: "Changa One", value: "Changa One" },
  { label: "Caveat", value: "Caveat" },
  { label: "Cinzel", value: "Cinzel" },
];

interface ChatSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  userId: string;
  currentSettings: any;
  onSettingsSaved: (newSettings: any) => void;
}

export default function ChatSettingsModal({ visible, onClose, chatId, userId, currentSettings, onSettingsSaved }: ChatSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState(currentSettings?.wallpaper_url || null);
  const [dim, setDim] = useState(currentSettings?.wallpaper_dim || 0);
  const [blur, setBlur] = useState(currentSettings?.wallpaper_blur || 0);
  const [zoom, setZoom] = useState(currentSettings?.wallpaper_zoom || 1);
  const [fontFamily, setFontFamily] = useState(currentSettings?.font_family || "system");
  const [bubbleColorSent, setBubbleColorSent] = useState(currentSettings?.bubble_color_sent || "#5865F2");
  const [bubbleColorReceived, setBubbleColorReceived] = useState(currentSettings?.bubble_color_received || "#2b2d31");
  const [bubbleShape, setBubbleShape] = useState(currentSettings?.bubble_shape || "round");
  const [gradientEnabled, setGradientEnabled] = useState(currentSettings?.bubble_gradient_enabled || false);
  const [gradientColor2, setGradientColor2] = useState(currentSettings?.bubble_gradient_color2 || "#a78bfa");
  const [wallpaperDoodle, setWallpaperDoodle] = useState(currentSettings?.wallpaper_doodle || "none");
  const [anniversaryDate, setAnniversaryDate] = useState(currentSettings?.anniversary_date || null);

  useEffect(() => {
    if (visible && currentSettings) {
      setWallpaperUrl(currentSettings.wallpaper_url || null);
      setDim(currentSettings.wallpaper_dim || 0);
      setBlur(currentSettings.wallpaper_blur || 0);
      setZoom(currentSettings.wallpaper_zoom || 1);
      setFontFamily(currentSettings.font_family || "system");
      setBubbleColorSent(currentSettings.bubble_color_sent || "#5865F2");
      setBubbleColorReceived(currentSettings.bubble_color_received || "#2b2d31");
      setBubbleShape(currentSettings.bubble_shape || "round");
      setGradientEnabled(currentSettings.bubble_gradient_enabled || false);
      setGradientColor2(currentSettings.bubble_gradient_color2 || "#a78bfa");
      setWallpaperDoodle(currentSettings.wallpaper_doodle || "none");
      setAnniversaryDate(currentSettings.anniversary_date || null);
    }
  }, [visible, currentSettings]);

  const applyTheme = useCallback((theme: typeof THEMES[0]) => {
    setBubbleColorSent(theme.sent);
    setBubbleColorReceived(theme.received);
    setGradientEnabled(false);
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setLoading(true);
      try {
        const mimeType = asset.mimeType || "image/jpeg";
        if (!asset.base64) throw new Error("Could not read image data");
        const url = await uploadImageToR2(`wallpapers/${chatId}/${userId}-${Date.now()}`, asset.base64, mimeType);
        setWallpaperUrl(url);
      } catch (e) { console.error("Failed to upload wallpaper", e); }
      finally { setLoading(false); }
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const updates = {
        wallpaper_url: wallpaperUrl,
        wallpaper_dim: dim,
        wallpaper_blur: blur,
        wallpaper_zoom: zoom,
        font_family: fontFamily,
        bubble_color_sent: bubbleColorSent,
        bubble_color_received: bubbleColorReceived,
        bubble_shape: bubbleShape,
        bubble_gradient_enabled: gradientEnabled,
        bubble_gradient_color2: gradientColor2,
        wallpaper_doodle: wallpaperDoodle,
        anniversary_date: anniversaryDate,
      };
      const { error } = await supabase.from("chat_participants").update(updates).eq("chat_id", chatId).eq("user_id", userId);
      if (error) throw error;
      if (wallpaperUrl !== currentSettings?.wallpaper_url && wallpaperUrl) {
        await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, content: "updated their chat wallpaper. Tap here to apply it too!", type: "system" });
      }
      onSettingsSaved(updates);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const shapeRadius = BUBBLE_SHAPES.find(s => s.value === bubbleShape)?.radius ?? 18;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chat Customization</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={24} color="#b5bac1" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* THEMES */}
            <Text style={styles.sectionTitle}>✨ Themes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {THEMES.map(theme => (
                <TouchableOpacity key={theme.name} style={styles.themeCard} onPress={() => applyTheme(theme)}>
                  <View style={styles.themePreview}>
                    <View style={[styles.themeBubbleRight, { backgroundColor: theme.sent }]} />
                    <View style={[styles.themeBubbleLeft, { backgroundColor: theme.received }]} />
                  </View>
                  <Text style={styles.themeLabel}>{theme.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* BUBBLE COLORS */}
            <Text style={styles.sectionTitle}>💬 Sent Bubble Color</Text>
            <View style={styles.colorGrid}>
              {BUBBLE_COLORS.map(c => (
                <TouchableOpacity key={c.color} onPress={() => setBubbleColorSent(c.color)} style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorSent === c.color && styles.colorSwatchSelected]} />
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>📩 Received Bubble Color</Text>
            <View style={styles.colorGrid}>
              {RECEIVED_COLORS.map(c => (
                <TouchableOpacity key={c.color} onPress={() => setBubbleColorReceived(c.color)} style={[styles.colorSwatch, { backgroundColor: c.color }, bubbleColorReceived === c.color && styles.colorSwatchSelected]} />
              ))}
            </View>

            {/* GRADIENT */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Gradient Bubbles</Text>
              <TouchableOpacity style={[styles.toggle, gradientEnabled && styles.toggleOn]} onPress={() => setGradientEnabled(!gradientEnabled)}>
                <View style={[styles.toggleThumb, gradientEnabled && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
            {gradientEnabled && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Gradient End Color</Text>
                <View style={styles.colorGrid}>
                  {BUBBLE_COLORS.map(c => (
                    <TouchableOpacity key={c.color} onPress={() => setGradientColor2(c.color)} style={[styles.colorSwatch, { backgroundColor: c.color }, gradientColor2 === c.color && styles.colorSwatchSelected]} />
                  ))}
                </View>
                <View style={[styles.gradientPreview, { borderRadius: shapeRadius }]}>
                  <Text style={styles.gradientPreviewText}>Preview gradient →</Text>
                </View>
              </>
            )}

            {/* BUBBLE SHAPE */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🫧 Bubble Shape</Text>
            <View style={styles.shapeRow}>
              {BUBBLE_SHAPES.map(s => (
                <TouchableOpacity key={s.value} style={[styles.shapeOption, bubbleShape === s.value && styles.shapeOptionSelected]} onPress={() => setBubbleShape(s.value)}>
                  <View style={[styles.shapeSampleBubble, { borderRadius: s.radius, backgroundColor: bubbleColorSent }]} />
                  <Text style={[styles.shapeLabel, bubbleShape === s.value && { color: "#f2f3f5" }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ANNIVERSARY */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>💕 Anniversary / Streak Date</Text>
            {Platform.OS === 'web' ? (
              <input 
                type="date" 
                style={{
                  backgroundColor: "#1e1f22",
                  color: "#dbdee1",
                  border: "none",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "14px",
                  outline: "none",
                  width: "100%",
                  colorScheme: "dark"
                } as any}
                value={anniversaryDate ? new Date(anniversaryDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setAnniversaryDate(val ? new Date(val).toISOString() : null);
                }}
              />
            ) : (
              <Text style={{ color: '#949ba4', marginBottom: 16 }}>Date picker available on Web.</Text>
            )}

            {/* FONTS */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🔤 Font Style</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {FONT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={[styles.shapeOption, { width: 100, marginRight: 8, paddingVertical: 10 }, fontFamily === opt.value && styles.shapeOptionSelected]} onPress={() => setFontFamily(opt.value)}>
                  <Text style={[styles.shapeLabel, { fontFamily: opt.value === 'system' ? undefined : opt.value }, fontFamily === opt.value && { color: "#f2f3f5" }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* WALLPAPER */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🖼 Wallpaper</Text>
            
            <Text style={[styles.sliderLabel, { marginBottom: 12 }]}>Doodle Overlay</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {DOODLE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={[styles.shapeOption, { width: 80, marginRight: 8, paddingVertical: 10 }, wallpaperDoodle === opt.value && styles.shapeOptionSelected]} onPress={() => setWallpaperDoodle(opt.value)}>
                  <Text style={[styles.shapeLabel, wallpaperDoodle === opt.value && { color: "#f2f3f5" }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.wallpaperPreviewContainer}>
              {wallpaperUrl ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: wallpaperUrl }} style={[styles.previewImage, { transform: [{ scale: zoom }] }]} blurRadius={blur * 20} />
                  <View style={[styles.dimOverlay, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
                </View>
              ) : (
                <View style={styles.emptyPreviewBox}>
                  <ImageIcon size={48} color="#4e5058" />
                  <Text style={styles.emptyText}>No Wallpaper</Text>
                </View>
              )}
            </View>
            <View style={styles.wallpaperActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={pickImage} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Upload size={20} color="#fff" />}
                <Text style={styles.actionBtnText}>Upload</Text>
              </TouchableOpacity>
              {wallpaperUrl && (
                <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={() => setWallpaperUrl(null)} disabled={loading}>
                  <Trash2 size={20} color="#f23f43" />
                  <Text style={[styles.actionBtnText, { color: "#f23f43" }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            {wallpaperUrl && (
              <View style={styles.slidersContainer}>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Dim ({Math.round(dim * 100)}%)</Text>
                  <Slider style={styles.slider} minimumValue={0} maximumValue={0.9} value={dim} onValueChange={setDim} minimumTrackTintColor="#5865F2" maximumTrackTintColor="#4e5058" />
                </View>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Blur ({Math.round(blur * 100)}%)</Text>
                  <Slider style={styles.slider} minimumValue={0} maximumValue={1} value={blur} onValueChange={setBlur} minimumTrackTintColor="#5865F2" maximumTrackTintColor="#4e5058" />
                </View>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Zoom ({zoom.toFixed(1)}x)</Text>
                  <Slider style={styles.slider} minimumValue={1} maximumValue={3} value={zoom} onValueChange={setZoom} minimumTrackTintColor="#5865F2" maximumTrackTintColor="#4e5058" />
                </View>
              </View>
            )}

            {/* FONT */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🔤 Chat Font</Text>
            <View style={styles.fontOptions}>
              {FONTS.map(f => (
                <TouchableOpacity key={f.value} style={[styles.fontOption, fontFamily === f.value && styles.fontOptionSelected]} onPress={() => setFontFamily(f.value)}>
                  <Text style={[styles.fontOptionText, fontFamily === f.value && styles.fontOptionTextSelected, { fontFamily: f.value === "system" ? undefined : f.value }]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  container: { backgroundColor: "#313338", borderTopLeftRadius: 16, borderTopRightRadius: 16, height: "90%", maxWidth: Platform.OS === "web" ? 600 : ("100%" as any), width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#1e1f22" },
  title: { color: "#f2f3f5", fontSize: 20, fontWeight: "bold" },
  closeBtn: { padding: 4 },
  content: { padding: 20 },
  sectionTitle: { color: "#b5bac1", fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginBottom: 14, letterSpacing: 0.5 },
  themeCard: { alignItems: "center", marginRight: 16, width: 80 },
  themePreview: { width: 80, height: 56, backgroundColor: "#1e1f22", borderRadius: 12, justifyContent: "center", alignItems: "center", padding: 8, gap: 4, marginBottom: 6 },
  themeBubbleRight: { alignSelf: "flex-end", width: 48, height: 14, borderRadius: 8 },
  themeBubbleLeft: { alignSelf: "flex-start", width: 36, height: 14, borderRadius: 8 },
  themeLabel: { color: "#b5bac1", fontSize: 11, textAlign: "center" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorSwatchSelected: { borderWidth: 3, borderColor: "#fff" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 16 },
  toggleLabel: { color: "#dbdee1", fontSize: 15, fontWeight: "600" },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: "#4e5058", justifyContent: "center", paddingHorizontal: 3 },
  toggleOn: { backgroundColor: "#5865F2" },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbOn: { alignSelf: "flex-end" },
  gradientPreview: { height: 40, marginBottom: 16, backgroundColor: "#5865F2", justifyContent: "center", alignItems: "center" },
  gradientPreviewText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  shapeRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  shapeOption: { flex: 1, alignItems: "center", paddingVertical: 14, backgroundColor: "#2b2d31", borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  shapeOptionSelected: { borderColor: "#5865F2", backgroundColor: "rgba(88,101,242,0.1)" },
  shapeSampleBubble: { width: 48, height: 20, marginBottom: 8 },
  shapeLabel: { color: "#b5bac1", fontSize: 13 },
  wallpaperPreviewContainer: { height: 160, borderRadius: 8, overflow: "hidden", backgroundColor: "#1e1f22", marginBottom: 16 },
  previewBox: { flex: 1, width: "100%", height: "100%" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
  },
  emptyPreviewBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#80848e", marginTop: 8, fontSize: 14 },
  wallpaperActions: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: "#5865F2", flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 12, borderRadius: 6, gap: 8 },
  removeBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#f23f43" },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  slidersContainer: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 16, marginBottom: 20 },
  sliderRow: { marginBottom: 16 },
  sliderLabel: { color: "#dbdee1", fontSize: 14, marginBottom: 8 },
  slider: { width: "100%", height: 40 },
  fontOptions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fontOption: { backgroundColor: "#2b2d31", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  fontOptionSelected: { borderColor: "#5865F2", backgroundColor: "rgba(88,101,242,0.1)" },
  fontOptionText: { color: "#b5bac1", fontSize: 16 },
  fontOptionTextSelected: { color: "#f2f3f5", fontWeight: "bold" },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#1e1f22", backgroundColor: "#313338" },
  saveBtn: { backgroundColor: "#23a559", paddingVertical: 14, borderRadius: 6, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
