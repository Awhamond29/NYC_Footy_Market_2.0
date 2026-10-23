'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { setReturnTo } from '@/lib/returnTo';

const GUEST_TABS = [
  { href: '/players', label: 'Players' },
  { href: '/games', label: 'Short on Players' },
];

const TABS = [
  { href: '/players', label: 'Players' },
  { href: '/games', label: 'Short on Players' },
  { href: '/chats', label: 'Chats', badge: true },
  { href: '/profile', label: 'My Profile' },
];

export default function Header() {
  const pathname = usePathname();
  const { session, unread } = useAuth();

  return (
    <header className="top">
      <div className="wrap">
        <div className="brand">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 }}>
              <Link href="/" className="logo">
                NYC Footy <span>Market</span>
              </Link>
              <span className="beta">Beta</span>
            </div>
            <div className="tag">Short a keeper at Pier 40? Find one before kickoff.</div>
          </div>
          {session === null ? (
            <Link href="/login" className="btn" onClick={() => setReturnTo(window.location.pathname)}>
              Create account
            </Link>
          ) : null}
        </div>
        {session !== undefined ? (
          <nav className="tabs" aria-label="Sections">
            {(session ? TABS : GUEST_TABS).map((t) => (
              <Link key={t.href} href={t.href} aria-current={pathname.startsWith(t.href) ? 'page' : undefined}>
                {t.label}
                {t.badge && unread > 0 ? <span className="count">{unread}</span> : null}
              </Link>
            ))}
          </nav>
        ) : (
          <div style={{ height: 8 }} />
        )}
      </div>
    </header>
  );
}
