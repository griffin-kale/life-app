import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { STAND, bausteineAus, nachruesten } from '@/lib/heute-bausteine';
import { begrenzt } from '@/lib/ratelimit';

/** Welche Bausteine Heute zeigt und in welcher Reihenfolge. Pro Mensch gespeichert, damit es auf jedem Gerät gleich aussieht. */
const KEY = (userId: string) => `heute:${userId}`;
async function lesen(userId: string) {
  const roh = await getSetting(KEY(userId));
  if (!roh) return bausteineAus(null);
  let liste; try { liste = bausteineAus(JSON.parse(roh)); } catch { return bausteineAus(null); }
  // Neue Bausteine einmal nachrüsten. Wer sie danach ausschaltet, behält das.
  const n = nachruesten(liste, Number(await getSetting(`heute_stand:${userId}`)) || 1);
  if (n) { await setSetting(KEY(userId), JSON.stringify(n.liste)); await setSetting(`heute_stand:${userId}`, String(n.stand)); return n.liste; }
  return liste;
}

export async function GET() {
  return NextResponse.json({ bausteine: await lesen('peter') });
}

export async function PUT(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const bausteine = bausteineAus(b?.bausteine);
  await setSetting(KEY('peter'), JSON.stringify(bausteine));
  await setSetting('heute_stand:peter', String(STAND));
  return NextResponse.json({ bausteine });
}
