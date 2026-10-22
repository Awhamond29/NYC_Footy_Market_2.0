'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { registerServiceWorker } from '@/lib/push';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toastText, setToastText] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const toastTimer = useRef();

  const user = session?.user ?? null;
  const uid = user?.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data ?? null);
    return data;
  }, [uid]);

  const refreshUnread = useCallback(async () => {
    if (!uid) {
      setUnread(0);
      return;
    }
    // Row-level security limits this to conversations the user is in.
    const { data } = await supabase
      .from('messages')
      .select('conversation_id')
      .is('read_at', null)
      .neq('sender_id', uid);
    setUnread(new Set((data ?? []).map((m) => m.conversation_id)).size);
  }, [uid]);

  useEffect(() => {
    refreshProfile();
    refreshUnread();
  }, [refreshProfile, refreshUnread]);

  // Live unread badge: any new message the user can see bumps the count.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel('inbox-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => refreshUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, refreshUnread]);

  // App install (Android/desktop Chrome offer a native prompt; iPhone uses Share → Add to Home Screen).
  useEffect(() => {
    registerServiceWorker();
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }, [installPrompt]);

  const toast = useCallback((text) => {
    setToastText(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), 2600);
  }, []);

  const value = { session, user, profile, refreshProfile, unread, refreshUnread, toast, installPrompt, installApp };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toastText ? (
        <div className="toast" role="status">
          {toastText}
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}
