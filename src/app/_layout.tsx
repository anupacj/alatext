import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';

export default function Layout() {
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
