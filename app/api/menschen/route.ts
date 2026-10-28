import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { menschenStand } from '@/lib/menschen';
import { KREISE, TAKT, type Kreis } from '@/lib/menschen-regeln';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';


const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json(await menschenStand(uid));
}

export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  if (b.aktion === 'person') {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : ''; const kreis = b.kreis as Kreis;
    if (!name || !(kreis in KREISE)) return NextResponse.json({ error: 'Name und Kreis fehlen' }, { status: 400 });
    await sql`insert into personen (user_id, name, kreis, takt_tage) values (${uid}, ${name}, ${kreis}, ${TAKT[kreis]}) on conflict (user_id, name) do update set kreis = excluded.kreis`;
    return NextResponse.json({ ok: true });
  }
  if (b.aktion === 'kontakt') {
    const id = Number(b.person_id); const art = ['treffen', 'telefon', 'nachricht'].includes(b.art) ? b.art : null;
    const min = b.minuten == null ? null : Math.max(0, Math.min(24 * 60, Math.round(Number(b.minuten) || 0)));
    const [p] = await sql`select id from personen where id = ${Number.isInteger(id) ? id : -1} and user_id = ${uid}`;
    if (!p || !art) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
    await sql`insert into kontakte (user_id, person_id, tag, art, minuten) values (${uid}, ${id}, ${heuteBerlin()}, ${art}, ${min})`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

/** Kreis, Takt, Geburtstag oder Notiz ändern. */
export async function PATCH(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id); if (!Number.isInteger(id)) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  if (b.kreis in KREISE) await sql`update personen set kreis = ${b.kreis} where id = ${id} and user_id = ${uid}`;
  if ([7, 14, 21, 30, 60, 90].includes(b.takt_tage)) await sql`update personen set takt_tage = ${b.takt_tage} where id = ${id} and user_id = ${uid}`;
  if (b.geburtstag === '' || (typeof b.geburtstag === 'string' && DATUM.test(b.geburtstag))) await sql`update personen set geburtstag = ${b.geburtstag || null} where id = ${id} and user_id = ${uid}`;
  if (typeof b.notiz === 'string') await sql`update personen set notiz = ${b.notiz.trim().slice(0, 1000) || null} where id = ${id} and user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await sql`delete from personen where id = ${id} and user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
