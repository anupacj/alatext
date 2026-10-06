import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Dimensions, Platform } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Disable native screen Fragment recycling on Android New Architecture (Fabric)
// to prevent native SIGSEGV and FragmentTransaction crashes on navigation
if (Platform.OS === 'android') {
  enableScreens(false);
}

import { AlaPinProvider } from '../context/AlaPinContext';
import AlaPinLockScreen from '../components/AlaPinLockScreen';
import AlaContextMenu from '../components/AlaContextMenu';
import GlobalCallManager from '../components/GlobalCallManager';
import ErrorBoundary from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { theme } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = theme.background;
      document.documentElement.style.backgroundColor = theme.background;
      document.documentElement.style.setProperty('--app-bg', theme.background);
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = theme.background;
    }
  }, [theme.background]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chat"
        options={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none',
          fullScreenGestureEnabled: Platform.OS === 'ios',
        }}
      />
      <Stack.Screen
        name="chat-info"
        options={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none',
          fullScreenGestureEnabled: Platform.OS === 'ios',
        }}
      />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
    </Stack>
  );
}

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // 1. Google Fonts Preconnect & Stylesheet
      const preconnect1 = document.createElement("link");
      preconnect1.rel = "preconnect";
      preconnect1.href = "https://fonts.googleapis.com";
      document.head.appendChild(preconnect1);

      const preconnect2 = document.createElement("link");
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      document.head.appendChild(preconnect2);

      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=BenchNine&family=Caveat&family=Changa+One&family=Cinzel&family=Elsie&family=Handjet&family=Josefin+Sans:wght@300;400;600;700&family=Lobster+Two&family=Montserrat&family=Outfit&family=Playwrite+BR&family=Playwrite+DE+LA&family=Raleway&family=Rum+Raisin&family=Concert+One&family=Nothing+You+Could+Do&family=Chewy&family=La+Belle+Aurore&family=Balsamiq+Sans&family=Sacramento&family=Great+Vibes&family=Dancing+Script&family=Parisienne&family=Alex+Brush&family=Comfortaa&family=Sniglet&family=DynaPuff&family=Patrick+Hand&family=Cormorant+Garamond&family=DM+Serif+Display&family=Space+Grotesk&family=Silkscreen&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);

      // Global Web Viewport Fix for Fullscreen & Mobile
      const globalStyle = document.createElement("style");
      globalStyle.innerHTML = `
        html, body {
          height: 100% !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background-color: var(--app-bg, #1e1f22);
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        #root {
          height: 100% !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background-color: var(--app-bg, #1e1f22);
        }
        #root > div {
          height: 100% !important;
          width: 100% !important;
          display: flex !important;
          flex: 1 1 0% !important;
          flex-direction: column !important;
        }
        input, button, textarea, select {
          font-family: inherit;
        }
        :fullscreen {
          height: 100% !important;
          width: 100% !important;
        }
        ::backdrop {
          background-color: var(--app-bg, #1e1f22);
        }
      `;
      document.head.appendChild(globalStyle);

      // 2. PWA Manifest Link & Apple Touch Icon
      const manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest.json";
      document.head.appendChild(manifestLink);

      const appleIconLink = document.createElement("link");
      appleIconLink.rel = "apple-touch-icon";
      appleIconLink.href = "/icon.png";
      document.head.appendChild(appleIconLink);

      // 3. Apple & Mobile Standalone Meta Tags (Hides Browser Address Bar)
      const setMeta = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name='${name}']`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = name;
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      setMeta("mobile-web-app-capable", "yes");
      setMeta("apple-mobile-web-app-capable", "yes");
      setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
      setMeta("apple-mobile-web-app-title", "AlaText");
      setMeta("theme-color", "#1e1f22");
      setMeta("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content");

      // 4. Register PWA Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    }
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary screenName="AlaText">
      <AuthProvider>
        <ThemeProvider>
          <AlaPinProvider>
            <RootNavigator />
            <AlaPinLockScreen />
            <AlaContextMenu />
            <GlobalCallManager />
          </AlaPinProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
