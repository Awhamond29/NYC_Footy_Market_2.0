const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyc-footy-market.vercel.app';

// Lets search engines crawl the public pages and tells them where the sitemap is.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: ['/', '/login'], disallow: ['/chats', '/profile', '/auth'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
