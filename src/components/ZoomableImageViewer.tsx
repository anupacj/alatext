import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
} from "react-native";
import {
  Download,
  Copy,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react-native";

export interface ZoomableImageViewerProps {
  visible: boolean;
  imageUrl?: string | null;
  images?: string[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (url: string) => void;
  onCopy?: (url: string) => void;
  viewerToast?: string | null;
}

export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({
  visible,
  imageUrl,
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  onCopy,
  viewerToast,
}) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const containerRef = useRef<any>(null);
  const dragStartRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  // Consolidate images list
  const activeImages = useMemo(() => {
    if (images && images.length > 0) return images;
    if (imageUrl) return [imageUrl];
    return [];
  }, [images, imageUrl]);

  const totalImages = activeImages.length;
  const currentUrl = activeImages[currentIndex] || imageUrl || "";

  // Reset transformations and sync index when image list changes or viewer is opened
  useEffect(() => {
    if (visible) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setIsDragging(false);
      const safeIdx = typeof initialIndex === "number" ? Math.max(0, Math.min(initialIndex, totalImages - 1)) : 0;
      setCurrentIndex(safeIdx >= 0 ? safeIdx : 0);
    }
  }, [visible, initialIndex, totalImages]);

  // Navigation handlers (WEB ONLY carousel)
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalImages - 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setCurrentIndex((prev) => Math.min(totalImages - 1, prev + 1));
    }
  }, [currentIndex, totalImages]);

  // Zoom helpers
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(5, Number((prev + 0.5).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(2)));
      if (next === 1) {
        setTranslate({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleDoubleTap = useCallback(() => {
    setScale((prev) => {
      if (prev > 1) {
        setTranslate({ x: 0, y: 0 });
        return 1;
      } else {
        return 2.5;
      }
    });
  }, []);

  // Web mouse wheel, keyboard navigation & shortcuts
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    const el = containerRef.current as HTMLElement | null;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setScale((prev) => {
        const next = Math.min(5, Math.max(1, Number((prev + delta).toFixed(2))));
        if (next === 1) {
          setTranslate({ x: 0, y: 0 });
        }
        return next;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleResetZoom();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Pointer/Mouse Drag on Web
  const handlePointerDown = (e: any) => {
    if (e.button !== 0 && e.nativeEvent?.button !== 0) return; // only left click
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startTx: translate.x,
      startTy: translate.y,
    };
    if (e.target?.setPointerCapture && e.pointerId) {
      try { e.target.setPointerCapture(e.pointerId); } catch {}
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging || !dragStartRef.current) return;
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    if (scale > 1) {
      setTranslate({
        x: dragStartRef.current.startTx + dx,
        y: dragStartRef.current.startTy + dy,
      });
    }
  };

  const handlePointerUp = (e: any) => {
    if (isDragging && dragStartRef.current) {
      const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
      const dx = clientX - dragStartRef.current.x;

      // Web gesture: Swipe left/right when at 1x scale to change photo
      if (Platform.OS === "web" && scale === 1 && totalImages > 1) {
        if (dx < -60) {
          handleNext();
        } else if (dx > 60) {
          handlePrev();
        }
      }

      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  // Touch Pinch & Pan for Mobile (single photo handling preserved)
  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (!touches) return;

    if (touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    } else if (touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1) {
        dragStartRef.current = {
          x: touches[0].pageX,
          y: touches[0].pageY,
          startTx: translate.x,
          startTy: translate.y,
        };
      }
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (!touches) return;

    if (touches.length === 2 && touchDistanceRef.current) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / touchDistanceRef.current;
      setScale((prev) => Math.min(5, Math.max(1, Number((prev * factor).toFixed(2)))));
      touchDistanceRef.current = dist;
    } else if (touches.length === 1 && dragStartRef.current && scale > 1) {
      const dx = touches[0].pageX - dragStartRef.current.x;
      const dy = touches[0].pageY - dragStartRef.current.y;
      setTranslate({
        x: dragStartRef.current.startTx + dx,
        y: dragStartRef.current.startTy + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    dragStartRef.current = null;
  };

  if (!visible || !currentUrl) return null;

  const isWeb = Platform.OS === "web";
  const hasMultiple = totalImages > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Main Image Viewport */}
        <View
          ref={containerRef}
          style={styles.imageContainer}
          // @ts-ignore
          onPointerDown={isWeb ? handlePointerDown : undefined}
          // @ts-ignore
          onPointerMove={isWeb ? handlePointerMove : undefined}
          // @ts-ignore
          onPointerUp={isWeb ? handlePointerUp : undefined}
          onTouchStart={!isWeb ? handleTouchStart : undefined}
          onTouchMove={!isWeb ? handleTouchMove : undefined}
          onTouchEnd={!isWeb ? handleTouchEnd : undefined}
        >
          <Image
            source={{ uri: currentUrl }}
            style={[
              styles.fullImage,
              {
                transform: [
                  { scale },
                  { translateX: translate.x / scale },
                  { translateY: translate.y / scale },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* WEB ONLY: Left Chevron Arrow Button */}
        {isWeb && hasMultiple && currentIndex > 0 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnLeft]}
            onPress={handlePrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous photo"
          >
            <ChevronLeft size={28} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* WEB ONLY: Right Chevron Arrow Button */}
        {isWeb && hasMultiple && currentIndex < totalImages - 1 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnRight]}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityLabel="Next photo"
          >
            <ChevronRight size={28} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* WEB ONLY: Top-Left Clump Counter Pill */}
        {isWeb && hasMultiple && (
          <View style={styles.counterBadge}>
            <Layers size={14} color="#f43f5e" />
            <Text style={styles.counterBadgeText}>
              {currentIndex + 1} / {totalImages}
            </Text>
          </View>
        )}

        {/* Top-Right Floating Toolbar */}
        <View style={styles.toolbar}>
          {/* Zoom Out */}
          <TouchableOpacity
            style={[styles.toolBtn, scale <= 1 && styles.toolBtnDisabled]}
            onPress={handleZoomOut}
            disabled={scale <= 1}
            accessibilityLabel="Zoom out"
          >
            <ZoomOut size={17} color={scale <= 1 ? "rgba(255,255,255,0.3)" : "#ffffff"} />
          </TouchableOpacity>

          {/* Zoom Badge */}
          <TouchableOpacity
            style={styles.zoomBadge}
            onPress={handleResetZoom}
            accessibilityLabel="Reset zoom"
          >
            <Text style={styles.zoomBadgeText}>{Math.round(scale * 100)}%</Text>
          </TouchableOpacity>

          {/* Zoom In */}
          <TouchableOpacity
            style={[styles.toolBtn, scale >= 5 && styles.toolBtnDisabled]}
            onPress={handleZoomIn}
            disabled={scale >= 5}
            accessibilityLabel="Zoom in"
          >
            <ZoomIn size={17} color={scale >= 5 ? "rgba(255,255,255,0.3)" : "#ffffff"} />
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          {/* Download Button */}
          {onDownload && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => onDownload(currentUrl)}
              accessibilityLabel="Download photo"
            >
              <Download size={17} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Copy Button */}
          {onCopy && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => onCopy(currentUrl)}
              accessibilityLabel="Copy photo"
            >
              <Copy size={17} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Open Original in Web */}
          {isWeb && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => window.open(currentUrl, "_blank")}
              accessibilityLabel="Open original"
            >
              <ExternalLink size={17} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.toolBtn, styles.closeBtn]}
            onPress={onClose}
            accessibilityLabel="Close viewer"
          >
            <X size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* WEB ONLY: Bottom Thumbnail Strip for Album Clumps */}
        {isWeb && hasMultiple && (
          <View style={styles.thumbnailStripContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStripContent}
            >
              {activeImages.map((uri, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <TouchableOpacity
                    key={`${uri}-${idx}`}
                    onPress={() => {
                      setScale(1);
                      setTranslate({ x: 0, y: 0 });
                      setCurrentIndex(idx);
                    }}
                    style={[
                      styles.thumbnailItem,
                      isActive && styles.thumbnailItemActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri }} style={styles.thumbnailImg} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bottom Zoom & Pan Hint */}
        {scale > 1 && (
          <View style={[styles.panHint, isWeb && hasMultiple && { bottom: 90 }]}>
            <Text style={styles.panHintText}>Drag to pan • Double-tap or click % to reset</Text>
          </View>
        )}

        {/* Viewer Toast Notification */}
        {viewerToast && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{viewerToast}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fullImage: {
    width: "100%",
    height: "85%",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(24, 24, 30, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    zIndex: 2000,
    marginTop: -26,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
          transition: "transform 0.15s ease, background-color 0.15s ease",
        } as any)
      : {}),
  },
  navBtnLeft: {
    left: 24,
  },
  navBtnRight: {
    right: 24,
  },
  counterBadge: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 52,
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(18, 18, 22, 0.85)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    zIndex: 1000,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        } as any)
      : {}),
  },
  counterBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    letterSpacing: 0.5,
  },
  toolbar: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 52,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 22, 0.82)",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    zIndex: 1000,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        } as any)
      : {}),
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  toolBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === "web" ? ({ cursor: "default" } as any) : {}),
  },
  closeBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    marginLeft: 2,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 3,
  },
  zoomBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    minWidth: 46,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  zoomBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    letterSpacing: 0.3,
  },
  thumbnailStripContainer: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 1500,
  },
  thumbnailStripContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(18, 18, 24, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    maxWidth: "90%",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        } as any)
      : {}),
  },
  thumbnailItem: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    opacity: 0.5,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
          transition: "opacity 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
        } as any)
      : {}),
  },
  thumbnailItemActive: {
    borderColor: "#f43f5e",
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
  },
  panHint: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 1000,
  },
  panHintText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontFamily: "Josefin Sans",
  },
  toastContainer: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(24, 24, 28, 0.94)",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    zIndex: 1001,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Josefin Sans",
    fontWeight: "600",
  },
});

export default ZoomableImageViewer;
