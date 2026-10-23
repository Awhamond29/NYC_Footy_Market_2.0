'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { isIOS, isInstalled } from '@/lib/push';

// Share this page (nycfootymarket.com/install) to get people onto the app.
export default function InstallPage() {
  const { installPrompt, installApp } = useAuth();
  const [device, setDevice] = useState(null); // 'installed' | 'ios' | 'android' | 'desktop'

  useEffect(() => {
    if (isInstalled()) setDevice('installed');
    else if (isIOS()) setDevice('ios');
    else if (/Android/i.test(navigator.userAgent)) setDevice('android');
    else setDevice('desktop');
  }, []);

  return (
    <section className="install">
      <img src="/icons/icon-192.png" alt="" className="install-icon" width="96" height="96" />
      <h1>Get the app</h1>
      <p className="sub">
        NYC Footy Market on your home screen: one tap to find a keeper or a game, and a notification the moment a
        team messages you. Free, and nothing to download from an app store.
      </p>

      {device === 'installed' ? (
        <div className="panel">
          <strong>You already have the app.</strong>
          <Link href="/players" className="btn">
            Go to Players
          </Link>
        </div>
      ) : null}

      {device === 'ios' ? (
        <div className="panel">
          <span className="lbl">iPhone</span>
          <ol className="install-steps">
            <li>
              Tap the <b>Share</b> button: the square with an arrow pointing up, at the bottom of Safari (top right
              in Chrome).
            </li>
            <li>
              Scroll down and tap <b>Add to Home Screen</b>.
            </li>
            <li>
              Tap <b>Add</b>. The NYC Footy Market icon appears on your home screen.
            </li>
            <li>Open it from there, then turn on notifications on your profile.</li>
          </ol>
        </div>
      ) : null}

      {device === 'android' ? (
        <div className="panel">
          <span className="lbl">Android</span>
          {installPrompt ? (
            <button className="btn block big" type="button" onClick={installApp}>
              Install NYC Footy Market
            </button>
          ) : (
            <ol className="install-steps">
              <li>
                Tap the <b>⋮</b> menu at the top right of Chrome.
              </li>
              <li>
                Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.
              </li>
              <li>Open it from your home screen and turn on notifications on your profile.</li>
            </ol>
          )}
        </div>
      ) : null}

      {device === 'desktop' ? (
        <div className="install-desktop">
          <div className="panel" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span className="lbl">On your phone</span>
            <img src="/brand/install-qr.svg" alt="QR code for nycfootymarket.com/install" className="install-qr" width="200" height="200" />
            <p className="note" style={{ margin: 0 }}>
              Scan with your phone camera, or open <b>nycfootymarket.com/install</b> on your phone.
            </p>
          </div>
          {installPrompt ? (
            <div className="panel">
              <span className="lbl">On this computer</span>
              <button className="btn block big" type="button" onClick={installApp}>
                Install on this computer
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="note">
        Prefer the website? Everything works at <Link href="/">nycfootymarket.com</Link> too.
      </p>
    </section>
  );
}
