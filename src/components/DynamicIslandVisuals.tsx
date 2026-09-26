import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform, TouchableOpacity } from "react-native";
import { User, Heart, ChevronLeft, MoreVertical, Volume2 } from "lucide-react-native";
import { NotchConfig } from "../utils/notchConfig";

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

// --- INTERACTIVE CALIBRATION PREVIEW FOR SETTINGS ---
export function DynamicIslandPreviewMockup({
  notchConfig,
  theme,
  testTyping = false,
  testAudio = false,
  testHeart = false,
}: {
  notchConfig: NotchConfig;
  theme: any;
  testTyping?: boolean;
  testAudio?: boolean;
  testHeart?: boolean;
}) {
  const isAmoled = theme?.id === "black";
  const { mode, topOffset, islandHeight, dynamicAnimationsEnabled, cameraTargetGuide } = notchConfig;

  // Compute mock paddingTop based on profile
  let mockPaddingTop = 26;
  if (mode === "dynamic_island") {
    mockPaddingTop = Math.max(6, 14 + topOffset);
  } else if (mode === "floating_breathe") {
    mockPaddingTop = 38 + topOffset;
  } else if (mode === "edge_dot") {
    mockPaddingTop = 28 + topOffset;
  } else {
    mockPaddingTop = 26 + topOffset;
  }

  const effectiveHeight = mode === "dynamic_island" ? (islandHeight || 46) : 46;

  return (
    <View style={visualStyles.mockupFrame}>
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
        {/* Back Button Pill */}
        <View
          style={[
            visualStyles.mockupBackPill,
            { height: effectiveHeight, borderRadius: effectiveHeight / 2 },
          ]}
        >
          <ChevronLeft size={18} color="#ffffff" />
        </View>

        {/* Center Dynamic Island Pill */}
        <View
          style={[
            visualStyles.mockupCenterPill,
            {
              height: effectiveHeight,
              borderRadius: effectiveHeight / 2,
              backgroundColor: mode === "dynamic_island"
                ? (isAmoled ? "#000000" : "rgba(15, 17, 23, 0.95)")
                : "rgba(255, 255, 255, 0.08)",
              borderColor: testHeart
                ? "#f43f5e"
                : mode === "dynamic_island"
                ? "rgba(255, 255, 255, 0.18)"
                : "rgba(255, 255, 255, 0.12)",
            },
            testHeart && {
              shadowColor: "#f43f5e",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 8,
              ...(Platform.OS === "web" ? { boxShadow: "0 0 16px rgba(244, 63, 94, 0.6)" } : {}),
            },
          ]}
        >
          {/* Avatar */}
          <View
            style={[
              visualStyles.mockupAvatar,
              {
                width: effectiveHeight - 12,
                height: effectiveHeight - 12,
                borderRadius: (effectiveHeight - 12) / 2,
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

        {/* Right Action Pill */}
        <View
          style={[
            visualStyles.mockupRightPill,
            { height: effectiveHeight, borderRadius: effectiveHeight / 2 },
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
      <View style={visualStyles.mockupChatContent}>
        <View style={visualStyles.mockupChatBubbleLeft}>
          <Text style={visualStyles.mockupBubbleText}>Hey! Notice how smooth this looks?</Text>
        </View>
        <View style={visualStyles.mockupChatBubbleRight}>
          <Text style={visualStyles.mockupBubbleTextRight}>Camera cutout aligns cleanly now!</Text>
        </View>
      </View>
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
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
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
