import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { warnsignale, type CoachAntwort } from '@/lib/coach';
import { heuteBerlin, offene } from '@/lib/priorisieren';
import { koerperStand } from '@/lib/koerper';
import { geldStand } from '@/lib/geld';

/** Was der Coach heute gesagt hat. Warnsignale rechnet Life bei jedem Abruf neu, auch ohne Claude. */
export async function GET() {
  await ensureSchema();
  const tag = heuteBerlin();
  const [rows, items, k, g] = await Promise.all([
    sql<{ art: string; antwort: CoachAntwort }[]>`select art, antwort from coach where user_id = 'peter' and tag = ${tag}`,
    offene(),
    koerperStand(),
    geldStand().catch(() => null),
  ]);
  const morgen = rows.find((r) => r.art === 'morgen')?.antwort ?? null;
  const abend = rows.find((r) => r.art === 'abend')?.antwort ?? null;
  return NextResponse.json({ morgen, abend, warnungen: [...k.warnungen, ...(g?.warnungen ?? []), ...warnsignale(items)] });
}
