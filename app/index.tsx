import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';

// Dummy data for chats
const CHATS = [
  { id: '1', name: 'general', lastMessage: 'did anyone book their flights yet?', time: '2:07 PM', unread: 2, avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'mac', lastMessage: 'I have a trick for getting cheaper flights', time: '2:07 PM', unread: 0, avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '3', name: 'Amanda', lastMessage: 'ok sounds good', time: '2:13 PM', unread: 0, avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Nelly', lastMessage: 'almost back from my trip to Portugal...', time: '2:12 PM', unread: 1, avatar: 'https://i.pravatar.cc/150?u=4' },
];

export default function Home() {
  const router = useRouter();

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem} 
      onPress={() => router.push({ pathname: '/chat', params: { id: item.id, name: item.name, avatar: item.avatar } })}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Telegram</Text>
        <TouchableOpacity>
          <Text style={styles.headerIcon}>🔍</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={CHATS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
      
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c242e', // Telegram dark theme background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#242f3d',
    borderBottomWidth: 1,
    borderBottomColor: '#101418',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerIcon: {
    fontSize: 22,
    color: '#ffffff',
  },
  listContainer: {
    paddingBottom: 80,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303f50',
    paddingBottom: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatTime: {
    color: '#8c9ead',
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    color: '#8c9ead',
    fontSize: 14,
    flex: 1,
    paddingRight: 16,
  },
  badge: {
    backgroundColor: '#5288c1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5288c1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 24,
  },
});
