import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Dummy messages
const INITIAL_MESSAGES = [
  { id: '1', sender: 'Amanda', text: 'ok sounds good', time: 'Today at 2:13 PM', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '2', sender: 'Nelly', text: 'almost back from my trip to Portugal...', time: 'Today at 2:12 PM', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: '3', sender: 'Phibi', text: 'the trip looked amazing!', time: 'Today at 2:13 PM', avatar: 'https://i.pravatar.cc/150?u=5' },
  { id: '4', sender: 'mac', text: 'How long was your trip?', time: 'Today at 2:12 PM', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '5', sender: 'Nelly', text: 'Two weeks, but there\'s so much more I want to see so I will have to go back!', time: 'Today at 2:14 PM', avatar: 'https://i.pravatar.cc/150?u=4' },
];

export default function Chat() {
  const router = useRouter();
  const { name } = useLocalSearchParams();
  const [messages, setMessages] = useState(INITIAL_MESSAGES.reverse()); // FlatList inverted
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (inputText.trim() === '') return;
    const newMessage = {
      id: Date.now().toString(),
      sender: 'You',
      text: inputText,
      time: 'Just now',
      avatar: 'https://i.pravatar.cc/150?u=you'
    };
    setMessages([newMessage, ...messages]);
    setInputText('');
  };

  const renderMessage = ({ item }) => (
    <View style={styles.messageContainer}>
      <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageSender}>{item.sender}</Text>
          <Text style={styles.messageTime}>{item.time}</Text>
        </View>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.headerIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}># {name || 'general'}</Text>
        <TouchableOpacity>
          <Text style={styles.headerIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContainer}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Text style={styles.attachIcon}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={`Message #${name || 'general'}`}
            placeholderTextColor="#8e9297"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendIcon}>😁</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#36393f', // Discord dark background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#36393f',
    borderBottomWidth: 1,
    borderBottomColor: '#202225',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  headerIcon: {
    fontSize: 22,
    color: '#b9bbbe',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    marginTop: 2,
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
  },
  messageTime: {
    color: '#72767d',
    fontSize: 12,
  },
  messageText: {
    color: '#dcddde',
    fontSize: 15,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#36393f',
    borderTopWidth: 1,
    borderTopColor: '#202225',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#40444b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachIcon: {
    color: '#b9bbbe',
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#40444b',
    color: '#dcddde',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
  },
  sendIcon: {
    fontSize: 22,
  },
});
