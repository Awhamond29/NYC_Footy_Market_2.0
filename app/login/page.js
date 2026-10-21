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
  const [code, setCode] = useState('');

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

  // Works on any device: type the code from the email instead of clicking the link.
  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from the email (numbers only).');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (error) {
      setError('That code didn’t work. It may have expired, so send a new one and use the latest email.');
      return;
    }
    const { data: p } = await supabase.from('profiles').select('is_adult').eq('id', data.user.id).maybeSingle();
    router.replace(p?.is_adult ? '/players' : '/profile?welcome=1');
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
        <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }} noValidate>
          <p style={{ margin: 0 }}>
            We emailed <strong>{email}</strong>. Click the link in it, or type the code from the email here.
          </p>
          <div className="field">
            <label htmlFor="code">Sign-in code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={12}
            />
          </div>
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in with code'}
          </button>
          <p className="note" style={{ margin: 0 }}>
            Nothing arrived? Check spam, or{' '}
            <button className="link" type="button" onClick={() => { setSent(false); setCode(''); setError(''); }}>
              send it again
            </button>
            .
          </p>
        </form>
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
