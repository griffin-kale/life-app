import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';
import { OHNE_CACHE, ablageRiegel, frageBeantwortet, frageOffen } from '@/lib/ablage';

/** Neutrales Zeichen für Heute: ob noch eine Frage offen ist. Kein Inhalt, nur ja oder nein. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json({ offen: await frageOffen(uid) }, { headers: OHNE_CACHE });
}

/** Die Abendfrage ist beantwortet: nur das Datum wird gespeichert, und nur mit offenem Riegel. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  await frageBeantwortet(uid);
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}
