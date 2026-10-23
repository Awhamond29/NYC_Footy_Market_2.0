const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nycfootymarket.com';

// Public pages Google should list. Signed-in pages are left out.
export default function sitemap() {
  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/install`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/login`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
