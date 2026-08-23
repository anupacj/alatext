import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=BenchNine&family=Caveat&family=Changa+One&family=Cinzel&family=Elsie&family=Handjet&family=Josefin+Sans&family=Lobster+Two&family=Montserrat&family=Outfit&family=Playwrite+BR&family=Playwrite+DE+LA&family=Raleway&family=Rum+Raisin&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#313338' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </AuthProvider>
  );
}
