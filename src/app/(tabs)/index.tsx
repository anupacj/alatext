import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, SafeAreaView, Platform, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Search, MessageSquare, Plus } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Chat Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!user) return;
    
    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_participants')
          .select(`
            chat_id,
            chats (
              id,
              name,
              is_group,
              avatar_url
            )
          `)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        const formattedChats = data?.map((item: any) => ({
          id: item.chats.id,
          name: item.chats.name || 'Chat',
          avatar: item.chats.avatar_url || 'https://i.pravatar.cc/150?u=' + item.chats.id,
          lastMessage: 'Tap to view messages...',
          time: '',
          unread: 0
        })) || [];
        
        setChats(formattedChats);
      } catch (e) {
        console.error('Error fetching chats', e);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [user]);

  const handleStartChat = async () => {
    if (!searchUsername.trim() || !user) return;
    setSearchLoading(true);
    setSearchError('');

    try {
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', searchUsername.trim())
        .single();
        
      if (profileError || !targetProfile) {
        setSearchError('User not found.');
        setSearchLoading(false);
        return;
      }

      if (targetProfile.id === user.id) {
        setSearchError('You cannot chat with yourself.');
        setSearchLoading(false);
        return;
      }
      
      const uuid = require('react-native-uuid');
      const newChatId = (uuid.default ? uuid.default.v4() : uuid.v4());

      const { error: chatError } = await supabase
        .from('chats')
        .insert([{ id: newChatId, is_group: false, name: targetProfile.username }]);

      if (chatError) throw chatError;

      const { error: participantError } = await supabase.from('chat_participants').insert([
        { chat_id: newChatId, user_id: user.id },
        { chat_id: newChatId, user_id: targetProfile.id }
      ]);
      
      if (participantError) throw participantError;

      setModalVisible(false);
      setSearchUsername('');
      
      router.push({ pathname: '/chat', params: { id: newChatId, name: targetProfile.username, avatar: 'https://i.pravatar.cc/150?u=' + newChatId } });
      
    } catch (e: any) {
      console.error(e);
      setSearchError(e.message || 'An error occurred.');
    } finally {
      setSearchLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.chatItem} 
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/chat', params: { id: item.id, name: item.name, avatar: item.avatar } })}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.userAvatarMini}>
              <User size={16} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>ala chat</Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Search size={20} color="#b5bac1" />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#5865F2" />
          </View>
        ) : chats.length === 0 ? (
          <View style={styles.centerContainer}>
            <MessageSquare size={64} color="#4f545c" />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to start texting!</Text>
          </View>
        ) : (
          <FlatList
            data={chats}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        <TouchableOpacity 
          style={styles.fab} 
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={32} color="#ffffff" />
        </TouchableOpacity>

        {/* New Chat Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Start a New Chat</Text>
              <Text style={styles.modalSubtitle}>Enter your friend's exact username.</Text>
              
              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

              <TextInput
                style={styles.modalInput}
                placeholder="Username (e.g. jdoe123)"
                placeholderTextColor="#949ba4"
                value={searchUsername}
                onChangeText={setSearchUsername}
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => { setModalVisible(false); setSearchError(''); setSearchUsername(''); }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.startButton]} 
                  onPress={handleStartChat}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.startButtonText}>Start</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b2d31' },
  container: {
    flex: 1,
    backgroundColor: '#2b2d31',
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    width: '100%',
    alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#1e1f22',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#2b2d31',
    borderBottomWidth: 1, borderBottomColor: '#1e1f22',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  userAvatarMini: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#5865F2',
    marginRight: 12, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#f2f3f5', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1f22',
    justifyContent: 'center', alignItems: 'center',
  },
  listContainer: { paddingTop: 8, paddingBottom: 120 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { color: '#f2f3f5', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#949ba4', fontSize: 14, marginTop: 8 },
  chatItem: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: '#313338' },
  chatContent: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { color: '#f2f3f5', fontSize: 17, fontWeight: '600' },
  chatTime: { color: '#949ba4', fontSize: 12, fontWeight: '500' },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { color: '#949ba4', fontSize: 15, flex: 1, paddingRight: 16 },
  lastMessageUnread: { color: '#dbdee1', fontWeight: '500' },
  badge: { backgroundColor: '#f23f43', borderRadius: 12, paddingHorizontal: 6, height: 20, minWidth: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  fab: {
    position: 'absolute', bottom: 100, right: 24, width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#5865F2', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24
  },
  modalView: {
    width: '100%', maxWidth: 400, backgroundColor: '#313338', borderRadius: 8, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  modalTitle: { color: '#f2f3f5', fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { color: '#b5bac1', fontSize: 14, marginBottom: 20, textAlign: 'center' },
  errorText: { color: '#f23f43', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  modalInput: {
    backgroundColor: '#1e1f22', color: '#dbdee1', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 24,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, minWidth: 80, alignItems: 'center' },
  cancelButton: { backgroundColor: 'transparent' },
  cancelButtonText: { color: '#f2f3f5', fontSize: 14, fontWeight: '600' },
  startButton: { backgroundColor: '#5865F2' },
  startButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
