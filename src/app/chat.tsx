import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Phone, Video, Hash, Plus, Send, Smile, User, MoreVertical } from 'lucide-react-native';
import ChatSettingsModal from '../components/ChatSettingsModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Chat() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetUser, setTargetUser] = useState<any>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch target user profile and our own settings
    const fetchTargetUserAndSettings = async () => {
      // Fetch our settings
      const { data: mySettings } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('chat_id', id)
        .eq('user_id', user.id)
        .single();
        
      if (mySettings) setChatSettings(mySettings);

      // Find the other participant
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', id)
        .neq('user_id', user.id)
        .limit(1);

      if (participants && participants.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participants[0].user_id)
          .single();
        if (profile) setTargetUser(profile);
      }
    };
    fetchTargetUserAndSettings();

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq('chat_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching messages', error);
      } else {
        const formatted = data.map((msg: any) => ({
          id: msg.id,
          sender: msg.profiles?.username || 'Unknown',
          text: msg.content,
          type: msg.type || 'text',
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          avatar: msg.profiles?.avatar_url || null,
          isMe: msg.sender_id === user.id
        }));
        setMessages(formatted);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat_${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${id}`
      }, async (payload) => {
        // Fetch sender profile for new message
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        const newMessage = {
          id: payload.new.id,
          sender: profileData?.username || 'Unknown',
          text: payload.new.content,
          type: payload.new.type || 'text',
          time: new Date(payload.new.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          avatar: profileData?.avatar_url || null,
          isMe: payload.new.sender_id === user?.id
        };
        
        setMessages(prev => [newMessage, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const sendMessage = async () => {
    if (inputText.trim() === '' || !user || !id) return;
    
    const content = inputText.trim();
    setInputText('');

    const { error } = await supabase.from('messages').insert({
      chat_id: id,
      sender_id: user.id,
      content: content,
      type: 'text'
    });

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    if (item.type === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>
            <Text style={{ fontWeight: 'bold' }}>{item.sender}</Text> {item.text}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.messageContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
        ) : (
          <View style={[styles.messageAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
            <User size={20} color="#b5bac1" />
          </View>
        )}
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.messageSender, item.isMe && styles.mySenderName]}>{item.sender}</Text>
            <Text style={styles.messageTime}>{item.time}</Text>
          </View>
          <Text style={[styles.messageText, chatSettings?.font_family && chatSettings.font_family !== 'system' ? { fontFamily: chatSettings.font_family } : {}]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const getLastSeen = (dateString?: string) => {
    if (!dateString) return 'Offline';
    const diff = (new Date().getTime() - new Date(dateString).getTime()) / 1000 / 60; // diff in minutes
    if (diff < 5) return 'Online';
    if (diff < 60) return `Last seen ${Math.floor(diff)} mins ago`;
    if (diff < 1440) return `Last seen ${Math.floor(diff / 60)} hours ago`;
    return `Last seen ${Math.floor(diff / 1440)} days ago`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {chatSettings?.wallpaper_url && (
          <Image 
            source={{ uri: chatSettings.wallpaper_url }} 
            style={[StyleSheet.absoluteFillObject, { resizeMode: 'cover', transform: [{ scale: chatSettings.wallpaper_zoom || 1 }] }]}
            blurRadius={(chatSettings.wallpaper_blur || 0) * 20}
          />
        )}
        {chatSettings?.wallpaper_url && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${chatSettings.wallpaper_dim || 0})` }]} />
        )}
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}>
            <ChevronLeft size={28} color="#b5bac1" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              <Text style={styles.hashIcon}># </Text>
              {name || 'chat'}
            </Text>
            {targetUser && (
              <Text style={styles.lastSeenText}>{getLastSeen(targetUser.updated_at)}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.headerIconButton}>
            <Phone size={20} color="#b5bac1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Video size={22} color="#b5bac1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setSettingsVisible(true)}>
            <MoreVertical size={24} color="#b5bac1" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: chatSettings?.wallpaper_url ? 'transparent' : '#313338' }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.hashCircle}>
                <Hash size={40} color="#ffffff" />
              </View>
              <Text style={styles.welcomeTitle}>Welcome to #{name || 'chat'}!</Text>
              <Text style={styles.welcomeSubtitle}>This is the start of this conversation.</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={[styles.inputArea, chatSettings?.wallpaper_url && { backgroundColor: 'transparent' }]}>
            <View style={[styles.inputWrapper, chatSettings?.wallpaper_url && { backgroundColor: 'rgba(56, 58, 64, 0.8)' }]}>
              <TouchableOpacity style={styles.attachButton}>
                <Plus size={20} color="#383a40" />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder={`Message #${name || 'chat'}`}
                placeholderTextColor="#949ba4"
                value={inputText}
                onChangeText={setInputText}
                onKeyPress={(e: any) => {
                  if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                multiline
              />
              <TouchableOpacity style={styles.emojiButton} onPress={sendMessage}>
                {inputText.trim() ? <Send size={22} color="#5865F2" /> : <Smile size={22} color="#b5bac1" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <ChatSettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          chatId={id as string}
          userId={user.id}
          currentSettings={chatSettings}
          onSettingsSaved={setChatSettings}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#313338',
  },
  container: {
    flex: 1,
    backgroundColor: '#313338',
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    width: '100%',
    alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#1e1f22',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#313338',
    borderBottomWidth: 1,
    borderBottomColor: '#2b2d31',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#f2f3f5',
    fontSize: 17,
    fontWeight: '700',
  },
  lastSeenText: {
    color: '#23a559',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hashIcon: {
    color: '#80848e',
    fontSize: 20,
    fontWeight: '400',
  },
  headerIconButton: {
    marginLeft: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  hashCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#4e5058',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#f2f3f5',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#b5bac1',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    marginTop: 2,
    backgroundColor: '#2b2d31',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  messageSender: {
    color: '#f2f3f5',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  mySenderName: {
    color: '#5865F2', // Highlight current user name
  },
  messageTime: {
    color: '#949ba4',
    fontSize: 12,
    fontWeight: '500',
  },
  messageText: {
    color: '#dbdee1',
    fontSize: 16,
    lineHeight: 22,
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#313338',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#383a40',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b5bac1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  textInput: {
    flex: 1,
    color: '#dbdee1',
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
  },
  emojiButton: {
    marginLeft: 12,
    marginBottom: 4,
    padding: 2,
  },
  systemMessageContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    color: '#949ba4',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
