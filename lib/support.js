'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// The official NYC Footy Market support account (set by the admin in Supabase).
let cached = null;
function load() {
  if (!cached) {
    cached = supabase
      .from('support_account')
      .select('user_id')
      .maybeSingle()
      .then(({ data }) => data?.user_id ?? null)
      .catch(() => null);
  }
  return cached;
}

export function useSupportId() {
  const [id, setId] = useState(null);
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setId(v));
    return () => {
      alive = false;
    };
  }, []);
  return id;
}

export function OfficialBadge() {
  return (
    <span className="official" title="Official NYC Footy Market account">
      ✓ Official
    </span>
  );
}

// Turns links in a message into tappable links (only http(s) and our own site).
export function Linkified({ text }) {
  const parts = String(text).split(/((?:https?:\/\/|www\.|nycfootymarket\.com)[^\s]+)/gi);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const trimmed = part.replace(/[.,!?)]+$/, '');
    const rest = part.slice(trimmed.length);
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^www\./i, 'www.')}`;
    const internal = /^https?:\/\/(www\.)?nycfootymarket\.com/i.test(href);
    return (
      <span key={i}>
        <a href={href} target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer nofollow'} className="msglink">
          {trimmed}
        </a>
        {rest}
      </span>
    );
  });
}
