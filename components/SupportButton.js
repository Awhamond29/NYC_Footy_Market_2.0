'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import { useSupportId } from '@/lib/support';

// "Message NYC Footy Market" — opens (or creates) the chat with the official support account.
export default function SupportButton({ variant = 'panel' }) {
  const supportId = useSupportId();
  const { user, ensureSignedIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!supportId || user?.id === supportId) return null;

  const open = async () => {
    if (!ensureSignedIn('message NYC Footy Market support')) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('start_conversation', { other: supportId });
    setBusy(false);
    if (error) setError('Couldn’t open the support chat. Try again.');
    else router.push(`/chats/${data}`);
  };

  const button = (
    <button className={variant === 'panel' ? 'btn ghost' : 'link'} type="button" onClick={open} disabled={busy}>
      {busy ? 'Opening…' : 'Message NYC Footy Market'}
    </button>
  );

  if (variant !== 'panel') return button;
  return (
    <div className="panel">
      <span className="lbl">Help &amp; support</span>
      <span className="note">Questions, a problem with a player, or an idea? Message the NYC Footy Market team.</span>
      {button}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
