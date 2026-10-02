import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated as RNAnimated,
  Platform,
} from "react-native";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ChevronRight, User } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useRouter, usePathname } from "expo-router";
import {
  getCallState,
  subscribeCallState,
  registerUserForIncomingCalls,
  acceptIncomingCall,
  rejectIncomingCall,
  endActiveCall,
  toggleMicMute,
  toggleVideoCamera,
  formatCallDuration,
  WebRTCCallState,
} from "../utils/webrtcCall";

export default function GlobalCallManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [callState, setCallState] = useState<WebRTCCallState>(() => getCallState());
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const slideAnim = useRef(new RNAnimated.Value(-120)).current;

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Register for incoming calls globally as long as user is logged in
  useEffect(() => {
    if (!user?.id) return;
    const unsubRegister = registerUserForIncomingCalls(user.id);
    return unsubRegister;
  }, [user?.id]);

  // 2. Subscribe to WebRTC call state changes
  useEffect(() => {
    const unsubState = subscribeCallState((st) => {
      setCallState(st);
    });
    return unsubState;
  }, []);

  // 3. Ringing pulse animation
  useEffect(() => {
    if (callState.status === "ringing") {
      const pulseLoop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1.14,
            duration: 650,
            useNativeDriver: Platform.OS !== "web",
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: Platform.OS !== "web",
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState.status]);

  // 4. Slide in/out animation
  useEffect(() => {
    if (callState.status !== "idle") {
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else {
      RNAnimated.timing(slideAnim, {
        toValue: -140,
        duration: 250,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [callState.status]);

  // 5. Connect video streams if in a video call
  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [callState.remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [callState.localStream]);

  if (callState.status === "idle") return null;

  // If user is inside the chat screen, the Dynamic Island in chat handles all call states
  // (ringing, calling, connected) directly with custom notch curvature and spring physics!
  const isDirectChatOpen = pathname === "/chat" || pathname?.includes("chat");
  if (isDirectChatOpen) {
    return null;
  }

  const isRinging = callState.status === "ringing";
  const isCalling = callState.status === "calling";
  const isConnected = callState.status === "connected";

  const partnerName = callState.partnerName || (isRinging ? "Incoming Caller" : "Partner");
  const isVideo = callState.callType === "video";

  return (
    <RNAnimated.View
      style={[
        styles.globalOverlay,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.callCard, isRinging && styles.callCardRinging]}>
        {/* Top Info Row */}
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.85}
          onPress={() => {
            if (callState.chatId) {
              router.push(`/chat?id=${callState.chatId}`);
            }
          }}
        >
          {/* Avatar with pulse effect */}
          <RNAnimated.View
            style={[
              styles.avatarContainer,
              isRinging && {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {callState.partnerAvatar ? (
              <Image source={{ uri: callState.partnerAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: isRinging ? "#10b981" : theme.accent }]}>
                {isVideo ? <Video size={18} color="#fff" /> : <User size={18} color="#fff" />}
              </View>
            )}
            {isRinging && <View style={styles.ringingDot} />}
          </RNAnimated.View>

          {/* Text labels */}
          <View style={styles.infoCol}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            {isRinging ? (
              <Text style={styles.statusRinging}>
                Incoming {isVideo ? "HD Video Call..." : "Voice Call..."}
              </Text>
            ) : isCalling ? (
              <Text style={styles.statusCalling}>
                Calling {isVideo ? "Video..." : "Voice..."}
              </Text>
            ) : isConnected ? (
              <Text style={styles.statusConnected}>
                ● {formatCallDuration(callState.duration)} • {isVideo ? "Video Active" : "Voice Active"}
              </Text>
            ) : null}
          </View>

          {callState.chatId && !isDirectChatOpen && (
            <View style={styles.openChatBtn}>
              <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </TouchableOpacity>

        {/* Video Stage (if video call is connected and not on chat screen) */}
        {isConnected && isVideo && (
          <View style={styles.videoStage}>
            {Platform.OS === "web" ? (
              <video
                ref={remoteVideoRef as any}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: 140,
                  borderRadius: 14,
                  backgroundColor: "#000",
                  objectFit: "cover",
                } as any}
              />
            ) : null}

            {Platform.OS === "web" && callState.localStream && !callState.isVideoOff && (
              <video
                ref={localVideoRef as any}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 56,
                  height: 42,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: "#fff",
                  backgroundColor: "#222",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                } as any}
              />
            )}
          </View>
        )}

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          {isRinging ? (
            <>
              {/* Reject Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => rejectIncomingCall()}
                activeOpacity={0.8}
              >
                <PhoneOff size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Decline</Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => acceptIncomingCall()}
                activeOpacity={0.8}
              >
                <Phone size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Mic Mute Toggle */}
              {isConnected && (
                <TouchableOpacity
                  style={[styles.actionIconBtn, callState.isMuted && styles.actionIconBtnActive]}
                  onPress={toggleMicMute}
                  activeOpacity={0.7}
                >
                  {callState.isMuted ? <MicOff size={18} color="#ef4444" /> : <Mic size={18} color="#fff" />}
                </TouchableOpacity>
              )}

              {/* Video Camera Toggle */}
              {isConnected && isVideo && (
                <TouchableOpacity
                  style={[styles.actionIconBtn, callState.isVideoOff && styles.actionIconBtnActive]}
                  onPress={toggleVideoCamera}
                  activeOpacity={0.7}
                >
                  {callState.isVideoOff ? <VideoOff size={18} color="#ef4444" /> : <Video size={18} color="#fff" />}
                </TouchableOpacity>
              )}

              {/* Hangup / Cancel Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn, { flex: 1, marginLeft: 8 }]}
                onPress={endActiveCall}
                activeOpacity={0.8}
              >
                <PhoneOff size={18} color="#fff" />
                <Text style={styles.actionBtnText}>{isCalling ? "Cancel" : "End Call"}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  globalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999,
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 14 : 44,
    paddingHorizontal: 16,
  },
  callCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "rgba(18, 20, 26, 0.94)",
    borderRadius: 36,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
    ...(Platform.OS === "web" ? {
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)",
    } : {}),
  },
  callCardRinging: {
    borderColor: "rgba(16, 185, 129, 0.5)",
    ...(Platform.OS === "web" ? {
      boxShadow: "0 12px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(16, 185, 129, 0.35)",
    } : {}),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  ringingDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#12141a",
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  partnerName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusRinging: {
    color: "#10b981",
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 2,
  },
  statusCalling: {
    color: "#38bdf8",
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 2,
  },
  statusConnected: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  openChatBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  videoStage: {
    position: "relative",
    marginTop: 10,
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    gap: 8,
  },
  declineBtn: {
    backgroundColor: "#ef4444",
  },
  acceptBtn: {
    backgroundColor: "#10b981",
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  actionIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
});
