'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Google and email links land here. The Supabase client finishes the
// sign-in from the URL on its own; we wait for it, then route the person.
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    const go = async (session) => {
      if (done || !session) return;
      done = true;
      const { data } = await supabase.from('profiles').select('is_adult').eq('id', session.user.id).maybeSingle();
      router.replace(data?.is_adult ? '/players' : '/profile?welcome=1');
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => go(s));
    supabase.auth.getSession().then(({ data }) => go(data.session));
    const timer = setTimeout(() => !done && setFailed(true), 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  if (failed) {
    return (
      <div className="empty">
        <p style={{ maxWidth: '46ch' }}>
          That sign-in link didn&apos;t work. Links only work in the same browser you requested them from, and
          each one works once. Go back to sign in and type the code from the email instead.
        </p>
        <Link href="/login" className="btn">
          Try again
        </Link>
      </div>
    );
  }
  return <div className="empty">Signing you in…</div>;
}
