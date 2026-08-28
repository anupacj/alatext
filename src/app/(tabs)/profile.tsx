import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, TextInput, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Settings, User, Camera, LogOut, X, Bell, Palette, Check, Smartphone, Download, Maximize2, Minimize2, ShieldCheck, Lock, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatarToR2 } from '../../lib/r2';
import AlaPinSettingsModal from '../../components/AlaPinSettingsModal';
import { isFeatureEnabled } from '../../lib/features';

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
  const [alaPinModalVisible, setAlaPinModalVisible] = useState(false);
  const [notificationPref, setNotificationPref] = useState('concealed_limited');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters!');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    setPasswordUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordUpdating(false);

    if (error) {
      alert(error.message || 'Failed to update password.');
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (checkStandalone) setIsInstalled(true);

      const handleFullscreenChange = () => {
        setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      };
    }
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        alert("To install on iOS:\n1. Tap the Share button (square with arrow up)\n2. Tap 'Add to Home Screen'\n\nThis launches the app full-screen without any address bars!");
      } else {
        alert("To install on Android:\nTap browser menu (⋮) -> 'Install app' or 'Add to Home Screen' to launch in fullscreen mode!");
      }
    }
  };

  const toggleFullscreen = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const el = document.documentElement as any;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen toggle error:", e);
    }
  };

  const [publicFeatures, setPublicFeatures] = useState<string[]>([]);

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

      const { data: st } = await supabase.from("app_settings").select("value").eq("key", "public_features").single();
      if (st?.value && Array.isArray(st.value)) setPublicFeatures(st.value);

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

                {/* MOBILE DISPLAY & FULLSCREEN */}
                <View style={styles.modalSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Smartphone size={18} color={theme.accent} />
                    <Text style={styles.sectionHeader}>Mobile Display & Fullscreen</Text>
                  </View>

                  {/* 1-Tap Browser Fullscreen Toggle */}
                  <TouchableOpacity
                    style={[styles.prefCard, isFullscreen && styles.prefCardActive]}
                    onPress={toggleFullscreen}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isFullscreen ? <Minimize2 size={16} color={theme.accent} /> : <Maximize2 size={16} color={theme.text} />}
                        <Text style={[styles.prefTitle, isFullscreen && { color: theme.text }]}>
                          {isFullscreen ? "Exit Fullscreen Mode" : "Expand to Fullscreen"}
                        </Text>
                      </View>
                      {isFullscreen && <Check size={16} color={theme.accent} />}
                    </View>
                    <Text style={[styles.prefSubtext, isFullscreen && { color: theme.textMuted }]}>
                      Temporarily removes browser address bar and top bar on mobile browsers.
                    </Text>
                  </TouchableOpacity>

                  {/* Add to Home Screen / PWA Install */}
                  <TouchableOpacity
                    style={[styles.prefCard, isInstalled && styles.prefCardActive]}
                    onPress={handleInstallApp}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Download size={16} color={theme.accent} />
                        <Text style={[styles.prefTitle, isInstalled && { color: theme.text }]}>
                          {isInstalled ? "App Installed (Standalone)" : "Add to Home Screen (Permanent Fullscreen)"}
                        </Text>
                      </View>
                      {isInstalled && <Check size={16} color={theme.accent} />}
                    </View>
                    <Text style={[styles.prefSubtext, isInstalled && { color: theme.textMuted }]}>
                      {isInstalled
                        ? "Running in standalone app mode with zero address bars."
                        : "Installs on your phone's home screen. Opens edge-to-edge like a real native app with no address bars."}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* ALAPIN SECURITY */}
                {isFeatureEnabled("alapin_decoy", profile, publicFeatures) && (
                  <View style={styles.modalSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ShieldCheck size={18} color={theme.accent} />
                      <Text style={styles.sectionHeader}>Security & Passcode</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.prefCard]}
                      onPress={() => {
                        setSettingsModalVisible(false);
                        setTimeout(() => setAlaPinModalVisible(true), 200);
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.prefTitle, { color: theme.text }]}>🔒 AlaPin Security (Passcode & Decoy PIN)</Text>
                        <ShieldCheck size={16} color={theme.accent} />
                      </View>
                      <Text style={[styles.prefSubtext, { color: theme.textMuted }]}>
                        Configure 4-digit passcode protection and stealth Decoy PIN mode.
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ACCOUNT SECURITY & CHANGE PASSWORD */}
                <View style={styles.modalSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <KeyRound size={18} color={theme.accent} />
                    <Text style={styles.sectionHeader}>Account Password</Text>
                  </View>

                  <View style={[styles.prefCard, { gap: 10 }]}>
                    <Text style={[styles.prefTitle, { color: theme.text }]}>🔑 Change Account Password</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, height: 42 }}>
                      <TextInput
                        style={{ flex: 1, color: theme.text, fontSize: 14 }}
                        placeholder="New Password (min 6 chars)"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} color={theme.textMuted} /> : <Eye size={18} color={theme.textMuted} />}
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, height: 42 }}>
                      <TextInput
                        style={{ flex: 1, color: theme.text, fontSize: 14 }}
                        placeholder="Confirm New Password"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                    </View>

                    <TouchableOpacity
                      style={{
                        height: 42,
                        borderRadius: 8,
                        backgroundColor: passwordSuccess ? '#22c55e' : theme.accent,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                      onPress={handleUpdatePassword}
                      disabled={passwordUpdating}
                    >
                      {passwordUpdating ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : passwordSuccess ? (
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Password Updated!</Text>
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Update Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <AlaPinSettingsModal visible={alaPinModalVisible} onClose={() => setAlaPinModalVisible(false)} />
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
