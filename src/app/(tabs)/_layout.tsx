import { Tabs, useRouter } from 'expo-router';
import { MessageCircle, User, MessageSquare, Phone, CircleDot, Plus } from 'lucide-react-native';
import { Platform, View, StyleSheet, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { TabsLoadingProvider, useTabsLoading } from '../../context/TabsLoadingContext';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const isWebMobile = Platform.OS === 'web' && width < 768;
  const { isTabsLoading } = useTabsLoading();
  const currentRoute = state.routes[state.index]?.name;

  // Never show tab bar on web desktop
  if (isDesktop) {
    return null;
  }

  // On web mobile, index manages its own integrated 4-tab bar (Chats, Call, Updates, Profile)
  if (isWebMobile) {
    if (currentRoute === 'index') {
      return null;
    }

    // On profile screen on web mobile, render the EXACT SAME new floating 4-tab bar
    return (
      <View style={webNavStyles.floatingNavContainer} pointerEvents="box-none">
        <View
          style={[
            webNavStyles.navPill,
            {
              backgroundColor: theme.isDark !== false ? "rgba(20, 20, 28, 0.62)" : "rgba(255, 255, 255, 0.72)",
              borderColor: theme.isDark !== false ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        >
          {/* 1. Chats */}
          <TouchableOpacity
            style={webNavStyles.navItemBtn}
            onPress={() => router.replace({ pathname: "/", params: { tab: "chats" } })}
            activeOpacity={0.7}
          >
            <MessageSquare size={19} color={theme.textMuted} />
            <Text style={[webNavStyles.navItemText, { color: theme.textMuted }]}>Chats</Text>
          </TouchableOpacity>

          {/* 2. Call */}
          <TouchableOpacity
            style={webNavStyles.navItemBtn}
            onPress={() => router.replace({ pathname: "/", params: { tab: "calls" } })}
            activeOpacity={0.7}
          >
            <Phone size={19} color={theme.textMuted} />
            <Text style={[webNavStyles.navItemText, { color: theme.textMuted }]}>Call</Text>
          </TouchableOpacity>

          {/* 3. Updates */}
          <TouchableOpacity
            style={webNavStyles.navItemBtn}
            onPress={() => router.replace({ pathname: "/", params: { tab: "updates" } })}
            activeOpacity={0.7}
          >
            <CircleDot size={19} color={theme.textMuted} />
            <Text style={[webNavStyles.navItemText, { color: theme.textMuted }]}>Updates</Text>
          </TouchableOpacity>

          {/* 4. Profile (Active) */}
          <TouchableOpacity
            style={[webNavStyles.navItemBtn, webNavStyles.navItemBtnActive]}
            activeOpacity={0.7}
          >
            <User size={19} color={theme.accent || "#f97316"} />
            <Text style={[webNavStyles.navItemText, { color: theme.accent || "#f97316" }]}>Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Floating + Button */}
        <TouchableOpacity
          style={[webNavStyles.floatingPlusBtn, { backgroundColor: theme.accent || "#f97316" }]}
          onPress={() => router.replace({ pathname: "/", params: { newChat: "true" } })}
          activeOpacity={0.85}
        >
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    );
  }

  // Native Mobile Tab Bar (Android / iOS) - UNTOUCHED
  if (currentRoute === 'index' && isTabsLoading) {
    return null;
  }

  return (
    <View style={styles.floatingWrapper} pointerEvents="box-none">
      <View style={[styles.pillContainer, { backgroundColor: theme.border }]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const Icon = route.name === 'profile' ? User : MessageCircle;
          const color = isFocused ? theme.text : theme.textMuted;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabBtn}
            >
              <View style={[styles.iconCircle, isFocused && { backgroundColor: theme.surface }]}>
                <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <TabsLoadingProvider>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </TabsLoadingProvider>
  );
}

const webNavStyles = StyleSheet.create({
  floatingNavContainer: {
    position: "absolute",
    bottom: 19,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 9999,
  },
  navPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    width: 280,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(24px) saturate(190%)",
          WebkitBackdropFilter: "blur(24px) saturate(190%)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
        } as any)
      : {}),
  },
  navItemBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  navItemBtnActive: {
    transform: [{ scale: 1.05 }],
  },
  navItemText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Josefin Sans",
  },
  floatingPlusBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        } as any)
      : {}),
  },
});

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  pillContainer: {
    flexDirection: 'row',
    width: 200,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  tabBtn: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
