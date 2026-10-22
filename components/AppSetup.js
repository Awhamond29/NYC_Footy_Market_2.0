'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers';
import { isIOS, isInstalled, pushStatus, turnOffPush, turnOnPush } from '@/lib/push';

const DISMISS_KEY = 'nfm-setup-dismissed';

// Install the app + turn on message notifications.
// variant="panel" for the profile page, "banner" for the top of Chats.
export default function AppSetup({ variant = 'panel' }) {
  const { installPrompt, installApp } = useAuth();
  const [status, setStatus] = useState(null);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setIos(isIOS());
    pushStatus().then(setStatus);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {}
  }, []);

  if (status === null) return null;

  const turnOn = async () => {
    setBusy(true);
    setError('');
    try {
      setStatus(await turnOnPush());
    } catch (e) {
      setError(e.message || 'Couldn’t turn on notifications. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setStatus(await turnOffPush().catch(() => status));
    setBusy(false);
  };

  // What to show, in order of what the person needs next.
  let body = null;
  if (status === 'needs-install' || (ios && !installed)) {
    body = (
      <>
        <strong>Get message alerts on your iPhone</strong>
        <ol className="steps-list">
          <li>
            Tap the <b>Share</b> button <span aria-hidden="true">(square with an arrow)</span> at the bottom of Safari
          </li>
          <li>
            Choose <b>Add to Home Screen</b>, then <b>Add</b>
          </li>
          <li>Open NYC Footy Market from your home screen and turn on notifications here</li>
        </ol>
      </>
    );
  } else if (status === 'off') {
    body = (
      <>
        <strong>Know the moment a team messages you</strong>
        <span className="note">Get a notification on this device for new messages.</span>
        <button className="btn" type="button" onClick={turnOn} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      </>
    );
  } else if (status === 'blocked') {
    body = (
      <>
        <strong>Notifications are blocked</strong>
        <span className="note">
          {ios
            ? 'Turn them on in iPhone Settings → Notifications → Footy Market.'
            : 'Allow notifications for nycfootymarket.com in your browser’s site settings, then reload.'}
        </span>
      </>
    );
  } else if (status === 'on') {
    if (variant === 'banner') return null;
    body = (
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>
          <strong>Notifications are on</strong> <span className="note">for this device</span>
        </span>
        <button className="link" type="button" onClick={turnOff} disabled={busy}>
          Turn off
        </button>
      </div>
    );
  }

  const install =
    installPrompt && !installed ? (
      <button className="btn ghost" type="button" onClick={installApp}>
        Install the app
      </button>
    ) : null;

  if (!body && !install) return null;
  if (variant === 'banner' && dismissed) return null;

  return (
    <div className={variant === 'banner' ? 'banner setup' : 'panel setup'}>
      <div className="setup-body">
        {body}
        {install}
        {error ? <p className="error">{error}</p> : null}
      </div>
      {variant === 'banner' ? (
        <button
          className="link"
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {}
          }}
        >
          Not now
        </button>
      ) : null}
    </div>
  );
}
