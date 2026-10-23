const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nycfootymarket.com';

// Lets search engines crawl the public pages and tells them where the sitemap is.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: ['/', '/login', '/install'], disallow: ['/chats', '/profile', '/auth'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
