import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // 1. Google Fonts
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=BenchNine&family=Caveat&family=Changa+One&family=Cinzel&family=Elsie&family=Handjet&family=Josefin+Sans&family=Lobster+Two&family=Montserrat&family=Outfit&family=Playwrite+BR&family=Playwrite+DE+LA&family=Raleway&family=Rum+Raisin&family=Concert+One&family=Nothing+You+Could+Do&family=Chewy&family=La+Belle+Aurore&family=Balsamiq+Sans&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);

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
      setMeta("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");

      // 4. Register PWA Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    }
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#313338' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
