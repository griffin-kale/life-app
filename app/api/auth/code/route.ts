import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, validSession } from '@/lib/session';
import { aktiv, ausschalten } from '@/lib/zweifaktor';

/** /api/auth/ ist offen. Status und Ausschalten nur mit gültiger Sitzung. */
async function angemeldet(req: NextRequest) { return validSession(req.cookies.get(SESSION_COOKIE)?.value); }

export async function GET(req: NextRequest) {
  if (!(await angemeldet(req))) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 });
  return NextResponse.json({ aktiv: await aktiv() });
}

export async function DELETE(req: NextRequest) {
  if (!(await angemeldet(req))) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 });
  await ausschalten();
  return NextResponse.json({ ok: true });
}
