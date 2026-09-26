import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import {
  startOutgoingRingtone,
  stopOutgoingRingtone,
  startIncomingRingtone,
  stopIncomingRingtone,
  playCallConnectedTone,
  playCallEndedTone,
} from "./soundManager";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface WebRTCCallState {
  status: CallStatus;
  callId: string | null;
  chatId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerAvatar: string | null;
  callType: "audio" | "video";
  isCaller: boolean;
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioVolume: number; // 0.0 to 1.0 for live equalizer
}

const DEFAULT_CALL_STATE: WebRTCCallState = {
  status: "idle",
  callId: null,
  chatId: null,
  partnerId: null,
  partnerName: null,
  partnerAvatar: null,
  callType: "audio",
  isCaller: false,
  duration: 0,
  isMuted: false,
  isVideoOff: false,
  localStream: null,
  remoteStream: null,
  audioVolume: 0,
};

let currentState: WebRTCCallState = { ...DEFAULT_CALL_STATE };
const stateListeners: Set<(state: WebRTCCallState) => void> = new Set();

// Active WebRTC PeerConnection & Media elements
let peerConnection: RTCPeerConnection | null = null;
let activeSignalingChannel: any = null;
let userInboxChannel: any = null;
let registeredUserId: string | null = null;
let callDurationTimer: any = null;
let pendingIceCandidates: RTCIceCandidateInit[] = [];
let localGatheredIceCandidates: any[] = [];
let storedIncomingOffer: any = null;
let audioAnalyserNode: AnalyserNode | null = null;
let audioMeterInterval: any = null;
let remoteAudioElement: HTMLAudioElement | null = null;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

function notifyListeners() {
  const snapshot = { ...currentState };
  stateListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (e) {}
  });
}

function updateState(partial: Partial<WebRTCCallState>) {
  currentState = { ...currentState, ...partial };
  notifyListeners();
}

export function getCallState(): WebRTCCallState {
  return { ...currentState };
}

export function subscribeCallState(callback: (state: WebRTCCallState) => void): () => void {
  stateListeners.add(callback);
  callback({ ...currentState });
  return () => {
    stateListeners.delete(callback);
  };
}

export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Audio Metering for Live Island Equalizer Waves
// ---------------------------------------------------------------------------
function setupAudioVolumeMeter(stream: MediaStream) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    audioAnalyserNode = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    if (audioMeterInterval) clearInterval(audioMeterInterval);

    audioMeterInterval = setInterval(() => {
      if (!audioAnalyserNode) return;
      audioAnalyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const volume = Math.min(1, Math.max(0, avg / 128));
      if (Math.abs(volume - currentState.audioVolume) > 0.04) {
        updateState({ audioVolume: volume });
      }
    }, 120);
  } catch (e) {}
}

function stopAudioMeter() {
  if (audioMeterInterval) {
    clearInterval(audioMeterInterval);
    audioMeterInterval = null;
  }
  audioAnalyserNode = null;
}

// Ensure audio element exists to route remote voice
function ensureRemoteAudioElement(stream: MediaStream) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    if (!remoteAudioElement) {
      const el = document.createElement("audio");
      el.id = "webrtc_remote_audio_stream";
      el.autoplay = true;
      (el as any).playsInline = true;
      document.body.appendChild(el);
      remoteAudioElement = el;
    }
    remoteAudioElement.srcObject = stream;
    remoteAudioElement.play().catch(() => {});
  } catch (e) {}
}

function startDurationTimer() {
  stopDurationTimer();
  updateState({ duration: 0 });
  callDurationTimer = setInterval(() => {
    updateState({ duration: currentState.duration + 1 });
  }, 1000);
}

function stopDurationTimer() {
  if (callDurationTimer) {
    clearInterval(callDurationTimer);
    callDurationTimer = null;
  }
}

