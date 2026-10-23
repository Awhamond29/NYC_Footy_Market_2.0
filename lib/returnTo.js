'use client';

// Remembers which page a guest was on when they chose to sign up,
// so they land back there afterwards (works across the Google and email flows).
const KEY = 'nfm-return-to';

export function setReturnTo(path) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {}
}

export function takeReturnTo(fallback = '/players') {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw || 'null') || {};
    // Only same-site paths, and only if it was set in the last hour.
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && Date.now() - at < 36e5) return path;
  } catch {}
  return fallback;
}
