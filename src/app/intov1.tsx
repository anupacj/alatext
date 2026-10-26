import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Animated,
  PanResponder,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Circle,
  Rect,
  Polygon,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Filter,
  FeDropShadow,
} from "react-native-svg";
import {
  Moon,
  Wifi,
  Battery,
  Heart,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Sparkles,
  Smartphone,
  Eye,
} from "lucide-react-native";

interface SlideData {
  id: number;
  timeRange: string;
  headlineAbode: string;
  subtitleAbode: string;
  headlineAla: string;
  subtitleAla: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    timeRange: "0:00 - 0:02",
    headlineAbode: "Hang out on your phone",
    subtitleAbode:
      "Realtime social widgets with friends, because not everything requires a DM.",
    headlineAla: "Your private sanctuary",
    subtitleAla:
      "A warm, shared space with the one who matters most — beyond just texting.",
  },
  {
    id: 2,
    timeRange: "0:02 - 0:04",
    headlineAbode: "Humanise connection",
    subtitleAbode:
      "Stay close through simple, subtle moments — no pressure, just presence.",
    headlineAla: "Feel close from any distance",
    subtitleAla:
      "Live couple radar, distance syncing, and shared presence wherever you wander.",
  },
  {
    id: 3,
    timeRange: "0:04 - 0:07",
    headlineAbode: "Build your own space",
    subtitleAbode:
      "It's yours. Each widget adds a new way to interact. Play, share, organise.",
    headlineAla: "Curate your own universe",
    subtitleAla:
      "Amoled, Sunset, Nordic themes, custom wallpapers, and Josefin typography.",
  },
  {
    id: 4,
    timeRange: "0:07 - 0:09",
    headlineAbode: "Memories that last",
    subtitleAbode:
      "Each day is summarised in a scrap book style memory. No effort required.",
    headlineAla: "Memories, scrapbooks & sleepy byes",
    subtitleAla:
      "Stacked photo albums, anniversary reminders, and sleepy bye night protection.",
  },
];

