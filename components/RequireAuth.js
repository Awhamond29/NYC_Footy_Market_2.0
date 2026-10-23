'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { isConfigured } from '@/lib/supabase';
import { setReturnTo } from '@/lib/returnTo';

export function SetupNotice() {
  return (
    <div className="banner">
      <span>
        The app isn&apos;t connected to a database yet. Add your Supabase URL and key as environment
        variables (README step 3), then restart.
      </span>
    </div>
  );
}

// Wraps pages that need a signed-in user. Also nudges people who haven't
// confirmed they're 18+ toward their profile first.
export function GuestBanner() {
  return (
    <div className="banner">
      <span>
        You&apos;re browsing as a guest. Create a free account to message players, post games and leave reviews.
      </span>
      <Link href="/login" className="btn" onClick={() => setReturnTo(window.location.pathname)}>
        Create account
      </Link>
    </div>
  );
}

export default function RequireAuth({ children, needsProfile = false, allowGuest = false }) {
  const { session, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session === null && !allowGuest) {
      setReturnTo(window.location.pathname);
      router.replace('/login');
    }
  }, [session, router, allowGuest]);

  if (!isConfigured) return <SetupNotice />;
  if (session === null && allowGuest) {
    return (
      <>
        <GuestBanner />
        {children}
      </>
    );
  }
  if (!session) return <div className="empty">Loading…</div>;

  return (
    <>
      {needsProfile && profile && !profile.is_adult ? (
        <div className="banner">
          <span>Finish your profile and confirm you&apos;re 18 or older to message players and post games.</span>
          <Link href="/profile" className="btn">
            Finish profile
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}
