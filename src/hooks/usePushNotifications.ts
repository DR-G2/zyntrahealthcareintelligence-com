import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = 'BCnk82lMbi10ivT9iHyZig2cLLQbFx1tPa_x2vyy3OHnibwRvrVLqxhzMxgotyIFZPYTIInmC8rABumhzorB1EI';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushState = 'unsupported' | 'default' | 'denied' | 'granted' | 'subscribed';

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>('unsupported');
  const [loading, setLoading] = useState(false);

  // Check current state
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }

    // Don't register in iframes (Lovable preview)
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    if (isInIframe) {
      setState('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      setState('denied');
      return;
    }

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'subscribed' : permission === 'granted' ? 'granted' : 'default');
    });
  }, []);

  // Register the push service worker (separate from any app SW)
  const registerSW = useCallback(async () => {
    return navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
  }, []);

  const subscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await registerSW();
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();

      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        } as any,
        { onConflict: 'user_id,endpoint' }
      );

      setState('subscribed');
    } catch (err: any) {
      console.error('Push subscribe failed:', err);
      if (Notification.permission === 'denied') setState('denied');
    } finally {
      setLoading(false);
    }
  }, [user, registerSW]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      }
      setState('granted');
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { state, loading, subscribe, unsubscribe };
}