// Helper to ensure channel is subscribed before broadcasting
async function broadcastSafely(channel: any, event: string, payload: any): Promise<boolean> {
  if (!channel) return false;
  try {
    if (channel.state === "joined") {
      await channel.send({ type: "broadcast", event, payload });
      return true;
    }
    return await new Promise<boolean>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            channel.send({ type: "broadcast", event, payload }).catch(() => {});
          } catch (e) {}
          resolve(false);
        }
      }, 2500);

      channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED" && !resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            await channel.send({ type: "broadcast", event, payload });
            resolve(true);
          } catch (e) {
            resolve(false);
          }
        }
      });
    });
  } catch (e) {
    console.error("broadcastSafely error:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// PeerConnection Helper
// ---------------------------------------------------------------------------
function createPeerConnection(chatId: string, callId: string, partnerId: string, myUserId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate && activeSignalingChannel) {
      const candJSON = event.candidate.toJSON();
      localGatheredIceCandidates.push(candJSON);
      activeSignalingChannel.send({
        type: "broadcast",
        event: "ice_candidate",
        payload: {
          callId,
          senderId: myUserId,
          candidate: candJSON,
        },
      });
    }
  };

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0] || new MediaStream([event.track]);
    updateState({ remoteStream });
    ensureRemoteAudioElement(remoteStream);
    setupAudioVolumeMeter(remoteStream);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      stopOutgoingRingtone();
      stopIncomingRingtone();
      updateState({ status: "connected" });
    } else if (
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "closed"
    ) {
      if (currentState.status === "connected") {
        endActiveCall();
      }
    }
  };

  return pc;
}

// ---------------------------------------------------------------------------
// Public Calling API
// ---------------------------------------------------------------------------

/**
 * Handle incoming call invite payload (shared between inbox and chat channels)
 */
export function handleIncomingCallInvite(payload: {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "audio" | "video";
  offer: any;
}) {
  if (!payload || !payload.callId) return;

  // If already in a call or already ringing for this callId
  if (currentState.status !== "idle") {
    if (currentState.callId === payload.callId) return; // duplicate invite, ignore
    // Send busy response
    const chan = supabase.channel(`call_channel_${payload.callId}`);
    broadcastSafely(chan, "call_busy", { callId: payload.callId, callerId: payload.callerId });
    return;
  }

  storedIncomingOffer = payload.offer;
  startIncomingRingtone();
  updateState({
    status: "ringing",
    callId: payload.callId,
    chatId: payload.chatId,
    partnerId: payload.callerId,
    partnerName: payload.callerName,
    partnerAvatar: payload.callerAvatar,
    callType: payload.callType || "audio",
    isCaller: false,
  });
}

/**
 * Register the current logged-in user to receive incoming calls across the entire app
 */
export function registerUserForIncomingCalls(
  currentUserId: string,
  onIncomingCallPrompt?: (caller: {
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: "audio" | "video";
    chatId: string;
  }) => void
): () => void {
  if (!currentUserId) return () => {};

  if (registeredUserId === currentUserId && userInboxChannel) {
    return () => {};
  }

  if (userInboxChannel) {
    try {
      supabase.removeChannel(userInboxChannel);
    } catch (e) {}
    userInboxChannel = null;
  }

  registeredUserId = currentUserId;
  const topic = `call_inbox_${currentUserId}`;
  const chan = supabase.channel(topic, { config: { broadcast: { self: false } } });

  chan.on("broadcast", { event: "incoming_call_invite" }, ({ payload }) => {
    handleIncomingCallInvite(payload);
    if (onIncomingCallPrompt && payload) {
      onIncomingCallPrompt(payload);
    }
  });

  chan.on("broadcast", { event: "call_cancelled" }, ({ payload }) => {
    if (currentState.status === "ringing" && (!payload?.callId || payload.callId === currentState.callId)) {
      stopIncomingRingtone();
      playCallEndedTone();
      cleanupMedia();
      updateState({ ...DEFAULT_CALL_STATE, status: "idle" });
    }
  });

  chan.subscribe();
  userInboxChannel = chan;

  return () => {
    if (userInboxChannel) {
      try {
        supabase.removeChannel(userInboxChannel);
      } catch (e) {}
      userInboxChannel = null;
    }
    registeredUserId = null;
  };
}

/**
 * Initiates an outgoing Audio or Video call
 */
