import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, TextInput, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Settings, User, Camera, LogOut, X, Bell, Palette, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatarToR2 } from '../../lib/r2';

const THEME_OPTIONS = [
  { id: 'dark', label: 'Dark', color: '#313338', textColor: '#f2f3f5' },
  { id: 'black', label: 'AMOLED', color: '#000000', textColor: '#ffffff', border: '#333333' },
  { id: 'light', label: 'Light', color: '#ffffff', textColor: '#111111', border: '#d1d5db' },
  { id: 'pink', label: 'Pink', color: '#fdf2f8', textColor: '#831843', border: '#f472b6' },
  { id: 'hacker', label: 'Hacker', color: '#0a0a0a', textColor: '#4ade80', border: '#22c55e' },
];

export default function Profile() {
  const { theme, setTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [notificationPref, setNotificationPref] = useState('concealed_limited');

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (!error && data) {
        setProfile(data);
        setEditName(data.display_name || data.username);
        if (data.notification_preference) {
          setNotificationPref(data.notification_preference);
        }
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, [user]);

  const saveNotificationPref = async (val: string) => {
    setNotificationPref(val);
    const { error } = await supabase.from("profiles").update({ notification_preference: val }).eq("id", user!.id);
    if (!error) {
      alert("Notification preference updated successfully!");
    } else {
      alert("Failed to update preference.");
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, // We need base64 for R2 upload without native file objects
      });

      if (!result.canceled && result.assets[0].base64 && user) {
        setSaving(true);
        const mimeType = result.assets[0].mimeType || 'image/jpeg';
        
        // Upload to Cloudflare R2
        const publicUrl = await uploadAvatarToR2(user.id, result.assets[0].base64, mimeType);
        
        // Update Supabase profile
        await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);
          
        setProfile({ ...profile, avatar_url: publicUrl });
      }
    } catch (e) {
      console.error("Image upload failed", e);
      alert("Make sure you added the R2 credentials in the .env file!");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || !user) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ display_name: editName.trim() })
        .eq('id', user.id);
      setProfile({ ...profile, display_name: editName.trim() });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#5865F2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsModalVisible(true)}>
            <Settings size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={saving}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={48} color="#ffffff" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Camera size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.username}>@{profile?.username || 'User'}</Text>

          <View style={styles.editSection}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your Display Name"
                placeholderTextColor="#949ba4"
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveName} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
            <LogOut size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={settingsModalVisible}
          onRequestClose={() => setSettingsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>App Settings</Text>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={{ padding: 4 }}>
                  <X size={24} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Palette size={18} color={theme.accent} />
                    <Text style={styles.sectionHeader}>App Theme</Text>
                  </View>
                  <View style={styles.themeGrid}>
                    {THEME_OPTIONS.map(t => {
                      const isSelected = theme.id === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          onPress={() => setTheme(t.id)}
                          style={[
                            styles.themeOptionCard,
                            { backgroundColor: t.color, borderColor: isSelected ? theme.accent : (t.border || theme.border) },
                            isSelected && styles.themeOptionSelected,
                          ]}
                        >
                          <Text style={[styles.themeOptionLabel, { color: t.textColor }]}>{t.label}</Text>
                          {isSelected && (
                            <View style={[styles.checkCircle, { backgroundColor: theme.accent }]}>
                              <Check size={12} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Bell size={18} color={theme.accent} />
                    <Text style={styles.sectionHeader}>Notifications</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.prefCard, notificationPref === "concealed_limited" && styles.prefCardActive]}
                    onPress={() => saveNotificationPref("concealed_limited")}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.prefTitle, notificationPref === "concealed_limited" && { color: theme.text }]}>🥔 Concealed & Limited (1/hr)</Text>
                      {notificationPref === "concealed_limited" && <Check size={16} color={theme.accent} />}
                    </View>
                    <Text style={[styles.prefSubtext, notificationPref === "concealed_limited" && { color: theme.textMuted }]}>Shows "Potato delivery". Max 1 notification per hour.</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.prefCard, notificationPref === "unconcealed_limitless" && styles.prefCardActive]}
                    onPress={() => saveNotificationPref("unconcealed_limitless")}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.prefTitle, notificationPref === "unconcealed_limitless" && { color: theme.text }]}>💬 Unconcealed & Limitless</Text>
                      {notificationPref === "unconcealed_limitless" && <Check size={16} color={theme.accent} />}
                    </View>
                    <Text style={[styles.prefSubtext, notificationPref === "unconcealed_limitless" && { color: theme.textMuted }]}>Shows the actual message text. No cooldown limit.</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={async () => {
                      if (typeof window !== "undefined" && "Notification" in window) {
                        if (Notification.permission === "denied") {
                          alert("Your browser is blocking notifications! Click the padlock icon next to the URL, change Notifications to Allow, and refresh the page.");
                        } else {
                          const perm = await Notification.requestPermission();
                          if (perm === "granted") alert("Notifications enabled!");
                        }
                      }
                    }}
                  >
                    <Text style={styles.permissionBtnText}>🔔 Request / Check Browser Permission</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: {
    flex: 1, backgroundColor: theme.background, maxWidth: Platform.OS === 'web' ? 800 : '100%',
    width: '100%', alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0, borderRightWidth: Platform.OS === 'web' ? 1 : 0, borderColor: theme.border,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.surface,
  },
  headerTitle: { color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 16 },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: theme.background },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: theme.accent,
    justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: theme.background,
  },
  editBadge: {
    position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: theme.background,
  },
  username: { color: theme.textMuted, fontSize: 16, fontWeight: '600', marginBottom: 32 },
  editSection: { width: '100%', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: 'bold', color: theme.textMuted, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  textInput: {
    flex: 1, backgroundColor: theme.border, color: theme.text, borderRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
  },
  saveButton: { backgroundColor: theme.accent, borderRadius: 4, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: theme.text, fontWeight: 'bold' },
  settingsGroup: { width: '100%', backgroundColor: theme.surface, borderRadius: 8, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: theme.textMuted, fontSize: 16 },
  infoValue: { color: theme.text, fontSize: 16 },
  logoutButton: {
    flexDirection: 'row', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#da373c',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4, alignItems: 'center', marginBottom: 120, width: '100%', justifyContent: 'center'
  },
  logoutText: { color: '#da373c', fontSize: 16, fontWeight: '600' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalView: { width: "100%", maxWidth: 440, backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.border, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12, maxHeight: '85%' },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: "bold" },
  modalSection: { marginBottom: 24 },
  sectionHeader: { color: theme.text, fontSize: 16, fontWeight: "700" },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  themeOptionCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, minWidth: '45%', flex: 1 },
  themeOptionSelected: { borderWidth: 2 },
  themeOptionLabel: { fontSize: 14, fontWeight: "700" },
  checkCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  prefCard: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, marginBottom: 10 },
  prefCardActive: { borderColor: theme.accent, backgroundColor: theme.border },
  prefTitle: { color: theme.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  prefSubtext: { color: theme.textMuted, fontSize: 12, lineHeight: 16 },
  permissionBtn: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  permissionBtnText: { color: theme.text, fontSize: 13, fontWeight: "600" },
});
