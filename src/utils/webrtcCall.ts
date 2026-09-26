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
let callDurationTimer: any = null;
let pendingIceCandidates: RTCIceCandidateInit[] = [];
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
  ],
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

// ---------------------------------------------------------------------------
// PeerConnection Helper
// ---------------------------------------------------------------------------
function createPeerConnection(chatId: string, callId: string, partnerId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate && activeSignalingChannel) {
      activeSignalingChannel.send({
        type: "broadcast",
        event: "ice_candidate",
        payload: {
          callId,
          targetId: partnerId,
          candidate: event.candidate.toJSON(),
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
      playCallConnectedTone();
      startDurationTimer();
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
 * Register the current logged-in user to receive incoming calls across the app
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
  if (userInboxChannel) {
    supabase.removeChannel(userInboxChannel);
  }

  const topic = `call_inbox_${currentUserId}`;
  const chan = supabase.channel(topic, { config: { broadcast: { self: false } } });

  chan.on("broadcast", { event: "incoming_call_invite" }, async ({ payload }) => {
    // If already in a call, send busy
    if (currentState.status !== "idle") {
      chan.send({
        type: "broadcast",
        event: "call_busy",
        payload: { callId: payload.callId, callerId: payload.callerId },
      });
      return;
    }

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

    // Store incoming offer in peer connection state
    (chan as any)._incomingOffer = payload.offer;

    if (onIncomingCallPrompt) {
      onIncomingCallPrompt({
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        callType: payload.callType || "audio",
        chatId: payload.chatId,
      });
    }
  });

  chan.on("broadcast", { event: "call_cancelled" }, () => {
    if (currentState.status === "ringing") {
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
      supabase.removeChannel(userInboxChannel);
      userInboxChannel = null;
    }
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
    const pc = createPeerConnection(chatId, callId, partnerId);
    peerConnection = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // 3. Connect to Supabase Realtime channel for this call
    const signalChannel = supabase.channel(`call_channel_${callId}`, {
      config: { broadcast: { self: false } },
    });
    activeSignalingChannel = signalChannel;

    signalChannel.on("broadcast", { event: "call_answered" }, async ({ payload }) => {
      stopOutgoingRingtone();
      if (pc.signalingState !== "closed") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        // Flush pending ICE candidates
        while (pendingIceCandidates.length > 0) {
          const cand = pendingIceCandidates.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }
    });

    signalChannel.on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
      if (payload.targetId === callerId && payload.candidate) {
        if (pc.remoteDescription) {
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

        // Ring partner's user inbox channel
        const partnerInbox = supabase.channel(`call_inbox_${partnerId}`);
        await partnerInbox.subscribe();
        partnerInbox.send({
          type: "broadcast",
          event: "incoming_call_invite",
          payload: {
            callId,
            chatId,
            callerId,
            callerName,
            callerAvatar,
            callType,
            offer: { type: offer.type, sdp: offer.sdp },
          },
        });
      }
    });

    // 4. Timeout after 35s if no answer
    setTimeout(() => {
      if (currentState.status === "calling") {
        stopOutgoingRingtone();
        playCallEndedTone();
        endActiveCall();
      }
    }, 35000);
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
    const pc = createPeerConnection(chatId, callId, partnerId);
    peerConnection = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const signalChannel = supabase.channel(`call_channel_${callId}`, {
      config: { broadcast: { self: false } },
    });
    activeSignalingChannel = signalChannel;

    signalChannel.on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
      if (payload.targetId !== partnerId && payload.candidate) {
        if (pc.remoteDescription) {
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
        const incomingOffer = (userInboxChannel as any)?._incomingOffer;
        if (incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
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
    peerConnection.close();
    peerConnection = null;
  }
  if (activeSignalingChannel) {
    supabase.removeChannel(activeSignalingChannel);
    activeSignalingChannel = null;
  }
  if (remoteAudioElement) {
    remoteAudioElement.srcObject = null;
  }
  pendingIceCandidates = [];
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