export async function initiateCall({
  chatId,
  callerId,
  callerName,
  callerAvatar,
  partnerId,
  partnerName,
  partnerAvatar,
  callType = "audio",
}: {
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  callType?: "audio" | "video";
}): Promise<void> {
  if (currentState.status !== "idle") return;

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  localGatheredIceCandidates = [];
  pendingIceCandidates = [];

  updateState({
    status: "calling",
    callId,
    chatId,
    partnerId,
    partnerName,
    partnerAvatar,
    callType,
    isCaller: true,
  });

  startOutgoingRingtone();

  try {
    // 1. Acquire Local Media
    const mediaConstraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };

    let localStream: MediaStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    } catch (mediaErr) {
      // Fallback to audio if video camera was denied/unavailable
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    updateState({ localStream });
    setupAudioVolumeMeter(localStream);

    // 2. Setup PeerConnection & Signaling
    const pc = createPeerConnection(chatId, callId, partnerId, callerId);
    peerConnection = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // 3. Connect to Supabase Realtime channel for this call
    const signalChannel = supabase.channel(`call_channel_${callId}`, {
      config: { broadcast: { self: false } },
    });
    activeSignalingChannel = signalChannel;

    signalChannel.on("broadcast", { event: "call_answered" }, async ({ payload }) => {
      stopOutgoingRingtone();
      if (pc.signalingState !== "closed" && payload?.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        // Flush pending ICE candidates received before answer
        while (pendingIceCandidates.length > 0) {
          const cand = pendingIceCandidates.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        // Resend all locally gathered candidates to make sure callee received them
        for (const cand of localGatheredIceCandidates) {
          signalChannel.send({
            type: "broadcast",
            event: "ice_candidate",
            payload: { callId, senderId: callerId, candidate: cand },
          });
        }
      }
    });

    signalChannel.on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
      if (payload?.callId === callId && payload?.candidate && payload.senderId !== callerId) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        } else {
          pendingIceCandidates.push(payload.candidate);
        }
      }
    });

    signalChannel.on("broadcast", { event: "call_rejected" }, () => {
      stopOutgoingRingtone();
      playCallEndedTone();
      endActiveCall();
    });

    signalChannel.on("broadcast", { event: "call_busy" }, () => {
      stopOutgoingRingtone();
      playCallEndedTone();
      endActiveCall();
    });

    signalChannel.on("broadcast", { event: "call_ended" }, () => {
      endActiveCall();
    });

    signalChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Create Offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        });
        await pc.setLocalDescription(offer);

        const invitePayload = {
          callId,
          chatId,
          callerId,
          callerName,
          callerAvatar,
          callType,
          offer: { type: offer.type, sdp: offer.sdp },
        };

        // Dual delivery:
        // A. Send to partner's personal call inbox
        const partnerInbox = supabase.channel(`call_inbox_${partnerId}`);
        broadcastSafely(partnerInbox, "incoming_call_invite", invitePayload);

        // B. Send to chat's broadcast channel (if active chat)
        if (chatId) {
          const chatBroadcast = supabase.channel(`chat_broadcast_${chatId}`, { config: { broadcast: { self: false } } });
          broadcastSafely(chatBroadcast, "incoming_call_invite", invitePayload);
        }
      }
    });

    // 4. Timeout after 38s if no answer
    setTimeout(() => {
      if (currentState.status === "calling" && currentState.callId === callId) {
        stopOutgoingRingtone();
        playCallEndedTone();
        endActiveCall();
      }
    }, 38000);
  } catch (err) {
    console.error("Failed to initiate call:", err);
    stopOutgoingRingtone();
    playCallEndedTone();
    endActiveCall();
  }
}

/**
 * Callee accepts the incoming call
 */
export async function acceptIncomingCall(): Promise<void> {
  if (currentState.status !== "ringing" || !currentState.callId) return;

  stopIncomingRingtone();

  const callId = currentState.callId;
  const partnerId = currentState.partnerId!;
  const callType = currentState.callType;
  const chatId = currentState.chatId || "direct";
  const myUserId = registeredUserId || "callee";

  localGatheredIceCandidates = [];
  pendingIceCandidates = [];

  try {
    // 1. Acquire Local Media
    const mediaConstraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };

    let localStream: MediaStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    } catch (mediaErr) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    updateState({ localStream, status: "connected" });
    setupAudioVolumeMeter(localStream);
    playCallConnectedTone();
    startDurationTimer();

    // 2. Setup PeerConnection & Signaling
    const pc = createPeerConnection(chatId, callId, partnerId, myUserId);
    peerConnection = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const signalChannel = supabase.channel(`call_channel_${callId}`, {
      config: { broadcast: { self: false } },
    });
    activeSignalingChannel = signalChannel;

    signalChannel.on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
      if (payload?.callId === callId && payload?.candidate && payload.senderId !== myUserId) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        } else {
          pendingIceCandidates.push(payload.candidate);
        }
      }
    });

    signalChannel.on("broadcast", { event: "call_ended" }, () => {
      endActiveCall();
    });

    signalChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        if (storedIncomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(storedIncomingOffer));
          // Flush pending candidates
          while (pendingIceCandidates.length > 0) {
            const cand = pendingIceCandidates.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          signalChannel.send({
            type: "broadcast",
            event: "call_answered",
            payload: {
              callId,
              answer: { type: answer.type, sdp: answer.sdp },
            },
          });

          // Resend any candidates gathered so far
          for (const cand of localGatheredIceCandidates) {
            signalChannel.send({
              type: "broadcast",
              event: "ice_candidate",
              payload: { callId, senderId: myUserId, candidate: cand },
            });
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed to accept call:", err);
    endActiveCall();
  }
}

