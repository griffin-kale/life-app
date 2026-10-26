import { NextResponse, type NextRequest } from 'next/server';
import { erlaubteHerkunft, sessionCookie, validSession } from '@/lib/session';

/**
 * Erster Riegel: Signatur der Sitzung, Herkunft schreibender Anfragen, CSP mit Nonce.
 * Der zweite Riegel steckt in jeder API-Route (`ohneSitzung()` aus lib/sitzung.ts) und prüft gegen die Datenbank.
 *
 * Offen sind nur genau diese Pfade, keine Präfixe. Neue offene Pfade nur nach Rückfrage bei Peter.
 * /sw.js ist eine feste Datei ohne Daten. iOS lädt sie beim Aktualisieren auch nach Ablauf der Sitzung.
 */
export const OPEN = new Set([
  '/login', '/setup',
  '/api/auth/login-options', '/api/auth/login', '/api/auth/register-options', '/api/auth/register',
  '/api/auth/code/start', '/api/auth/code/fertig', '/api/auth/code/login', '/api/auth/logout',
  '/api/capture', '/api/health',
  '/manifest.webmanifest', '/icon.png', '/apple-icon.png', '/icon-192.png', '/icon-512.png', '/favicon.ico', '/sw.js',
]);

const LESEND = new Set(['GET', 'HEAD', 'OPTIONS']);

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "worker-src 'self'",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Schreibende Anfragen an /api nur von Life selbst. Der Kurzbefehl kommt ohne Origin, dafür mit eigenem Schlüssel. */
function fremdeHerkunft(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/') || LESEND.has(req.method)) return false;
  if (pathname === '/api/capture' && /^Bearer\s+\S/i.test(req.headers.get('authorization') ?? '')) return false;
  const soll = erlaubteHerkunft(req.headers.get('x-forwarded-host') ?? req.headers.get('host'), req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', ''));
  const ist = req.headers.get('origin');
  return !soll || !ist || ist !== soll;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (fremdeHerkunft(req)) return NextResponse.json({ error: 'Anfrage nicht erlaubt' }, { status: 403 });

  if (OPEN.has(pathname) || (await validSession(req.cookies.get(sessionCookie())?.value))) {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const richtlinie = csp(nonce);
    const headers = new Headers(req.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', richtlinie); // Next liest daraus die Nonce für eigene Skripte
    const res = NextResponse.next({ request: { headers } });
    res.headers.set('content-security-policy', richtlinie);
    return res;
  }
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
