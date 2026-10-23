// Lets phones install the site as an app (home-screen icon, opens full screen).
export default function manifest() {
  return {
    name: 'NYC Footy Market',
    short_name: 'Footy Market',
    description: 'Find a keeper or outfielder for your NYC soccer game, or find a game to join.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
