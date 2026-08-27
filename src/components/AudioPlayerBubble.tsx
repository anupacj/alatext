import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Play, Pause, Volume2 } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

interface AudioPlayerBubbleProps {
  audioUrl: string;
  isMe?: boolean;
}

export default function AudioPlayerBubble({ audioUrl, isMe }: AudioPlayerBubbleProps) {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      const handleLoadedData = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        if ((!duration || !isFinite(duration)) && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener("loadeddata", handleLoadedData);
      audio.addEventListener("loadedmetadata", handleLoadedData);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.pause();
        audio.removeEventListener("loadeddata", handleLoadedData);
        audio.removeEventListener("loadedmetadata", handleLoadedData);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
      };
    }
  }, [audioUrl, duration]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((e: any) => {
          console.error("Audio playback error:", e);
          setIsLoading(false);
        });
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: isMe ? "rgba(255,255,255,0.25)" : theme.accent }]}
        onPress={togglePlayPause}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : isPlaying ? (
          <Pause size={18} color="#ffffff" />
        ) : (
          <Play size={18} color="#ffffff" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

      <View style={styles.infoWrapper}>
        <View style={styles.waveformTrack}>
          <View
            style={[
              styles.waveformFill,
              { width: `${Math.min(100, Math.max(0, progressPercent))}%`, backgroundColor: isMe ? "#ffffff" : theme.accent },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: isMe ? "rgba(255,255,255,0.85)" : theme.textMuted }]}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
          <Volume2 size={12} color={isMe ? "rgba(255,255,255,0.7)" : theme.textMuted} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: 210,
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 10,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  infoWrapper: {
    flex: 1,
    gap: 6,
  },
  waveformTrack: {
    height: 4,
    backgroundColor: "rgba(150,150,150,0.3)",
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  waveformFill: {
    height: "100%",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
