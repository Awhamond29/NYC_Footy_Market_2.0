'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { isConfigured } from '@/lib/supabase';

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
export default function RequireAuth({ children, needsProfile = false }) {
  const { session, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  if (!isConfigured) return <SetupNotice />;
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
