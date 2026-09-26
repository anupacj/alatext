import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform, TouchableOpacity } from "react-native";
import { User, Heart, ChevronLeft, MoreVertical, Volume2, Phone, Video, PhoneOff, Mic, MicOff, ChevronUp, Sparkles, Info } from "lucide-react-native";
import { NotchConfig, DynamicIslandAudioEvent } from "../utils/notchConfig";

// --- FORMAT DURATION HELPER ---
export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// --- ANIMATED EQUALIZER BARS ---
export function DynamicEqualizerBars({
  color = "#10b981",
  active = true,
}: {
  color?: string;
  active?: boolean;
}) {
  const anim1 = useRef(new Animated.Value(4)).current;
  const anim2 = useRef(new Animated.Value(10)).current;
  const anim3 = useRef(new Animated.Value(6)).current;
  const anim4 = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!active) {
      anim1.setValue(4);
      anim2.setValue(4);
      anim3.setValue(4);
      anim4.setValue(4);
      return;
    }

    const createLoop = (anim: Animated.Value, minVal: number, maxVal: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: maxVal,
            duration: duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: minVal,
            duration: duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const loop1 = createLoop(anim1, 3, 14, 320);
    const loop2 = createLoop(anim2, 4, 16, 440);
    const loop3 = createLoop(anim3, 3, 12, 360);
    const loop4 = createLoop(anim4, 4, 15, 480);

    loop1.start();
    loop2.start();
    loop3.start();
    loop4.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      loop4.stop();
    };
  }, [active]);

  return (
    <View style={visualStyles.equalizerRow}>
      <Animated.View style={[visualStyles.eqBar, { backgroundColor: color, height: anim1 }]} />
      <Animated.View style={[visualStyles.eqBar, { backgroundColor: color, height: anim2 }]} />
      <Animated.View style={[visualStyles.eqBar, { backgroundColor: color, height: anim3 }]} />
      <Animated.View style={[visualStyles.eqBar, { backgroundColor: color, height: anim4 }]} />
    </View>
  );
}

