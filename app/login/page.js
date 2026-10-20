'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isConfigured } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import { SetupNotice } from '@/components/RequireAuth';

export default function Login() {
  const { session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) router.replace('/players');
  }, [session, router]);

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  const google = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  };

  const sendLink = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  if (!isConfigured) return <SetupNotice />;

  return (
    <div className="panel login">
      <h1>Sign in</h1>
      <p className="sub" style={{ margin: 0 }}>
        New here? Signing in creates your account.
      </p>

      <button className="btn dark block" type="button" onClick={google}>
        Continue with Google
      </button>

      <div className="note" style={{ textAlign: 'center' }}>
        or get a sign-in link by email
      </div>

      {sent ? (
        <p style={{ margin: 0 }}>
          Check <strong>{email}</strong> for a sign-in link. You can close this tab once you&apos;ve clicked it.
        </p>
      ) : (
        <form onSubmit={sendLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}
      {error ? <p className="error">{error}</p> : null}
      <p className="note" style={{ margin: 0 }}>
        By signing in you confirm you&apos;re 18 or older.
      </p>
    </div>
  );
}
