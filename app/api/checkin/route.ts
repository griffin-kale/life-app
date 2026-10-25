import { NextResponse, after, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { BOEGEN, pruefeAntworten, who5, wochenTag, type Antwort, type Bogen } from '@/lib/fragen';
import { coachErstellen } from '@/lib/coach';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';

const USER = 'peter';
const tagFuer = (art: Bogen['art'], heute: string) => (art === 'woche' ? wochenTag(heute) : heute);

/** Welche Bögen heute offen sind, plus die Aufgaben für den Wenn-dann-Plan. */
export async function GET() {
  await ensureSchema();
  const heute = heuteBerlin();
  const rows = await sql<{ art: string; tag: string; antworten: Record<string, Antwort> }[]>`
    select art, tag::text as tag, antworten from checkins where user_id = ${USER} and tag in (${heute}, ${wochenTag(heute)})`;
  const erledigt = (art: Bogen['art']) => rows.some((r) => r.art === art && r.tag === tagFuer(art, heute));
  const aufgaben = await sql<{ t: string }[]>`
    select coalesce(schritt, titel, left(text, 80)) as t from items
    where user_id = ${USER} and status = 'sortiert' and merged_into is null and stapel in ('jetzt', 'woche')
    order by (stapel = 'jetzt') desc, rang nulls last limit 6`;
  return NextResponse.json({
    heute,
    erledigt: { morgen: erledigt('morgen'), abend: erledigt('abend'), woche: erledigt('woche') },
    aufgaben: aufgaben.map((a) => a.t),
    who5: (() => { const w = rows.find((r) => r.art === 'woche' && r.tag === wochenTag(heute)); return w ? who5(w.antworten) : null; })(),
  });
}

/** Speichert einen Bogen. Ein zweites Absenden am selben Tag überschreibt den ersten. */
export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const art = b.art as Bogen['art'];
  if (!BOEGEN[art]) return NextResponse.json({ error: 'Unbekannter Fragebogen' }, { status: 400 });
  const antworten = pruefeAntworten(art, b.antworten);
  if (!antworten) return NextResponse.json({ error: 'Bitte die Pflichtfragen beantworten.' }, { status: 400 });
  const tag = tagFuer(art, heuteBerlin());
  await sql`insert into checkins (user_id, art, tag, antworten) values (${USER}, ${art}, ${tag}, ${sql.json(antworten)})
    on conflict (user_id, art, tag) do update set antworten = excluded.antworten, created_at = now()`;
  if (art === 'morgen' || art === 'abend') after(() => coachErstellen(art, USER).catch(() => {}));
  return NextResponse.json({ ok: true });
}
