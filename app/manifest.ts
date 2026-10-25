import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life',
    short_name: 'Life',
    description: 'Gedanken festhalten, priorisieren, weiterdenken',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A1326',
    theme_color: '#0A1326',
    lang: 'de',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
