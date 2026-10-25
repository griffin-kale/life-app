import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import './globals.css';
import { RAND, THEMA_COOKIE, themaAus } from '@/lib/thema';
import { Navigation } from './navigation';

const thema = async () => themaAus((await cookies()).get(THEMA_COOKIE)?.value);

export async function generateMetadata(): Promise<Metadata> {
  const t = await thema();
  return {
    title: 'Life',
    description: 'Gedanken, Aufgaben, Zitate und Videos festhalten, priorisieren und daraus lernen.',
    applicationName: 'Life',
    // Helle Statusleiste braucht dunkle Schrift. iOS liest das beim Öffnen der App.
    appleWebApp: { capable: true, title: 'Life', statusBarStyle: t === 'light' ? 'default' : 'black-translucent' },
    robots: { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const t = await thema();
  return {
    themeColor: t === 'system'
      ? [{ media: '(prefers-color-scheme: light)', color: RAND.light }, { media: '(prefers-color-scheme: dark)', color: RAND.dark }]
      : RAND[t],
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme={await thema()}>
      <body><Navigation />{children}</body>
    </html>
  );
}