/**
 * Callee rejects the incoming call
 */
export function rejectIncomingCall(reason: string = "declined"): void {
  stopIncomingRingtone();
  playCallEndedTone();

  if (activeSignalingChannel) {
    activeSignalingChannel.send({
      type: "broadcast",
      event: "call_rejected",
      payload: { callId: currentState.callId, reason },
    });
  }

  // Also notify partner on user inbox
  if (currentState.partnerId) {
    const partnerInbox = supabase.channel(`call_inbox_${currentState.partnerId}`);
    partnerInbox.send({
      type: "broadcast",
      event: "call_rejected",
      payload: { callId: currentState.callId, reason },
    });
  }

  cleanupMedia();
  updateState({ ...DEFAULT_CALL_STATE, status: "idle" });
}

/**
 * Hangs up active call (both caller and callee)
 */
export function endActiveCall(): void {
  stopOutgoingRingtone();
  stopIncomingRingtone();
  playCallEndedTone();
  stopDurationTimer();
  stopAudioMeter();

  if (activeSignalingChannel) {
    activeSignalingChannel.send({
      type: "broadcast",
      event: "call_ended",
      payload: { callId: currentState.callId },
    });
  }

  // If we were calling and caller cancelled before callee answered
  if (currentState.status === "calling" && currentState.partnerId) {
    const partnerInbox = supabase.channel(`call_inbox_${currentState.partnerId}`);
    partnerInbox.send({
      type: "broadcast",
      event: "call_cancelled",
      payload: { callId: currentState.callId },
    });
    if (currentState.chatId) {
      const chatBroadcast = supabase.channel(`chat_broadcast_${currentState.chatId}`);
      chatBroadcast.send({
        type: "broadcast",
        event: "call_cancelled",
        payload: { callId: currentState.callId },
      });
    }
  }

  cleanupMedia();
  updateState({ ...DEFAULT_CALL_STATE, status: "idle" });
}

function cleanupMedia() {
  if (currentState.localStream) {
    currentState.localStream.getTracks().forEach((track) => track.stop());
  }
  if (currentState.remoteStream) {
    currentState.remoteStream.getTracks().forEach((track) => track.stop());
  }
  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }
  if (activeSignalingChannel) {
    try {
      supabase.removeChannel(activeSignalingChannel);
    } catch (e) {}
    activeSignalingChannel = null;
  }
  if (remoteAudioElement) {
    remoteAudioElement.srcObject = null;
  }
  pendingIceCandidates = [];
  localGatheredIceCandidates = [];
  storedIncomingOffer = null;
}

/**
 * Toggles microphone mute state during active call
 */
export function toggleMicMute(): boolean {
  if (!currentState.localStream) return false;
  const audioTracks = currentState.localStream.getAudioTracks();
  if (audioTracks.length === 0) return false;

  const newMuted = !currentState.isMuted;
  audioTracks.forEach((track) => {
    track.enabled = !newMuted;
  });
  updateState({ isMuted: newMuted });
  return newMuted;
}

/**
 * Toggles video camera on/off during call
 */
export function toggleVideoCamera(): boolean {
  if (!currentState.localStream) return false;
  const videoTracks = currentState.localStream.getVideoTracks();
  if (videoTracks.length === 0) return false;

  const newVideoOff = !currentState.isVideoOff;
  videoTracks.forEach((track) => {
    track.enabled = !newVideoOff;
  });
  updateState({ isVideoOff: newVideoOff });
  return newVideoOff;
}
