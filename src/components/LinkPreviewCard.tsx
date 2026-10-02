import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { ExternalLink, Globe } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getThumbnailUrl } from "../lib/r2";

export interface LinkPreviewData {
  url: string;
  domain: string;
  siteName?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

const memoryCache = new Map<string, LinkPreviewData>();

const hashUrl = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
};

export const extractFirstUrl = (text: string): string | null => {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s<>"'{}|\\^`\[\]]+/i);
  return match ? match[0] : null;
};

export const LinkPreviewCard: React.FC<{ url: string; isMe?: boolean }> = React.memo(({ url, isMe }) => {
  const [data, setData] = useState<LinkPreviewData | null>(() => memoryCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(!memoryCache.has(url));

  useEffect(() => {
    if (!url) return;
    if (memoryCache.has(url)) {
      setData(memoryCache.get(url)!);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const cacheKey = `@link_prev_${hashUrl(url)}`;

    const fetchPreview = async () => {
      // 1. Try AsyncStorage
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isMounted) {
            memoryCache.set(url, parsed);
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}

      // 2. Fetch from Cloudflare Pages Function
      try {
        let apiUrl = `/api/link-preview?url=${encodeURIComponent(url)}`;
        // If native or absolute URL needed
        if (Platform.OS !== "web" && typeof process !== "undefined" && process.env.EXPO_PUBLIC_APP_URL) {
          apiUrl = `${process.env.EXPO_PUBLIC_APP_URL}/api/link-preview?url=${encodeURIComponent(url)}`;
        }

        let resp = await fetch(apiUrl).catch(() => null);

        // Fallback to microlink if local / standalone
        if (!resp || !resp.ok) {
          resp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`).catch(() => null);
          if (resp && resp.ok) {
            const mlJson = await resp.json();
            if (mlJson?.status === "success" && mlJson.data) {
              const d = mlJson.data;
              const result: LinkPreviewData = {
                url,
                domain: new URL(url).hostname.replace(/^www\./, ""),
                siteName: d.publisher || null,
                title: d.title || null,
                description: d.description || null,
                image: d.image?.url || null,
              };
              if (isMounted) {
                memoryCache.set(url, result);
                setData(result);
                AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
              }
              return;
            }
          }
        }

        if (resp && resp.ok) {
          const json = await resp.json();
          if (json.ok) {
            const result: LinkPreviewData = {
              url: json.url || url,
              domain: json.domain || new URL(url).hostname.replace(/^www\./, ""),
              siteName: json.siteName || null,
              title: json.title || null,
              description: json.description || null,
              image: json.image || null,
            };
            if (isMounted) {
              memoryCache.set(url, result);
              setData(result);
              AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
            }
            return;
          }
        }
      } catch (err) {
        // Fallback to basic domain info
        try {
          const parsed = new URL(url);
          const domain = parsed.hostname.replace(/^www\./, "");
          const fallback: LinkPreviewData = {
            url,
            domain,
            siteName: domain,
            title: domain,
            description: null,
            image: null,
          };
          if (isMounted) {
            memoryCache.set(url, fallback);
            setData(fallback);
          }
        } catch (e) {}
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (!data || (!data.title && !data.description && !data.image)) {
    return null;
  }

  const handleOpenLink = () => {
    try {
      Linking.openURL(data.url || url);
    } catch (e) {}
  };

  const domain = data.domain || (url ? new URL(url).hostname.replace(/^www\./, "") : "");
  const hasImage = !!data.image && typeof data.image === "string";

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleOpenLink}
      style={[
        styles.cardContainer,
        isMe ? styles.cardContainerMe : styles.cardContainerOther,
      ]}
    >
      {hasImage && (
        <View style={styles.imageContainer}>
          <ExpoImage
            source={{ uri: getThumbnailUrl(data.image!, 500, 260, 80) }}
            style={styles.bannerImage}
            cachePolicy="disk"
            transition={150}
            contentFit="cover"
          />
        </View>
      )}

      <View style={styles.contentContainer}>
        {/* Domain Badge */}
        <View style={styles.domainRow}>
          <Globe size={11} color={isMe ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.65)"} style={{ marginRight: 4 }} />
          <Text style={[styles.domainText, isMe ? styles.textMe : styles.textOther]} numberOfLines={1}>
            {data.siteName || domain}
          </Text>
          <ExternalLink size={10} color={isMe ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.5)"} style={{ marginLeft: 4 }} />
        </View>

        {/* Title */}
        {data.title && (
          <Text style={[styles.titleText, isMe ? styles.titleMe : styles.titleOther]} numberOfLines={2}>
            {data.title}
          </Text>
        )}

        {/* Description */}
        {data.description && (
          <Text style={[styles.descriptionText, isMe ? styles.descMe : styles.descOther]} numberOfLines={2}>
            {data.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    maxWidth: 270,
    width: "100%",
  },
  cardContainerMe: {
    backgroundColor: "rgba(0, 0, 0, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  cardContainerOther: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  imageContainer: {
    width: "100%",
    height: 125,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  domainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  domainText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textMe: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  textOther: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  titleText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  titleMe: {
    color: "#ffffff",
  },
  titleOther: {
    color: "#ffffff",
  },
  descriptionText: {
    fontSize: 11,
    lineHeight: 15,
  },
  descMe: {
    color: "rgba(255, 255, 255, 0.75)",
  },
  descOther: {
    color: "rgba(255, 255, 255, 0.65)",
  },
});
