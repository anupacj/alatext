import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import {
  Download,
  Copy,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native";

export interface ZoomableImageViewerProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onDownload?: (url: string) => void;
  onCopy?: (url: string) => void;
  viewerToast?: string | null;
}

export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({
  visible,
  imageUrl,
  onClose,
  onDownload,
  onCopy,
  viewerToast,
}) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<any>(null);
  const dragStartRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  // Reset transformations when image changes or viewer is opened
  useEffect(() => {
    if (visible) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [visible, imageUrl]);

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

  const handleDoubleTap = useCallback(
    () => {
      setScale((prev) => {
        if (prev > 1) {
          setTranslate({ x: 0, y: 0 });
          return 1;
        } else {
          return 2.5;
        }
      });
    },
    []
  );

  // Web mouse wheel & pointer events
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
  }, [visible, onClose, handleZoomIn, handleZoomOut, handleResetZoom]);

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

    if (scale > 1) {
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
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging || !dragStartRef.current) return;
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setTranslate({
      x: dragStartRef.current.startTx + dx,
      y: dragStartRef.current.startTy + dy,
    });
  };

  const handlePointerUp = (e: any) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  // Touch Pinch & Pan for Mobile
  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (!touches) return;

    if (touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      touchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1) {
        setIsDragging(true);
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

    if (touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      const ratio = currentDist / touchDistanceRef.current;

      setScale((prev) => {
        const next = Math.min(5, Math.max(1, Number((prev * ratio).toFixed(2))));
        if (next === 1) setTranslate({ x: 0, y: 0 });
        return next;
      });
      touchDistanceRef.current = currentDist;
    } else if (touches.length === 1 && isDragging && dragStartRef.current) {
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
    setIsDragging(false);
    dragStartRef.current = null;
  };

  if (!visible || !imageUrl) return null;

  const imageTransformStyle = {
    transform: [
      { translateX: translate.x },
      { translateY: translate.y },
      { scale: scale },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        ref={containerRef}
        style={styles.overlay}
        onPointerDown={Platform.OS === "web" ? (handlePointerDown as any) : undefined}
        onPointerMove={Platform.OS === "web" ? (handlePointerMove as any) : undefined}
        onPointerUp={Platform.OS === "web" ? (handlePointerUp as any) : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background tap to close (only if not zoomed in and not dragging) */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (scale <= 1) {
              onClose();
            } else {
              handleResetZoom();
            }
          }}
        />

        {/* Zoomable Image Container */}
        <View
          style={[
            styles.imageContainer,
            Platform.OS === "web" && {
              cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
              userSelect: "none",
            } as any,
          ]}
          pointerEvents="box-none"
        >
          <Image
            source={{ uri: imageUrl }}
            style={[styles.fullImage, imageTransformStyle]}
            resizeMode="contain"
          />
        </View>

        {/* Top Floating Glass Toolbar */}
        <View
          style={styles.toolbar}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Zoom Controls */}
          <TouchableOpacity
            style={[styles.toolBtn, scale <= 1 && styles.toolBtnDisabled]}
            onPress={handleZoomOut}
            disabled={scale <= 1}
            accessibilityLabel="Zoom out"
          >
            <ZoomOut size={17} color={scale <= 1 ? "rgba(255,255,255,0.3)" : "#ffffff"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomBadge}
            onPress={handleResetZoom}
            accessibilityLabel="Reset zoom"
          >
            <Text style={styles.zoomBadgeText}>{Math.round(scale * 100)}%</Text>
          </TouchableOpacity>

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
              onPress={() => onDownload(imageUrl)}
              accessibilityLabel="Download photo"
            >
              <Download size={17} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Copy Button */}
          {onCopy && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => onCopy(imageUrl)}
              accessibilityLabel="Copy photo"
            >
              <Copy size={17} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Open Original in Web */}
          {Platform.OS === "web" && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => window.open(imageUrl, "_blank")}
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

        {/* Bottom Zoom & Pan Hint */}
        {scale > 1 && (
          <View style={styles.panHint}>
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
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  } as any,
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  toolBtnDisabled: {
    opacity: 0.4,
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
  },
  zoomBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Josefin Sans",
    letterSpacing: 0.3,
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
