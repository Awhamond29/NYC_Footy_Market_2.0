import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from './providers';
import Header from '@/components/Header';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nycfootymarket.com';
const DESCRIPTION =
  'NYC Footy Market: find a goalkeeper or outfielder for your New York City soccer game, or find a game to join. Free to use.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: 'NYC Footy Market | Find NYC soccer players and games',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  applicationName: 'NYC Footy Market',
  appleWebApp: { capable: true, title: 'Footy Market', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'NYC Footy Market',
    description: DESCRIPTION,
    url: SITE,
    siteName: 'NYC Footy Market',
    type: 'website',
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <Header />
          <main className="wrap">{children}</main>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
