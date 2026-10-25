import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { bausteineAus } from '@/lib/heute-bausteine';
import { begrenzt } from '@/lib/ratelimit';

/** Welche Bausteine Heute zeigt und in welcher Reihenfolge. Pro Mensch gespeichert, damit es auf jedem Gerät gleich aussieht. */
const KEY = (userId: string) => `heute:${userId}`;
const lesen = async (userId: string) => { try { return bausteineAus(JSON.parse((await getSetting(KEY(userId))) || 'null')); } catch { return bausteineAus(null); } };

export async function GET() {
  return NextResponse.json({ bausteine: await lesen('peter') });
}

export async function PUT(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const bausteine = bausteineAus(b?.bausteine);
  await setSetting(KEY('peter'), JSON.stringify(bausteine));
  return NextResponse.json({ bausteine });
}
