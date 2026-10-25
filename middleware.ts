import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, validSession } from '@/lib/session';

// /sw.js ist eine feste Datei ohne Daten. iOS lädt sie beim Aktualisieren auch nach Ablauf der Sitzung.
const OPEN = ['/login', '/setup', '/api/auth/', '/api/capture', '/api/health', '/manifest.webmanifest', '/icon', '/apple-icon', '/favicon', '/sw.js'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (await validSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
