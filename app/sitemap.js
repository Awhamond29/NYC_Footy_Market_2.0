const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyc-footy-market.vercel.app';

// Public pages Google should list. Signed-in pages are left out.
export default function sitemap() {
  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/login`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
