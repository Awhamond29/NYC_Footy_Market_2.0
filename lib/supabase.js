import { createBrowserClient } from '@supabase/ssr';

// Accept the project URL even if it was copied with "/rest/v1/" or a trailing slash.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True when the two environment variables have been set (see README step 3).
export const isConfigured = Boolean(url && key);

// Placeholders keep the build from failing before keys are added;
// every page shows a setup notice until they are.
export const supabase = createBrowserClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key'
);
