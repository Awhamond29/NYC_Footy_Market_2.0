import './globals.css';
import { AuthProvider } from './providers';
import Header from '@/components/Header';

export const metadata = {
  title: 'NYC Footy Market',
  description: 'Find a keeper or outfielder for your NYC soccer game, or find a game to join.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f5132',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <Header />
          <main className="wrap">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