// --- ANIMATED TYPING DOTS ---
export function DynamicTypingDots({
  color = "#5865F2",
  active = true,
}: {
  color?: string;
  active?: boolean;
}) {
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!active) {
      dot1.setValue(0.4);
      dot2.setValue(0.4);
      dot3.setValue(0.4);
      return;
    }

    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.delay(Math.max(0, 400 - delay)),
        ])
      );
    };

    const l1 = animateDot(dot1, 0);
    const l2 = animateDot(dot2, 160);
    const l3 = animateDot(dot3, 320);

    l1.start();
    l2.start();
    l3.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [active]);

  return (
    <View style={visualStyles.typingRow}>
      <Animated.View
        style={[
          visualStyles.typingDot,
          {
            backgroundColor: color,
            opacity: dot1,
            transform: [
              {
                scale: dot1.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [0.75, 1.25],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          visualStyles.typingDot,
          {
            backgroundColor: color,
            opacity: dot2,
            transform: [
              {
                scale: dot2.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [0.75, 1.25],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          visualStyles.typingDot,
          {
            backgroundColor: color,
            opacity: dot3,
            transform: [
              {
                scale: dot3.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [0.75, 1.25],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

// --- CAMERA TARGET CROSSHAIR GUIDE ---
export function DynamicCameraGuide({
  topOffset = 0,
  size = 20,
}: {
  topOffset?: number;
  size?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        visualStyles.guideContainer,
        {
          top: Math.max(4, 14 + topOffset),
          width: size,
          height: size,
          transform: [{ translateX: -size / 2 }],
        },
      ]}
    >
      <View style={[visualStyles.guideRing, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={visualStyles.guideCenterDot} />
      </View>
      <View style={visualStyles.guideCrossH} />
      <View style={visualStyles.guideCrossV} />
    </View>
  );
}

// --- EXPANDED DYNAMIC ISLAND CARD VIEW ---
export function DynamicIslandExpandedView({
  targetUser,
  theme,
  audioState,
  isTyping,
  typingUsername,
  isCalling = false,
  callDuration = 0,
  callType = "audio",
  onStartCall,
  onEndCall,
  onHeartPing,
  onOpenChatInfo,
  onCollapse,
}: {
  targetUser?: any;
  theme?: any;
  audioState?: DynamicIslandAudioEvent;
  isTyping?: boolean;
  typingUsername?: string | null;
  isCalling?: boolean;
  callDuration?: number;
  callType?: "audio" | "video";
  onStartCall: (type: "audio" | "video") => void;
  onEndCall: () => void;
  onHeartPing: () => void;
  onOpenChatInfo: () => void;
  onCollapse: () => void;
}) {
  const contactName =
    targetUser?.nickname || targetUser?.display_name || targetUser?.username || "Partner";

  return (
    <View style={visualStyles.expandedContainer}>
      {/* Top Header Row */}
      <View style={visualStyles.expandedTopRow}>
        <View
          style={[
            visualStyles.expandedAvatar,
            { backgroundColor: isCalling ? "#10b981" : theme?.accent || "#5865F2" },
          ]}
        >
          {isCalling ? (
            callType === "video" ? <Video size={16} color="#ffffff" /> : <Phone size={16} color="#ffffff" />
          ) : (
            <User size={16} color="#ffffff" />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 10, justifyContent: "center" }}>
          <Text style={visualStyles.expandedTitle} numberOfLines={1}>
            {contactName}
          </Text>

          {isCalling ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[visualStyles.expandedSubtitle, { color: "#10b981", fontWeight: "bold" }]}>
                {formatCallDuration(callDuration)}
              </Text>
              <Text style={visualStyles.expandedSubtitle}>
                • {callType === "video" ? "HD Video Active" : "HD Audio Connected"}
              </Text>
            </View>
          ) : audioState?.isPlaying ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[visualStyles.expandedSubtitle, { color: "#10b981", fontWeight: "bold" }]} numberOfLines={1}>
                {audioState.title ? `Playing ${audioState.title}` : "Voice Note Playing"}
              </Text>
              <DynamicEqualizerBars color="#10b981" active={true} />
            </View>
          ) : isTyping ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[visualStyles.expandedSubtitle, { color: theme?.accent || "#5865F2", fontWeight: "bold" }]}>
                {typingUsername ? `${typingUsername} is typing` : "typing message..."}
              </Text>
              <DynamicTypingDots color={theme?.accent || "#5865F2"} active={true} />
            </View>
          ) : (
            <Text style={visualStyles.expandedSubtitle}>
              ● Online • Dynamic Island Connected
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={visualStyles.expandedCollapseBtn}
          onPress={onCollapse}
          activeOpacity={0.7}
          accessibilityLabel="Collapse Island"
        >
          <ChevronUp size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Middle/Bottom Actions */}
      {isCalling ? (
        <View style={visualStyles.callingRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={visualStyles.callingPulseRing}>
              <DynamicEqualizerBars color="#10b981" active={true} />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Josefin Sans" }}>
              Audio Streaming
            </Text>
          </View>

          <TouchableOpacity
            style={visualStyles.callHangupBtn}
            onPress={onEndCall}
            activeOpacity={0.8}
          >
            <PhoneOff size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={visualStyles.callHangupText}>End Call</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={visualStyles.quickActionsRow}>
          <TouchableOpacity
            style={visualStyles.quickActionBtn}
            onPress={() => onStartCall("audio")}
            activeOpacity={0.75}
          >
            <View style={[visualStyles.quickActionIconBox, { backgroundColor: "rgba(16, 185, 129, 0.2)" }]}>
              <Phone size={15} color="#10b981" />
            </View>
            <Text style={visualStyles.quickActionText}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={visualStyles.quickActionBtn}
            onPress={() => onStartCall("video")}
            activeOpacity={0.75}
          >
            <View style={[visualStyles.quickActionIconBox, { backgroundColor: "rgba(168, 85, 247, 0.2)" }]}>
              <Video size={15} color="#a855f7" />
            </View>
            <Text style={visualStyles.quickActionText}>Video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={visualStyles.quickActionBtn}
            onPress={onHeartPing}
            activeOpacity={0.75}
          >
            <View style={[visualStyles.quickActionIconBox, { backgroundColor: "rgba(244, 63, 94, 0.2)" }]}>
              <Heart size={15} color="#f43f5e" fill="#f43f5e" />
            </View>
            <Text style={visualStyles.quickActionText}>Heart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={visualStyles.quickActionBtn}
            onPress={onOpenChatInfo}
            activeOpacity={0.75}
          >
            <View style={[visualStyles.quickActionIconBox, { backgroundColor: "rgba(255, 255, 255, 0.12)" }]}>
              <Info size={15} color="#ffffff" />
            </View>
            <Text style={visualStyles.quickActionText}>Info</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// --- INTERACTIVE CALIBRATION PREVIEW FOR SETTINGS ---
export function DynamicIslandPreviewMockup({
  notchConfig,
  theme,
  testTyping = false,
  testAudio = false,
  testHeart = false,
  testExpanded = false,
  testCalling = false,
}: {
  notchConfig: NotchConfig;
  theme: any;
  testTyping?: boolean;
  testAudio?: boolean;
  testHeart?: boolean;
  testExpanded?: boolean;
  testCalling?: boolean;
}) {
  const isAmoled = theme?.id === "black";
  const { mode, topOffset, islandHeight, dynamicAnimationsEnabled, cameraTargetGuide } = notchConfig;

  let mockPaddingTop = 24;
  if (mode === "dynamic_island") {
    mockPaddingTop = Math.max(6, 12 + topOffset);
  } else if (mode === "floating_breathe") {
    mockPaddingTop = 38 + topOffset;
  } else if (mode === "edge_dot") {
    mockPaddingTop = 26 + topOffset;
  } else {
    mockPaddingTop = 24 + topOffset;
  }

  const isWideActive = testTyping || testAudio || testHeart;
  const isBigCard = (testExpanded || testCalling) && mode === "dynamic_island";
  const effectiveHeight = isBigCard ? 130 : mode === "dynamic_island" ? (islandHeight || 46) : 46;

  // Spring push away simulation for side pills
  const sidePillShift = isBigCard ? 50 : isWideActive ? 12 : 0;
  const sidePillOpacity = isBigCard ? 0 : 1;

  return (
    <View style={[visualStyles.mockupFrame, isBigCard && { height: 230 }]}>
      {/* Phone chassis top bezel */}
      <View style={visualStyles.mockupChassisBezel}>
        <View style={visualStyles.mockupSpeakerEarpiece} />
      </View>

      {/* Camera punch-hole simulation */}
      <View
        style={[
          visualStyles.mockupCameraPunchHole,
          mode === "edge_dot" && { left: 24, transform: [] },
        ]}
      >
        <View style={visualStyles.mockupCameraLens} />
      </View>

      {/* Target Reticle if enabled */}
      {cameraTargetGuide && (
        <View
          style={[
            visualStyles.mockupTargetReticle,
            mode === "edge_dot" ? { left: 24, transform: [] } : { left: "50%", transform: [{ translateX: -12 }] },
          ]}
        >
          <View style={visualStyles.mockupTargetInner} />
        </View>
      )}

      {/* Header Container inside Mockup */}
      <View style={[visualStyles.mockupHeaderRow, { paddingTop: mockPaddingTop }]}>
        {/* Back Button Pill (Pushed away to the left) */}
        <View
          style={[
            visualStyles.mockupBackPill,
            {
              height: 46,
              borderRadius: 23,
              transform: [{ translateX: -sidePillShift }],
              opacity: sidePillOpacity,
            },
          ]}
        >
          <ChevronLeft size={18} color="#ffffff" />
        </View>

        {/* Center Dynamic Island Pill (Expands larger) */}
        <View
          style={[
            visualStyles.mockupCenterPill,
            {
              height: effectiveHeight,
              borderRadius: isBigCard ? 24 : effectiveHeight / 2,
              backgroundColor: mode === "dynamic_island"
                ? (isAmoled ? "#000000" : "rgba(10, 12, 18, 0.96)")
                : "rgba(255, 255, 255, 0.08)",
              borderColor: testHeart
                ? "#f43f5e"
                : mode === "dynamic_island"
                ? "rgba(255, 255, 255, 0.18)"
                : "rgba(255, 255, 255, 0.12)",
              marginHorizontal: isBigCard ? -40 : isWideActive ? -8 : 0,
            },
            testHeart && {
              shadowColor: "#f43f5e",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 14,
              elevation: 8,
              ...(Platform.OS === "web" ? { boxShadow: "0 0 16px rgba(244, 63, 94, 0.6)" } : {}),
            },
          ]}
        >
          {isBigCard ? (
            <View style={{ flex: 1, padding: 10, justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={[
                    visualStyles.expandedAvatar,
                    { backgroundColor: testCalling ? "#10b981" : theme?.accent || "#5865F2" },
                  ]}
                >
                  {testCalling ? <Phone size={14} color="#fff" /> : <User size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={visualStyles.mockupTitle} numberOfLines={1}>
                    Partner
                  </Text>
                  <Text style={[visualStyles.mockupSubtext, testCalling && { color: "#10b981", fontWeight: "bold" }]}>
                    {testCalling ? "00:18 • Calling HD..." : "● Online • Spring Expanded"}
                  </Text>
                </View>
                <View style={visualStyles.expandedCollapseBtn}>
                  <ChevronUp size={14} color="#fff" />
                </View>
              </View>

              {testCalling ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
                  <DynamicEqualizerBars color="#10b981" active={true} />
                  <View style={visualStyles.callHangupBtn}>
                    <PhoneOff size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>End</Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 8 }}>
                  <View style={visualStyles.mockActionChip}><Text style={{ fontSize: 10, color: "#10b981" }}>📞 Audio</Text></View>
                  <View style={visualStyles.mockActionChip}><Text style={{ fontSize: 10, color: "#a855f7" }}>📹 Video</Text></View>
                  <View style={visualStyles.mockActionChip}><Text style={{ fontSize: 10, color: "#f43f5e" }}>💖 Heart</Text></View>
                  <View style={visualStyles.mockActionChip}><Text style={{ fontSize: 10, color: "#38bdf8" }}>ℹ️ Info</Text></View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
              {/* Avatar */}
              <View
                style={[
                  visualStyles.mockupAvatar,
                  {
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: theme?.accent || "#5865F2",
                  },
                ]}
              >
                <User size={14} color="#ffffff" />
              </View>

              {/* Titles & Indicators */}
              <View style={{ flex: 1, marginLeft: 8, justifyContent: "center" }}>
                <Text style={visualStyles.mockupTitle} numberOfLines={1}>
                  {testAudio && dynamicAnimationsEnabled
                    ? "Voice Note (0:42)"
                    : testTyping && dynamicAnimationsEnabled
                    ? "Partner"
                    : "Partner"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {testAudio && dynamicAnimationsEnabled ? (
                    <Text style={[visualStyles.mockupSubtext, { color: "#10b981" }]}>
                      Playing audio letter...
                    </Text>
                  ) : testTyping && dynamicAnimationsEnabled ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[visualStyles.mockupSubtext, { color: theme?.accent || "#5865F2" }]}>
                        typing
                      </Text>
                      <DynamicTypingDots color={theme?.accent || "#5865F2"} active={true} />
                    </View>
                  ) : (
                    <Text style={visualStyles.mockupSubtext}>
                      ● Online
                    </Text>
                  )}
                </View>
              </View>

              {/* Right Action within Island */}
              {dynamicAnimationsEnabled && testAudio ? (
                <View style={{ marginRight: 8 }}>
                  <DynamicEqualizerBars color="#10b981" active={true} />
                </View>
              ) : dynamicAnimationsEnabled && testTyping ? (
                <View style={{ marginRight: 8 }}>
                  <DynamicTypingDots color={theme?.accent || "#5865F2"} active={true} />
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Right Action Pill (Pushed away to the right) */}
        <View
          style={[
            visualStyles.mockupRightPill,
            {
              height: 46,
              borderRadius: 23,
              transform: [{ translateX: sidePillShift }],
              opacity: sidePillOpacity,
            },
          ]}
        >
          <Heart
            size={16}
            color={testHeart ? "#f43f5e" : "rgba(255, 255, 255, 0.4)"}
            fill={testHeart ? "#f43f5e" : "transparent"}
          />
          <MoreVertical size={16} color="rgba(255, 255, 255, 0.7)" />
        </View>
      </View>

      {/* Screen mock chat space */}
      {!isBigCard && (
        <View style={visualStyles.mockupChatContent}>
          <View style={visualStyles.mockupChatBubbleLeft}>
            <Text style={visualStyles.mockupBubbleText}>Notice the spring physics pushing pills away!</Text>
          </View>
          <View style={visualStyles.mockupChatBubbleRight}>
            <Text style={visualStyles.mockupBubbleTextRight}>Center capsule expands smoothly.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const visualStyles = StyleSheet.create({
  equalizerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 16,
  },
  eqBar: {
    width: 3,
    borderRadius: 1.5,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  guideContainer: {
    position: "absolute",
    left: "50%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  guideRing: {
    borderWidth: 1.5,
    borderColor: "#06b6d4",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(6, 182, 212, 0.15)",
  },
  guideCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#06b6d4",
  },
  guideCrossH: {
    position: "absolute",
    width: 14,
    height: 1,
    backgroundColor: "rgba(6, 182, 212, 0.6)",
  },
  guideCrossV: {
    position: "absolute",
    height: 14,
    width: 1,
    backgroundColor: "rgba(6, 182, 212, 0.6)",
  },
  expandedContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: "space-between",
  },
  expandedTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Josefin Sans",
  },
  expandedSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontFamily: "Josefin Sans",
    marginTop: 1,
  },
  expandedCollapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  quickActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  quickActionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  callingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  callingPulseRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  callHangupBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  callHangupText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Josefin Sans",
  },
  mockupFrame: {
    width: "100%",
    height: 190,
    backgroundColor: "#0d0f14",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  mockupChassisBezel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: "#050608",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  mockupSpeakerEarpiece: {
    width: 38,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#22252e",
  },
  mockupCameraPunchHole: {
    position: "absolute",
    top: 9,
    left: "50%",
    transform: [{ translateX: -6 }],
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#1e222d",
    zIndex: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  mockupCameraLens: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#0b1526",
  },
  mockupTargetReticle: {
    position: "absolute",
    top: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#06b6d4",
    borderStyle: "dashed",
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    zIndex: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  mockupTargetInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#06b6d4",
  },
  mockupHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    gap: 6,
    zIndex: 20,
  },
  mockupBackPill: {
    width: 36,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  mockupCenterPill: {
    flex: 1,
    borderWidth: 1,
    overflow: "hidden",
  },
  mockupAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  mockupTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Josefin Sans",
  },
  mockupSubtext: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10,
    fontFamily: "Josefin Sans",
  },
  mockupRightPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  mockActionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  mockupChatContent: {
    flex: 1,
    padding: 12,
    justifyContent: "flex-end",
    gap: 6,
  },
  mockupChatBubbleLeft: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    maxWidth: "80%",
  },
  mockupChatBubbleRight: {
    alignSelf: "flex-end",
    backgroundColor: "#5865F2",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    maxWidth: "80%",
  },
  mockupBubbleText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontFamily: "Josefin Sans",
  },
  mockupBubbleTextRight: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Josefin Sans",
  },
});
