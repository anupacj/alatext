import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Mic, Trash2, Send, Square } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

interface VoiceRecorderProps {
  onSendAudio: (blob: Blob, mimeType: string) => Promise<void>;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSendAudio, onCancel }: VoiceRecorderProps) {
  const { theme } = useTheme();
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(100);
        setIsRecording(true);
        startTimer();
      } catch (err) {
        console.error("Microphone access denied or unsupported:", err);
        alert("Microphone permission denied! Please allow microphone access in your browser to record voice notes.");
        onCancel();
      }
    } else {
      alert("Voice recording is supported on web browsers.");
      onCancel();
    }
  };

  const handleFinishAndSend = () => {
    if (!mediaRecorderRef.current || sending) return;
    setSending(true);
    stopTimer();

    const recorder = mediaRecorderRef.current;
    const mimeType = recorder.mimeType || "audio/webm";

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      // Stop all tracks to release mic icon in browser
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track: any) => track.stop());
      }
      try {
        await onSendAudio(audioBlob, mimeType);
      } catch (e) {
        console.error(e);
      } finally {
        setSending(false);
      }
    };

    try {
      if (recorder.state === "recording") {
        recorder.requestData();
      }
    } catch (e) {}
    recorder.stop();
  };

  const handleDiscard = () => {
    stopTimer();
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track: any) => track.stop());
        }
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    onCancel();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <TouchableOpacity style={styles.trashBtn} onPress={handleDiscard} disabled={sending}>
        <Trash2 size={20} color="#f43f5e" />
      </TouchableOpacity>

      <View style={styles.recIndicator}>
        <View style={styles.redDot} />
        <Text style={[styles.timerText, { color: theme.text }]}>{formatTimer(seconds)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: theme.accent }]}
        onPress={handleFinishAndSend}
        disabled={sending || seconds < 1}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Send size={18} color="#ffffff" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    height: 46,
    borderRadius: 9999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(244,63,94,0.15)",
  },
  recIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f43f5e",
  },
  timerText: {
    fontSize: 15,
    fontWeight: "700",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
});
