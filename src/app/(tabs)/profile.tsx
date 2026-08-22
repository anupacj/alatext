import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Settings, User, Camera, LogOut } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatarToR2 } from '../../lib/r2';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');

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
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, [user]);

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
          <TouchableOpacity style={styles.iconButton}>
            <Settings size={24} color="#b5bac1" />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#313338' },
  container: {
    flex: 1, backgroundColor: '#313338', maxWidth: Platform.OS === 'web' ? 800 : '100%',
    width: '100%', alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0, borderRightWidth: Platform.OS === 'web' ? 1 : 0, borderColor: '#1e1f22',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2b2d31',
  },
  headerTitle: { color: '#f2f3f5', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1f22', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 16 },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: '#313338' },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#5865F2',
    justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: '#313338',
  },
  editBadge: {
    position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1e1f22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#313338',
  },
  username: { color: '#b5bac1', fontSize: 16, fontWeight: '600', marginBottom: 32 },
  editSection: { width: '100%', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#b5bac1', marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  textInput: {
    flex: 1, backgroundColor: '#1e1f22', color: '#dbdee1', borderRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
  },
  saveButton: { backgroundColor: '#5865F2', borderRadius: 4, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold' },
  settingsGroup: { width: '100%', backgroundColor: '#2b2d31', borderRadius: 8, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: '#b5bac1', fontSize: 16 },
  infoValue: { color: '#dbdee1', fontSize: 16 },
  logoutButton: {
    flexDirection: 'row', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#da373c',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4, alignItems: 'center', marginBottom: 120, width: '100%', justifyContent: 'center'
  },
  logoutText: { color: '#da373c', fontSize: 16, fontWeight: '600' }
});
