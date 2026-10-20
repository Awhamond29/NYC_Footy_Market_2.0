'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/providers';

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
          <div>
            <Link href="/" className="logo">
              NYC Footy <span>Market</span>
            </Link>
            <div className="tag">Short a keeper at Pier 40? Find one before kickoff.</div>
          </div>
          {session === null ? (
            <Link href="/login" className="btn">
              Sign in
            </Link>
          ) : null}
        </div>
        {session ? (
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
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
