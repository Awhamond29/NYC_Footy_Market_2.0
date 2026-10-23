'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { isIOS, isInstalled } from '@/lib/push';

const KEY = 'nfm-getapp-dismissed';
const SNOOZE_DAYS = 14;

// A small bar at the bottom for phone visitors who haven't installed the app.
export default function GetAppBar() {
  const { installPrompt, installApp } = useAuth();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIOS();
    let snoozed = false;
    try {
      const at = Number(localStorage.getItem(KEY) || 0);
      snoozed = Date.now() - at < SNOOZE_DAYS * 864e5;
    } catch {}
    setShow(phone && !isInstalled() && !snoozed);
  }, []);

  if (!show || pathname === '/install' || pathname.startsWith('/auth')) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  return (
    <>
      <div className="getapp-spacer" aria-hidden="true" />
      <div className="getapp" role="region" aria-label="Get the app">
        <img src="/icons/icon-192.png" alt="" width="40" height="40" />
        <div className="getapp-text">
          <strong>Get the app</strong>
          <span>Home-screen icon and message alerts</span>
        </div>
        {installPrompt ? (
          <button className="btn" type="button" onClick={installApp}>
            Install
          </button>
        ) : (
          <Link href="/install" className="btn">
            How to
          </Link>
        )}
        <button className="getapp-close" type="button" onClick={dismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </>
  );
}
