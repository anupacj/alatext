import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { Play, Pause, Maximize2, X } from "lucide-react-native";

interface VideoPlayerBubbleProps {
  videoUrl: string;
  isMe?: boolean;
}

export default function VideoPlayerBubble({ videoUrl, isMe }: VideoPlayerBubbleProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          style={styles.webVideo as any}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.thumbnailPlaceholder}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.playBadge}>
          <Play size={24} color="#ffffff" style={{ marginLeft: 2 }} />
        </View>
        <Text style={styles.videoLabel}>Tap to Play Video</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setModalVisible(false)}
          >
            <X size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 260,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 2,
  },
  webVideo: {
    width: "100%",
    maxWidth: 260,
    maxHeight: 280,
    borderRadius: 12,
    backgroundColor: "#000000",
  },
  thumbnailPlaceholder: {
    width: 240,
    height: 160,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  playBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(88,101,242,0.9)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  videoLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 48,
    right: 24,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 24,
  },
});
