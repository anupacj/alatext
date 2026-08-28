import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Play, ExternalLink, AlertTriangle, X } from "lucide-react-native";

interface VideoPlayerBubbleProps {
  videoUrl: string;
  isMe?: boolean;
}

export default function VideoPlayerBubble({ videoUrl, isMe }: VideoPlayerBubbleProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleOpenExternal = () => {
    if (typeof window !== "undefined") {
      window.open(videoUrl, "_blank");
    }
  };

  if (hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <AlertTriangle size={20} color="#f43f5e" style={{ marginBottom: 6 }} />
          <Text style={styles.errorText}>Video Format Unsupported</Text>
          <TouchableOpacity style={styles.openBtn} onPress={handleOpenExternal}>
            <ExternalLink size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.openBtnText}>Open Video</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
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
          {Platform.OS === "web" && (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              style={{ width: "90%", maxHeight: "80%", borderRadius: 12 } as any}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 280,
    maxHeight: 320,
    borderRadius: 12,
    overflow: "hidden",
  },
  webVideo: {
    maxWidth: 280,
    maxHeight: 320,
    width: "100%",
    height: "auto",
    borderRadius: 12,
    display: "block",
    objectFit: "contain",
  },
  thumbnailPlaceholder: {
    width: 240,
    height: 160,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
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
  errorCard: {
    width: 240,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  errorText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5865F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
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
    zIndex: 10,
  },
});
