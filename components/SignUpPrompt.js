'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui';
import { setReturnTo } from '@/lib/returnTo';

// Shown when a guest tries something that needs an account (message, post, review…).
export default function SignUpPrompt({ reason, onClose }) {
  const [error, setError] = useState('');

  const remember = () => setReturnTo(window.location.pathname);

  const google = async () => {
    setError('');
    remember();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <Modal onClose={onClose} label="Create a free account">
      <h2>Create a free account{reason ? ` to ${reason}` : ''}</h2>
      <p style={{ margin: 0 }}>
        Guests can browse. With an account you can message players, post games when you&apos;re short, and leave
        reviews. It takes about 30 seconds.
      </p>
      <button className="btn dark block" type="button" onClick={google}>
        Continue with Google
      </button>
      <Link href="/login" className="btn block" onClick={remember}>
        Sign up with email
      </Link>
      {error ? <p className="error">{error}</p> : null}
      <p className="note" style={{ margin: 0, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" onClick={remember}>
          Sign in
        </Link>
      </p>
    </Modal>
  );
}
