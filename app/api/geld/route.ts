import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { betragAus } from '@/lib/geld-regeln';
import { bonLesen, geldStand, haushalt, topfVorschlag } from '@/lib/geld';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';
import { oeffentlich } from '@/lib/fehler';
import { jpegSaeubern } from '@/lib/jpeg';


const cent = (x: unknown, max = 100_000_000) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };
const name = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 60) : '');

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json(await geldStand(uid));
}

export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const h = await haushalt(uid);
  const tag = heuteBerlin();
  const eigenerTopf = async (id: unknown) => {
    const n = Number(id); if (!Number.isInteger(n)) return null;
    const [t] = await sql<{ id: string; art: string }[]>`select id::text, art from geld_toepfe where id = ${n} and haushalt_id = ${h} and aktiv`;
    return t ?? null;
  };
  try {
    switch (b.aktion) {
      case 'buchung': {
        const p = typeof b.text === 'string' ? betragAus(b.text) : null;
        const c = cent(b.cent) ?? p?.cent; const was = name(b.was) || p?.was || 'Ausgabe';
        if (!c) return NextResponse.json({ error: 'Kein Betrag erkannt. Zum Beispiel: 12,50 Bäcker' }, { status: 400 });
        let topf = (await eigenerTopf(b.topf_id))?.id ?? null;
        if (!topf) { const woche = await sql<{ id: string; name: string }[]>`select id::text, name from geld_toepfe where haushalt_id = ${h} and art = 'woche' and aktiv order by sortierung, id`; topf = await topfVorschlag(was, woche); }
        await sql`insert into geld_buchungen (haushalt_id, user_id, tag, cent, topf_id, was, quelle) values (${h}, ${uid}, ${tag}, ${c}, ${topf}, ${was}, ${b.quelle === 'hand' ? 'hand' : 'sprache'})`;
        return NextResponse.json({ ok: true, cent: c, was });
      }
      case 'bon': {
        const roh = typeof b.bild === 'string' ? b.bild.replace(/^data:image\/jpeg;base64,/, '') : '';
        const bild = roh && roh.length <= 2_000_000 ? jpegSaeubern(roh) : null;
        if (!bild) return NextResponse.json({ error: 'Foto zu groß oder ungültig' }, { status: 400 });
        const woche = await sql<{ id: string; name: string }[]>`select id::text, name from geld_toepfe where haushalt_id = ${h} and art = 'woche' and aktiv order by sortierung, id`;
        const r = await bonLesen(bild, woche.map((t) => t.name));
        const topf = (await eigenerTopf(b.topf_id))?.id ?? woche.find((t) => t.name === r.topf)?.id ?? woche[0]?.id ?? null;
        await sql`insert into geld_buchungen (haushalt_id, user_id, tag, cent, topf_id, was, quelle) values (${h}, ${uid}, ${tag}, ${r.cent}, ${topf}, ${r.laden}, 'bon')`;
        return NextResponse.json({ ok: true, cent: r.cent, was: r.laden });
      }
      case 'topf': {
        const art = ['woche', 'spar', 'kind'].includes(b.art) ? b.art : null; const n = name(b.name); const c = cent(b.betrag_cent);
        if (!art || !n || c === null) return NextResponse.json({ error: 'Name und Betrag fehlen' }, { status: 400 });
        await sql`insert into geld_toepfe (haushalt_id, name, art, betrag_cent) values (${h}, ${n}, ${art}, ${c})`;
        return NextResponse.json({ ok: true });
      }
      case 'sparen': {
        const t = await eigenerTopf(b.topf_id); const c = Math.round(Number(b.cent));
        if (!t || t.art !== 'spar' || !Number.isFinite(c) || Math.abs(c) > 100_000_000) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
        await sql`update geld_toepfe set stand_cent = greatest(0, stand_cent + ${c}) where id = ${t.id}`;
        return NextResponse.json({ ok: true });
      }
      case 'taschengeld': {
        const t = await eigenerTopf(b.topf_id); const c = cent(b.cent, 100_000);
        if (!t || t.art !== 'kind' || !c) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
        await sql`insert into geld_buchungen (haushalt_id, user_id, tag, cent, topf_id, was, quelle) values (${h}, ${uid}, ${tag}, ${c}, ${t.id}, ${name(b.was) || 'Taschengeld ausgegeben'}, 'hand')`;
        return NextResponse.json({ ok: true });
      }
      case 'posten': {
        const art = ['einnahme', 'fest', 'schuld'].includes(b.art) ? b.art : null; const n = name(b.name); const c = cent(b.cent);
        if (!art || !n || !c) return NextResponse.json({ error: 'Name und Betrag fehlen' }, { status: 400 });
        await sql`insert into geld_posten (haushalt_id, art, name, cent) values (${h}, ${art}, ${n}, ${c})`;
        return NextResponse.json({ ok: true });
      }
      case 'profil': {
        const r = cent(b.ruecklage_cent); const s = cent(b.sparrate_cent); const m = [3, 6, 9, 12].includes(b.puffer_monate) ? b.puffer_monate : null;
        await sql`insert into geld_profil (haushalt_id) values (${h}) on conflict do nothing`;
        if (r !== null) await sql`update geld_profil set ruecklage_cent = ${r}, updated_at = now() where haushalt_id = ${h}`;
        if (s !== null) await sql`update geld_profil set sparrate_cent = ${s}, updated_at = now() where haushalt_id = ${h}`;
        if (m !== null) await sql`update geld_profil set puffer_monate = ${m}, updated_at = now() where haushalt_id = ${h}`;
        return NextResponse.json({ ok: true });
      }
    }
  } catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Das hat nicht geklappt. Bitte nochmal.') }, { status: 502 }); }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

/** Wochenbetrag eines Topfs ändern. */
export async function PATCH(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const h = await haushalt(uid); const c = cent(b.betrag_cent); const id = Number(b.id);
  if (!Number.isInteger(id) || c === null) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await sql`update geld_toepfe set betrag_cent = ${c} where id = ${id} and haushalt_id = ${h}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const h = await haushalt(uid);
  const art = req.nextUrl.searchParams.get('art'); const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  if (art === 'buchung') await sql`delete from geld_buchungen where id = ${id} and haushalt_id = ${h}`;
  else if (art === 'posten') await sql`delete from geld_posten where id = ${id} and haushalt_id = ${h}`;
  else if (art === 'topf') await sql`update geld_toepfe set aktiv = false where id = ${id} and haushalt_id = ${h}`;
  else return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
