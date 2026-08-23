import { Platform } from 'react-native';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BGbhptVs9pH-HaFYKcqLksSPiD3HDlXBmGjq48VgTMJFyu6BjSGEDNlXouQcr0Zp55gGq6YMazgsj7csslbh1JM';

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications(userId: string) {
  if (Platform.OS !== 'web' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notification permission denied.');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const applicationServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    }

    // Save to Supabase
    if (subscription) {
      const subJson = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        auth_key: subJson.keys?.auth,
        p256dh_key: subJson.keys?.p256dh,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      console.log('Push subscription saved.');
    }
  } catch (error) {
    console.error('Error registering push notifications:', error);
  }
}
