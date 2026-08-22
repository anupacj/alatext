import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Image, ScrollView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { X, Upload, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { uploadImageToR2 } from '../lib/r2';
import { supabase } from '../lib/supabase';

const FONTS = [
  { name: 'System', value: 'system' },
  { name: 'Serif', value: 'serif' },
  { name: 'Monospace', value: 'monospace' },
  { name: 'Cursive', value: 'cursive' },
  { name: 'Fantasy', value: 'fantasy' },
  { name: 'Arial', value: 'Arial' },
  { name: 'Georgia', value: 'Georgia' },
  { name: 'Verdana', value: 'Verdana' }
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
  const [fontFamily, setFontFamily] = useState(currentSettings?.font_family || 'system');

  useEffect(() => {
    if (visible && currentSettings) {
      setWallpaperUrl(currentSettings.wallpaper_url || null);
      setDim(currentSettings.wallpaper_dim || 0);
      setBlur(currentSettings.wallpaper_blur || 0);
      setZoom(currentSettings.wallpaper_zoom || 1);
      setFontFamily(currentSettings.font_family || 'system');
    }
  }, [visible, currentSettings]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setLoading(true);
      try {
        const mimeType = asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
        if (!asset.base64) throw new Error('Could not read image data');
        const url = await uploadImageToR2(`wallpapers/${chatId}/${userId}-${Date.now()}`, asset.base64, mimeType);
        setWallpaperUrl(url);
      } catch (e) {
        console.error('Failed to upload wallpaper', e);
        alert('Failed to upload wallpaper.');
      } finally {
        setLoading(false);
      }
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
      };

      const { error } = await supabase
        .from('chat_participants')
        .update(updates)
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) throw error;

      if (wallpaperUrl !== currentSettings?.wallpaper_url && wallpaperUrl) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: userId,
          content: 'updated their chat wallpaper. Tap here to change yours!',
          type: 'system'
        });
      }

      onSettingsSaved(updates);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chat Customization</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color="#b5bac1" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Wallpaper</Text>
            
            <View style={styles.wallpaperPreviewContainer}>
              {wallpaperUrl ? (
                <View style={styles.previewBox}>
                  <Image 
                    source={{ uri: wallpaperUrl }} 
                    style={[styles.previewImage, { transform: [{ scale: zoom }]}]} 
                    blurRadius={blur * 20}
                  />
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
                  <Text style={[styles.actionBtnText, { color: '#f23f43' }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {wallpaperUrl && (
              <View style={styles.slidersContainer}>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Dim ({Math.round(dim * 100)}%)</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={0.9}
                    value={dim}
                    onValueChange={setDim}
                    minimumTrackTintColor="#5865F2"
                    maximumTrackTintColor="#4e5058"
                  />
                </View>
                
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Blur ({Math.round(blur * 100)}%)</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    value={blur}
                    onValueChange={setBlur}
                    minimumTrackTintColor="#5865F2"
                    maximumTrackTintColor="#4e5058"
                  />
                </View>

                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Zoom ({zoom.toFixed(1)}x)</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={3}
                    value={zoom}
                    onValueChange={setZoom}
                    minimumTrackTintColor="#5865F2"
                    maximumTrackTintColor="#4e5058"
                  />
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Chat Font</Text>
            <View style={styles.fontOptions}>
              {FONTS.map(f => (
                <TouchableOpacity 
                  key={f.value}
                  style={[styles.fontOption, fontFamily === f.value && styles.fontOptionSelected]}
                  onPress={() => setFontFamily(f.value)}
                >
                  <Text style={[styles.fontOptionText, fontFamily === f.value && styles.fontOptionTextSelected, { fontFamily: f.value === 'system' ? undefined : f.value }]}>
                    {f.name}
                  </Text>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#313338',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '85%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
  },
  title: {
    color: '#f2f3f5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    color: '#b5bac1',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 16,
    marginTop: 8,
  },
  wallpaperPreviewContainer: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e1f22',
    marginBottom: 16,
  },
  previewBox: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyPreviewBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#80848e',
    marginTop: 8,
    fontSize: 14,
  },
  wallpaperActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#5865F2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    gap: 8,
  },
  removeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f23f43',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  slidersContainer: {
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  sliderRow: {
    marginBottom: 16,
  },
  sliderLabel: {
    color: '#dbdee1',
    fontSize: 14,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  fontOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fontOption: {
    backgroundColor: '#2b2d31',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fontOptionSelected: {
    borderColor: '#5865F2',
    backgroundColor: 'rgba(88, 101, 242, 0.1)',
  },
  fontOptionText: {
    color: '#b5bac1',
    fontSize: 16,
  },
  fontOptionTextSelected: {
    color: '#f2f3f5',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e1f22',
    backgroundColor: '#313338',
  },
  saveBtn: {
    backgroundColor: '#23a559',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
