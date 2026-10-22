'use client';

import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const pushConfigured = Boolean(VAPID_PUBLIC);

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// True when opened from the home-screen icon rather than a browser tab.
export function isInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

function keyToBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function save(sub) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw new Error('Couldn’t save this device. Try again.');
}

// Current state: 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'
export async function pushStatus() {
  if (!pushConfigured) return 'unsupported';
  if (!pushSupported()) return isIOS() && !isInstalled() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (Notification.permission === 'granted' && sub) {
    // Keep this device linked to whoever is signed in now.
    save(sub).catch(() => {});
    return 'on';
  }
  return 'off';
}

// Must be called from a tap (browsers only show the permission prompt after a user action).
export async function turnOnPush() {
  const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) }));
  await save(sub);
  return 'on';
}

export async function turnOffPush() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
}

// Asks the server to notify the other person about a message you just sent.
export async function notifyRecipient(messageId) {
  if (!pushConfigured) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId }),
      keepalive: true,
    });
  } catch {
    // A missed notification shouldn't stop the message; it's already sent.
  }
}
