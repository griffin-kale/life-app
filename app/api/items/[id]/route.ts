import { NextResponse, after, type NextRequest } from 'next/server';
import { ensureSchema, sql, type Item, proNutzer } from '@/lib/db';
import { ARTEN, KATEGORIEN, TYPEN, enrich } from '@/lib/enrich';
import { AKTIV, JETZT_MAX, STAPEL, heuteBerlin, liste, sortiere } from '@/lib/priorisieren';
import { getSetting } from '@/lib/db';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  await ensureSchema();
  const [item] = await sql<Item[]>`select * from items where id = ${id} and user_id = ${uid}`;
  return item ? NextResponse.json(item) : NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  await ensureSchema();
  if (b.neuSortieren) { await sql`update items set status = 'neu', fehler = null where id = ${id} and user_id = ${uid}`; after(() => enrich(id)); return NextResponse.json({ ok: true }); }
  const [vorher] = await sql<Item[]>`select * from items where id = ${id} and user_id = ${uid}`;
  if (!vorher) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  const tag = heuteBerlin();
  const set: Record<string, unknown> = {};
  let verdraengt: string | null = null;
  // Verschieben zwischen Stapeln. Jede Verschiebung ist eine Korrektur, aus der Claude lernt.
  if ((STAPEL as readonly string[]).includes(b.stapel) && b.stapel !== vorher.stapel) {
    set.stapel = b.stapel; set.manuell_tag = tag; set.manuell_stapel = b.stapel;
    if (vorher.status === 'erledigt' || vorher.status === 'archiv') set.status = 'sortiert';
    if (b.stapel === 'jetzt') {
      const jetzt = await sql<Item[]>`select * from items where user_id = ${uid} and stapel = 'jetzt' and status = 'sortiert' and merged_into is null and id <> ${id}
        order by (manuell_tag = ${tag} and manuell_stapel = 'jetzt') nulls first, rang desc nulls first`;
      set.rang = jetzt.length + 1;
      if (jetzt.length >= JETZT_MAX) {
        const raus = jetzt[0];
        await sql`update items set stapel = 'woche', rang = 0 where id = ${raus.id} and user_id = ${uid}`;
        verdraengt = raus.schritt || raus.titel || raus.text.slice(0, 60);
      }
    }
    // Rückgängig innerhalb von zwei Minuten löscht die Korrektur, statt eine Gegenkorrektur zu lernen.
    const [letzte] = await sql<{ id: number; von: string | null; zu: string }[]>`select id, von, zu from korrekturen where item_id = ${id} and created_at > now() - interval '2 minutes' order by id desc limit 1`;
    if (letzte && letzte.zu === vorher.stapel && letzte.von === b.stapel) await sql`delete from korrekturen where id = ${letzte.id}`;
    else await sql`insert into korrekturen (user_id, item_id, von, zu) values (${uid}, ${id}, ${vorher.stapel}, ${b.stapel})`;
  }
  // Zur einen Sache machen: Rang 1 in „jetzt“, die anderen rücken nach. Zählt als Korrektur, aus der Claude lernt.
  if (b.eineSache === true && (vorher.stapel === 'jetzt' || set.stapel === 'jetzt') && ['sortiert', 'erledigt'].includes(vorher.status)) {
    await sql`update items set rang = coalesce(rang, 1) + 1 where user_id = ${uid} and stapel = 'jetzt' and status = 'sortiert' and id <> ${id}`;
    set.rang = 1; set.manuell_tag = tag; set.manuell_stapel = 'jetzt';
    await sql`insert into korrekturen (user_id, item_id, von, zu) values (${uid}, ${id}, 'jetzt', 'eine-sache')`;
  }
  if (b.erledigt === true && vorher.status !== 'erledigt') { set.status = 'erledigt'; set.erledigt_at = new Date(); }
  if (b.erledigt === false && vorher.status === 'erledigt') { set.status = 'sortiert'; set.erledigt_at = null; }
  if (typeof b.zeit === 'string' && (b.zeit === '' || /^\d{2}:\d{2}$/.test(b.zeit))) { set.zeit = b.zeit || null; set.zeit_tag = b.zeit ? tag : null; }
  if (typeof b.ziel === 'string') {
    const ziele = liste(await getSetting(proNutzer('ziele', uid)));
    if (b.ziel === '' || ziele.includes(b.ziel)) set.ziel = b.ziel || null;
  }
  if (typeof b.text === 'string' && b.text.trim()) set.text = b.text.trim().slice(0, 8000);
  if (typeof b.wenn === 'string') set.wenn = b.wenn.trim().slice(0, 300) || null;
  if ([-1, 0, 1].includes(b.energie)) set.energie = b.energie;
  if ((KATEGORIEN as readonly string[]).includes(b.kategorie)) { set.kategorie = b.kategorie; set.status = 'sortiert'; set.parken_bis = b.kategorie === 'idee' ? new Date(Date.now() + 72 * 3600_000) : null; }
  if ((ARTEN as readonly string[]).includes(b.art)) set.art = b.art;
  if ((TYPEN as readonly string[]).includes(b.typ)) set.typ = b.typ;
  if (b.status === 'archiv' || b.status === 'sortiert') {
    set.status = b.status;
    if (b.status === 'sortiert' && vorher.status === 'archiv') await sql`delete from korrekturen where item_id = ${id} and zu = 'archiv' and created_at > now() - interval '2 minutes'`;
    if (b.status === 'archiv' && vorher.stapel === 'streichen') await sql`insert into korrekturen (user_id, item_id, von, zu) values (${uid}, ${id}, 'streichen', 'archiv')`;
  }
  if (!Object.keys(set).length) return NextResponse.json({ error: 'nichts zu ändern' }, { status: 400 });
  set.updated_at = new Date();
  const [item] = await sql<Item[]>`update items set ${sql(set)} where id = ${id} and user_id = ${uid} returning *`;
  // Wird etwas neu zur Aufgabe, sortiert Claude es ein.
  if (set.kategorie && (AKTIV as readonly string[]).includes(String(set.kategorie)) && vorher.kategorie !== set.kategorie) after(() => sortiere('nachtrag', uid));
  return NextResponse.json({ ...item, verdraengt });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  await ensureSchema();
  await sql`delete from items where id = ${id} and user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
