import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, getSetting, setSetting, sql, type Item, proNutzer } from '@/lib/db';
import { kompassStand } from '@/lib/kompass';
import { engpassAus, heuteBerlin, offene } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { aufgabe } from '@/lib/tag';
import { engpassSetzen, montagVon } from '@/lib/tagesregeln';
import { wochenziel, wochenzielSetzen } from '@/lib/stand';
import { mitNutzer } from '@/lib/sitzung';
import { geldKurz, geldStand } from '@/lib/geld';
import { who5 } from '@/lib/fragen';

/** Wochenstart: Rückblick, Engpass prüfen, drei Dinge der Woche, Parkplatz sichten. */
const kurz = (i: Item) => ({ id: i.id, titel: aufgabe(i), stapel: i.stapel });

async function fokusLesen(montag: string, uid: string): Promise<string[]> {
  try { const f = JSON.parse((await getSetting(`fokus:${uid}`)) || '{}'); return f.montag === montag && Array.isArray(f.ids) ? f.ids : []; } catch { return []; }
}

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  await ensureSchema();
  const heute = heuteBerlin(); const montag = montagVon(heute);
  const vor = new Date(Date.parse(montag + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  const [kompass, items, [erledigt], kontext, fokus, fertig, wz, neu] = await Promise.all([
    kompassStand(uid).catch(() => null),
    offene(uid),
    sql<{ n: number }[]>`select count(*)::int as n from items where user_id = ${uid} and status = 'erledigt' and (erledigt_at at time zone 'Europe/Berlin')::date >= ${vor}::date and (erledigt_at at time zone 'Europe/Berlin')::date < ${montag}::date`,
    getSetting(proNutzer('kontext', uid)),
    fokusLesen(montag, uid),
    getSetting(`wochenstart:${uid}`),
    wochenziel(uid),
    // Noch nicht einsortierte Einträge zählen auch, sonst bleibt „Drei Dinge“ leer, wenn das Sortieren hängt
    sql<Item[]>`select * from items where user_id = ${uid} and status = 'neu' and merged_into is null and coalesce(kategorie, '') not in ('wissen', 'notiz') order by created_at desc limit 10`,
  ]);
  const letzte = kompass?.verlauf.find((v) => v.woche === vor) ?? null;
  // Wochenrunde (0.27): Fokus der letzten Woche, Geld in einem Satz, WHO-5 alle zwei Wochen
  const [[fokusWoche], geld, geldW, [who]] = await Promise.all([
    sql<{ bloecke: number; minuten: number }[]>`
      select count(*)::int as bloecke, coalesce(sum(least(minuten, extract(epoch from (coalesce(ende, start + make_interval(mins => minuten)) - start)) / 60)), 0)::int as minuten
      from fokus_bloecke where user_id = ${uid} and (start at time zone 'Europe/Berlin')::date >= ${vor}::date and (start at time zone 'Europe/Berlin')::date < ${montag}::date`,
    geldKurz(uid).catch(() => ''),
    geldStand(uid).then((g) => g.warnungen.slice(0, 2)).catch(() => [] as string[]),
    sql<{ tag: string; antworten: Record<string, unknown> }[]>`select tag::text as tag, antworten from checkins where user_id = ${uid} and art = 'woche' order by tag desc limit 1`,
  ]);
  const who5Tage = who && who5(who.antworten) !== null ? Math.round((Date.parse(montag + 'T12:00:00Z') - Date.parse(who.tag + 'T12:00:00Z')) / 864e5) : null;
  const aktiv = items.filter((i) => ['jetzt', 'woche', 'delegieren'].includes(i.stapel ?? ''));
  return NextResponse.json({
    montag, offen: fertig !== montag,
    rueckblick: { ringe: letzte?.ringe ?? null, alleZu: letzte?.alleZu ?? false, erledigt: erledigt.n, liegen: aktiv.filter((i) => new Date(i.created_at).toISOString().slice(0, 10) < vor).slice(0, 5).map(kurz) },
    engpass: engpassAus(kontext),
    kandidaten: [...aktiv, ...items.filter((i) => i.stapel === 'geparkt'), ...neu].slice(0, 24).map(kurz),
    wochenziel: wz,
    geparkt: items.filter((i) => i.stapel === 'geparkt').slice(0, 15).map(kurz),
    fokus,
    fokusWoche, geld, geldWarnungen: geldW,
    who5Faellig: who5Tage === null || who5Tage >= 13, who5Erledigt: who?.tag === montag,
  });
}

export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const montag = montagVon(heuteBerlin());
  if (b.aktion === 'engpass' && typeof b.text === 'string' && b.text.trim()) {
    await setSetting(proNutzer('kontext', uid), engpassSetzen(await getSetting(proNutzer('kontext', uid)), b.text.slice(0, 200)).slice(0, 8000));
    return NextResponse.json({ ok: true });
  }
  if (b.aktion === 'fokus' && Array.isArray(b.ids)) {
    const ids = b.ids.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)).slice(0, 3);
    await setSetting(proNutzer('fokus', uid), JSON.stringify({ montag, ids }));
    return NextResponse.json({ ok: true, ids });
  }
  if (b.aktion === 'wochenziel' && typeof b.text === 'string') { await wochenzielSetzen(b.text, uid); return NextResponse.json({ ok: true }); }
  if (b.aktion === 'fertig') { await setSetting(proNutzer('wochenstart', uid), montag); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: 'ungültig' }, { status: 400 });
}