export default function IntroV1Screen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const [useAlaCopy, setUseAlaCopy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  // Smooth slide and crossfade animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Continuous subtle floating animations (vertical hover physics)
  const hoverAnim1 = useRef(new Animated.Value(0)).current;
  const hoverAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cycleIconIdx = useRef(new Animated.Value(0)).current;
  const [memIconIndex, setMemIconIndex] = useState(0);

  // Floating hover loop
  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(hoverAnim1, {
          toValue: -12,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(hoverAnim1, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(hoverAnim2, {
          toValue: 10,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(hoverAnim2, {
          toValue: -8,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const heartPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ])
    );

    loop1.start();
    loop2.start();
    heartPulse.start();

    return () => {
      loop1.stop();
      loop2.stop();
      heartPulse.stop();
    };
  }, []);

  // Slide 4 cycling icons timer
  useEffect(() => {
    const interval = setInterval(() => {
      setMemIconIndex((prev) => (prev + 1) % 3);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  // Auto-play timer for slides
  useEffect(() => {
    if (!isPlaying) return;
    const dur = activeSlide === 2 ? 3000 : 2500;
    const timer = setTimeout(() => {
      goToSlide((activeSlide + 1) % SLIDES.length);
    }, dur);
    return () => clearTimeout(timer);
  }, [activeSlide, isPlaying]);

  const goToSlide = (idx: number) => {
    if (idx === activeSlide) return;
    // Crossfade and bounce transition
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: idx > activeSlide ? -16 : 16,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setActiveSlide(idx);
  };

  const handleNext = () => {
    goToSlide((activeSlide + 1) % SLIDES.length);
  };

  const handlePrev = () => {
    goToSlide((activeSlide - 1 + SLIDES.length) % SLIDES.length);
  };

  // Drag gesture for touch swiping
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dy) < 30,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          handleNext();
        } else if (gestureState.dx > 40) {
          handlePrev();
        }
      },
    })
  ).current;

  const current = SLIDES[activeSlide];
  const headline = useAlaCopy ? current.headlineAla : current.headlineAbode;
  const subtitle = useAlaCopy ? current.subtitleAla : current.subtitleAbode;

  // Max width container for desktop preview
  const isDesktop = width >= 600;
  const cardWidth = isDesktop ? 412 : width;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mainWrapper, isDesktop && styles.desktopCenter]}>
        <View
          style={[styles.phoneContainer, { width: cardWidth }]}
          {...panResponder.panHandlers}
        >
          {/* ========================================================= */}
          {/* 1. TOP HEADER & STATUS BAR                                */}
          {/* ========================================================= */}
          <View style={styles.topHeaderArea}>
            {/* iOS Status Bar Row */}
            <View style={styles.statusBarRow}>
              <View style={styles.statusLeft}>
                <Text style={styles.statusTime}>9:41</Text>
                <Moon size={11} color="#0f172a" fill="#0f172a" style={{ marginLeft: 4 }} />
              </View>

              {/* Top Center Pagination (4 dots, active is elongated pill) */}
              <View style={styles.paginationCenter}>
                {SLIDES.map((s, idx) => {
                  const isActive = idx === activeSlide;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => goToSlide(idx)}
                      activeOpacity={0.7}
                      style={[
                        styles.dotBase,
                        isActive ? styles.dotActive : styles.dotInactive,
                      ]}
                    />
                  );
                })}
              </View>

              {/* Status Right (Cellular, Wifi, Battery) */}
              <View style={styles.statusRight}>
                <Wifi size={13} color="#0f172a" style={{ marginRight: 4 }} />
                <Battery size={15} color="#0f172a" />
              </View>
            </View>

            {/* Fixed Top Action Row (Pill Login + Preview Switcher) */}
            <View style={styles.actionHeaderRow}>
              {/* Prototype text toggle pill */}
              <TouchableOpacity
                onPress={() => setUseAlaCopy((v) => !v)}
                style={styles.modeTogglePill}
                activeOpacity={0.75}
              >
                <Sparkles size={12} color="#0284c7" />
                <Text style={styles.modeToggleText}>
                  {useAlaCopy ? "ala thing copy" : "Abode spec copy"}
                </Text>
              </TouchableOpacity>

              {/* Top Right "Login" Button (White pill, light blue outline, blue text) */}
              <TouchableOpacity
                onPress={() => router.push("/auth")}
                style={styles.loginPillBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.loginPillBtnText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 2. UPPER 2/3: ANIMATED GRAPHICS CANVAS                    */}
          {/* ========================================================= */}
          <View style={styles.animationCanvas}>
            <Animated.View
              style={[
                styles.canvasSceneContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              {/* SLIDE 1: INTRODUCTION */}
              {activeSlide === 0 && (
                <View style={styles.sceneBox}>
                  {/* Floating Phone (3D tilted) */}
                  <Animated.View
                    style={[
                      styles.floatingPhone,
                      { transform: [{ translateY: hoverAnim2 }, { rotate: "-14deg" }] },
                    ]}
                  >
                    <View style={styles.mockPhoneBody}>
                      <View style={styles.mockPhoneScreen}>
                        <View style={styles.mockWidgetPill}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0284c7" }} />
                          <View style={styles.mockWidgetLine} />
                        </View>
                      </View>
                    </View>
                  </Animated.View>

                  {/* Main Central Blue Blob with Two Dot Eyes */}
                  <Animated.View
                    style={[
                      styles.mainBlobWrap,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="180" height="180" viewBox="0 0 180 180">
                      <Defs>
                        <RadialGradient id="blueBlobGrad" cx="35%" cy="30%" r="65%">
                          <Stop offset="0%" stopColor="#60a5fa" />
                          <Stop offset="70%" stopColor="#2563eb" />
                          <Stop offset="100%" stopColor="#1d4ed8" />
                        </RadialGradient>
                      </Defs>
                      {/* Organic Blob Silhouette */}
                      <Path
                        d="M 90,15 C 135,10 168,45 168,90 C 168,135 130,165 85,168 C 40,170 12,130 15,85 C 18,40 45,20 90,15 Z"
                        fill="url(#blueBlobGrad)"
                      />
                      {/* Left Dot Eye */}
                      <Circle cx="68" cy="85" r="5" fill="#0f172a" />
                      {/* Right Dot Eye */}
                      <Circle cx="112" cy="85" r="5" fill="#0f172a" />
                      {/* Cute subtle smile */}
                      <Path
                        d="M 82 100 Q 90 108 98 100"
                        stroke="#0f172a"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </Svg>
                  </Animated.View>

                  {/* Orbiting Small Blue Blob */}
                  <Animated.View
                    style={[
                      styles.orbitBlobSmallBlue,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    <Svg width="54" height="54" viewBox="0 0 54 54">
                      <Circle cx="27" cy="27" r="24" fill="#38bdf8" />
                      <Circle cx="22" cy="24" r="2.5" fill="#0c4a6e" />
                      <Circle cx="32" cy="24" r="2.5" fill="#0c4a6e" />
                    </Svg>
                  </Animated.View>

                  {/* Orbiting Red Blob popping out a Heart */}
                  <Animated.View
                    style={[
                      styles.orbitBlobRed,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="60" height="60" viewBox="0 0 60 60">
                      <Circle cx="30" cy="30" r="26" fill="#f43f5e" />
                      <Circle cx="24" cy="28" r="2.5" fill="#fff" />
                      <Circle cx="36" cy="28" r="2.5" fill="#fff" />
                    </Svg>
                    {/* Popping Heart Icon */}
                    <Animated.View
                      style={[
                        styles.poppingHeartBadge,
                        { transform: [{ scale: pulseAnim }] },
                      ]}
                    >
                      <Heart size={14} color="#ffffff" fill="#ffffff" />
                    </Animated.View>
                  </Animated.View>
                </View>
              )}

              {/* SLIDE 2: CONNECTION */}
              {activeSlide === 1 && (
                <View style={styles.sceneBox}>
                  {/* Central Blue Blob */}
                  <Animated.View
                    style={[
                      styles.mainBlobWrap,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="160" height="160" viewBox="0 0 160 160">
                      <Circle cx="80" cy="80" r="70" fill="#2563eb" />
                      <Circle cx="62" cy="75" r="4.5" fill="#ffffff" />
                      <Circle cx="98" cy="75" r="4.5" fill="#ffffff" />
                      <Path
                        d="M 74 90 Q 80 96 86 90"
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </Svg>
                  </Animated.View>

                  {/* Green Blob sliding out top-left */}
                  <Animated.View
                    style={[
                      styles.perimeterBlobGreen,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    <Svg width="64" height="64" viewBox="0 0 64 64">
                      <Circle cx="32" cy="32" r="28" fill="#10b981" />
                      <Circle cx="26" cy="30" r="2.5" fill="#064e3b" />
                      <Circle cx="38" cy="30" r="2.5" fill="#064e3b" />
                    </Svg>
                  </Animated.View>

                  {/* Pink Blob sliding out top-right */}
                  <Animated.View
                    style={[
                      styles.perimeterBlobPink,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="68" height="68" viewBox="0 0 68 68">
                      <Circle cx="34" cy="34" r="30" fill="#ec4899" />
                      <Circle cx="28" cy="32" r="2.5" fill="#831843" />
                      <Circle cx="40" cy="32" r="2.5" fill="#831843" />
                    </Svg>
                  </Animated.View>

                  {/* Orange Blob sliding out bottom-left */}
                  <Animated.View
                    style={[
                      styles.perimeterBlobOrange,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    <Svg width="60" height="60" viewBox="0 0 60 60">
                      <Circle cx="30" cy="30" r="26" fill="#f97316" />
                      <Circle cx="24" cy="28" r="2.5" fill="#7c2d12" />
                      <Circle cx="36" cy="28" r="2.5" fill="#7c2d12" />
                    </Svg>
                  </Animated.View>

                  {/* Red Blob sliding out bottom-right */}
                  <Animated.View
                    style={[
                      styles.perimeterBlobRed,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="58" height="58" viewBox="0 0 58 58">
                      <Circle cx="29" cy="29" r="25" fill="#ef4444" />
                      <Circle cx="23" cy="27" r="2.5" fill="#ffffff" />
                      <Circle cx="35" cy="27" r="2.5" fill="#ffffff" />
                    </Svg>
                  </Animated.View>
                </View>
              )}

              {/* SLIDE 3: CUSTOMIZATION */}
              {activeSlide === 2 && (
                <View style={styles.sceneBox}>
                  {/* Isometric Open Yellow Cardboard Box */}
                  <Animated.View
                    style={[
                      styles.isometricBoxWrap,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="180" height="150" viewBox="0 0 180 150">
                      {/* Box bottom & side shadow */}
                      <Polygon
                        points="90,135 155,100 155,55 90,90"
                        fill="#d97706"
                      />
                      <Polygon
                        points="90,135 25,100 25,55 90,90"
                        fill="#b45309"
                      />
                      {/* Box interior floor */}
                      <Polygon
                        points="90,90 155,55 90,25 25,55"
                        fill="#fef3c7"
                      />
                      {/* Flaps open */}
                      <Polygon
                        points="25,55 2,42 65,15 90,25"
                        fill="#fcd34d"
                      />
                      <Polygon
                        points="155,55 178,42 115,15 90,25"
                        fill="#f59e0b"
                      />
                    </Svg>
                  </Animated.View>

                  {/* 3D Shapes being moved into box */}
                  <Animated.View
                    style={[
                      styles.geometricShapesGroup,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    {/* Green Block */}
                    <Svg width="40" height="40" viewBox="0 0 40 40">
                      <Polygon points="20,5 35,14 20,23 5,14" fill="#34d399" />
                      <Polygon points="20,23 35,14 35,28 20,37" fill="#059669" />
                      <Polygon points="20,23 5,14 5,28 20,37" fill="#10b981" />
                    </Svg>

                    {/* Blue Sphere */}
                    <Svg width="36" height="36" viewBox="0 0 36 36" style={{ marginLeft: 12 }}>
                      <Defs>
                        <RadialGradient id="sphereGrad" cx="35%" cy="35%" r="65%">
                          <Stop offset="0%" stopColor="#93c5fd" />
                          <Stop offset="75%" stopColor="#2563eb" />
                          <Stop offset="100%" stopColor="#1e3a8a" />
                        </RadialGradient>
                      </Defs>
                      <Circle cx="18" cy="18" r="16" fill="url(#sphereGrad)" />
                    </Svg>
                  </Animated.View>

                  {/* Pink Blob floating near top-left moving shapes */}
                  <Animated.View
                    style={[
                      styles.blobTopLeftPink,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    <Svg width="65" height="65" viewBox="0 0 65 65">
                      <Circle cx="32" cy="32" r="28" fill="#f472b6" />
                      <Circle cx="26" cy="30" r="2.5" fill="#831843" />
                      <Circle cx="38" cy="30" r="2.5" fill="#831843" />
                      {/* Little hand reaching down */}
                      <Path d="M 42 42 Q 48 50 42 56" stroke="#f472b6" strokeWidth="5" strokeLinecap="round" />
                    </Svg>
                  </Animated.View>

                  {/* Red Blob floating near bottom-right */}
                  <Animated.View
                    style={[
                      styles.blobBottomRightRed,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="54" height="54" viewBox="0 0 54 54">
                      <Circle cx="27" cy="27" r="23" fill="#f43f5e" />
                      <Circle cx="21" cy="25" r="2.5" fill="#fff" />
                      <Circle cx="33" cy="25" r="2.5" fill="#fff" />
                    </Svg>
                  </Animated.View>
                </View>
              )}

              {/* SLIDE 4: MEMORIES */}
              {activeSlide === 3 && (
                <View style={styles.sceneBox}>
                  {/* Pink Blob on left holding phone */}
                  <Animated.View
                    style={[
                      styles.blobMemoriesLeft,
                      { transform: [{ translateY: hoverAnim1 }] },
                    ]}
                  >
                    <Svg width="110" height="110" viewBox="0 0 110 110">
                      <Circle cx="55" cy="55" r="48" fill="#f472b6" />
                      <Circle cx="44" cy="50" r="4" fill="#831843" />
                      <Circle cx="66" cy="50" r="4" fill="#831843" />
                      <Path
                        d="M 50 64 Q 55 70 60 64"
                        stroke="#831843"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </Svg>

                    {/* Black Phone in Hand */}
                    <View style={styles.heldPhone}>
                      <View style={styles.heldPhoneScreen} />
                    </View>
                  </Animated.View>

                  {/* Emanating White Speech Bubble with Cycling 3D Icons */}
                  <Animated.View
                    style={[
                      styles.speechBubbleCard,
                      { transform: [{ translateY: hoverAnim2 }] },
                    ]}
                  >
                    <View style={styles.speechBubbleInner}>
                      {/* Cycling 3D icons: Yellow Square, Red Star, Pink Triangle */}
                      {memIconIndex === 0 && (
                        <View style={styles.iconCyclingFrame}>
                          <Svg width="46" height="46" viewBox="0 0 46 46">
                            {/* 3D Yellow Square / Cube */}
                            <Polygon points="23,6 40,16 23,26 6,16" fill="#fef08a" />
                            <Polygon points="23,26 40,16 40,32 23,42" fill="#ca8a04" />
                            <Polygon points="23,26 6,16 6,32 23,42" fill="#eab308" />
                          </Svg>
                          <Text style={styles.iconCaption}>Moments</Text>
                        </View>
                      )}

                      {memIconIndex === 1 && (
                        <View style={styles.iconCyclingFrame}>
                          <Svg width="46" height="46" viewBox="0 0 46 46">
                            {/* Red Multi-Point Star */}
                            <Path
                              d="M 23 4 L 28 17 L 42 17 L 31 25 L 35 39 L 23 30 L 11 39 L 15 25 L 4 17 L 18 17 Z"
                              fill="#ef4444"
                            />
                          </Svg>
                          <Text style={styles.iconCaption}>Favorites</Text>
                        </View>
                      )}

                      {memIconIndex === 2 && (
                        <View style={styles.iconCyclingFrame}>
                          <Svg width="46" height="46" viewBox="0 0 46 46">
                            {/* 3D Pink Triangle / Prism */}
                            <Polygon points="23,6 39,36 7,36" fill="#f472b6" />
                            <Polygon points="23,6 39,36 31,40 15,40" fill="#db2777" />
                          </Svg>
                          <Text style={styles.iconCaption}>Journals</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.speechBubbleTail} />
                  </Animated.View>
                </View>
              )}
            </Animated.View>
          </View>

          {/* ========================================================= */}
          {/* 3. BOTTOM 1/3: LIGHT BLUE CURVED WAVE CONTAINER           */}
          {/* ========================================================= */}
          <View style={styles.bottomWaveContainer}>
            {/* Cloud-like curved SVG wave header */}
            <View style={styles.svgWaveWrap}>
              <Svg width={cardWidth} height="40" viewBox={`0 0 ${cardWidth} 40`} preserveAspectRatio="none">
                <Path
                  d={`M 0,25 Q ${cardWidth * 0.25},0 ${cardWidth * 0.5},12 T ${cardWidth},15 L ${cardWidth},40 L 0,40 Z`}
                  fill="#e0f2fe"
                />
              </Svg>
            </View>

            {/* Changing Headline and Subtitle Content */}
            <Animated.View
              style={[
                styles.textContentBox,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.headlineText} numberOfLines={2}>
                {headline}
              </Text>

              <Text style={styles.subtitleText} numberOfLines={3}>
                {subtitle}
              </Text>
            </Animated.View>

            {/* Slider Navigation Bar */}
            <View style={styles.slideControlsRow}>
              <TouchableOpacity
                onPress={handlePrev}
                style={styles.navArrowBtn}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#0369a1" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsPlaying((p) => !p)}
                style={styles.autoPlayBtn}
                activeOpacity={0.7}
              >
                {isPlaying ? (
                  <Pause size={14} color="#0369a1" />
                ) : (
                  <Play size={14} color="#0369a1" />
                )}
                <Text style={styles.autoPlayText}>
                  {current.timeRange}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNext}
                style={styles.navArrowBtn}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color="#0369a1" />
              </TouchableOpacity>
            </View>

            {/* ======================================================= */}
            {/* 4. FOOTER: LEGAL DISCLAIMER & HOME INDICATOR            */}
            {/* ======================================================= */}
            <View style={styles.footerArea}>
              <Text style={styles.legalDisclaimerText}>
                {useAlaCopy
                  ? "By entering ala thing you acknowledge and agree to our Terms of Service & Privacy Policy."
                  : "By joining Abode you acknowledge that you have read and agree to Abode's Terms & Conditions and Privacy Policy."}
              </Text>

              {/* iOS Home Indicator Bar */}
              <View style={styles.homeIndicatorBar} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  mainWrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  desktopCenter: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  phoneContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          maxWidth: 440,
          maxHeight: 900,
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.18)",
          borderRadius: 40,
        } as any)
      : {}),
  },

  /* 1. Header & Navigation */
  topHeaderArea: {
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  statusBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 28,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusTime: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  paginationCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dotBase: {
    height: 8,
    borderRadius: 4,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  dotActive: {
    width: 24,
    backgroundColor: "#0284c7",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#bae6fd",
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modeTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0f2fe",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284c7",
    fontFamily: "Josefin Sans",
  },
  loginPillBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#7dd3fc",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.12)",
        } as any)
      : {}),
  },
  loginPillBtnText: {
    color: "#0284c7",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
  },

  /* 2. Upper 2/3: Animation Canvas */
  animationCanvas: {
    flex: 1.6,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  canvasSceneContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  sceneBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  /* Slide 1 Elements */
  mainBlobWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingPhone: {
    position: "absolute",
    top: "16%",
    right: "14%",
    width: 65,
    height: 115,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    padding: 3,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  mockPhoneBody: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: "#1e293b",
    padding: 4,
  },
  mockPhoneScreen: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  mockWidgetPill: {
    width: "75%",
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 4,
  },
  mockWidgetLine: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#93c5fd",
  },
  orbitBlobSmallBlue: {
    position: "absolute",
    left: "14%",
    top: "32%",
  },
  orbitBlobRed: {
    position: "absolute",
    right: "16%",
    bottom: "22%",
  },
  poppingHeartBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f43f5e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },

  /* Slide 2 Elements */
  perimeterBlobGreen: {
    position: "absolute",
    top: "22%",
    left: "18%",
  },
  perimeterBlobPink: {
    position: "absolute",
    top: "18%",
    right: "18%",
  },
  perimeterBlobOrange: {
    position: "absolute",
    bottom: "22%",
    left: "16%",
  },
  perimeterBlobRed: {
    position: "absolute",
    bottom: "20%",
    right: "18%",
  },

  /* Slide 3 Elements */
  isometricBoxWrap: {
    position: "absolute",
    bottom: "16%",
  },
  geometricShapesGroup: {
    position: "absolute",
    top: "30%",
    flexDirection: "row",
    alignItems: "center",
  },
  blobTopLeftPink: {
    position: "absolute",
    top: "16%",
    left: "18%",
  },
  blobBottomRightRed: {
    position: "absolute",
    bottom: "18%",
    right: "18%",
  },

  /* Slide 4 Elements */
  blobMemoriesLeft: {
    position: "absolute",
    left: "12%",
    alignItems: "center",
    justifyContent: "center",
  },
  heldPhone: {
    position: "absolute",
    bottom: -6,
    right: -10,
    width: 32,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    padding: 2,
  },
  heldPhoneScreen: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: "#38bdf8",
  },
  speechBubbleCard: {
    position: "absolute",
    right: "14%",
    top: "28%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    elevation: 8,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  speechBubbleInner: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
    minHeight: 70,
  },
  iconCyclingFrame: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  iconCaption: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Josefin Sans",
  },
  speechBubbleTail: {
    position: "absolute",
    bottom: -8,
    left: 20,
    width: 14,
    height: 14,
    backgroundColor: "#ffffff",
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#e2e8f0",
    transform: [{ rotate: "45deg" }],
  },

  /* 3. Bottom 1/3: Light Blue Wave Container */
  bottomWaveContainer: {
    flex: 1.15,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 14 : 10,
    position: "relative",
    justifyContent: "space-between",
  },
  svgWaveWrap: {
    position: "absolute",
    top: -24,
    left: 0,
    right: 0,
  },
  textContentBox: {
    marginTop: 18,
  },
  headlineText: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Josefin Sans",
    lineHeight: 33,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#334155",
    fontFamily: "Josefin Sans",
    lineHeight: 22,
  },

  slideControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  navArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  autoPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  autoPlayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369a1",
    fontFamily: "Josefin Sans",
  },

  /* 4. Footer */
  footerArea: {
    alignItems: "center",
    paddingTop: 4,
  },
  legalDisclaimerText: {
    fontSize: 10.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 14,
    fontFamily: "Josefin Sans",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  homeIndicatorBar: {
    width: 135,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: "#0f172a",
    opacity: 0.7,
  },
});
