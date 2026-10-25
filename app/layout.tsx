import type { Metadata, Viewport } from 'next';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lage',
  description: 'Peters Logbuch: Gedanken, Zitate, Videos und Bücher festhalten und daraus lernen.',
  applicationName: 'Lage',
  appleWebApp: { capable: true, title: 'Lage', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0B1426',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
