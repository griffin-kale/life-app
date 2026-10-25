import { ensureSchema, getSetting, setSetting, sql } from './db';
import { who5, wochenTag, type Antwort } from './fragen';
import { geldStand, haushalt } from './geld';
import { proteinZiel, trainingStand } from './koerper';
import { heuteBerlin } from './priorisieren';
import { KONTEN, level, meilensteineAktualisieren, MEILENSTEINE, ring, wochenTage, type Konto, type Summen, type Teil } from './kompass-regeln';

/** Der Kompass: Ringe pro Konto für die letzten Wochen, Level, Meilensteine. Alles aus Daten, die schon da sind. */

const WOCHEN = 8;
type Zahl = Record<string, number>;
const nachWoche = <T extends { w: string }>(rows: T[]) => new Map(rows.map((r) => [r.w, r]));

export async function kompassStand(userId = 'peter') {
  await ensureSchema();
  const heute = heuteBerlin();
  const montag = wochenTag(heute);
  const wochen = Array.from({ length: WOCHEN }, (_, i) => new Date(Date.parse(montag + 'T12:00:00Z') - (WOCHEN - 1 - i) * 7 * 864e5).toISOString().slice(0, 10));
  const start = wochen[0];
  const h = await haushalt(userId);
  const [erledigt, wissen, abende, boegen, ruhe, training, naechte, essen, geldWoche, toepfe, stand, pz, alle, kontakte, personenN, wennN] = await Promise.all([
    sql<{ w: string; engpass: number; sozial: number }[]>`select date_trunc('week', erledigt_at at time zone 'Europe/Berlin')::date::text as w,
      count(*) filter (where hebel >= 2 or kategorie = 'engpass')::int as engpass, count(*) filter (where art = 'sozial' or kategorie = 'privat')::int as sozial
      from items where user_id = ${userId} and status = 'erledigt' and erledigt_at >= ${start} group by 1`,
    sql<{ w: string; n: number }[]>`select date_trunc('week', created_at at time zone 'Europe/Berlin')::date::text as w, count(*)::int as n from items where user_id = ${userId} and kategorie = 'wissen' and created_at >= ${start} group by 1`,
    sql<{ w: string; tage: number; plan: number }[]>`select date_trunc('week', tag)::date::text as w, count(*)::int as tage, count(*) filter (where antworten->'plan'->>'aufgabe' is not null or antworten->'plan'->>'notiz' is not null)::int as plan
      from checkins where user_id = ${userId} and art = 'abend' and tag >= ${start} group by 1`,
    sql<{ w: string; antworten: Record<string, Antwort> }[]>`select tag::text as w, antworten from checkins where user_id = ${userId} and art = 'woche' and tag >= ${start}`,
    sql<{ w: string; min: number }[]>`select date_trunc('week', tag)::date::text as w, round(sum(dauer_sek) / 60.0)::int as min from ruhe where user_id = ${userId} and tag >= ${start} group by 1`,
    sql<{ w: string; kraft: number; zone2: number; intervall: number }[]>`select date_trunc('week', tag)::date::text as w, count(distinct tag) filter (where art = 'kraft')::int as kraft,
      coalesce(sum(zone2_min), 0)::int as zone2, count(*) filter (where art = 'intervall')::int as intervall from trainings where user_id = ${userId} and tag >= ${start} group by 1`,
    sql<{ w: string; daten: number; gut: number }[]>`select date_trunc('week', tag)::date::text as w, count(*) filter (where schlaf_min is not null)::int as daten, count(*) filter (where schlaf_min >= 420)::int as gut
      from koerper_tage where user_id = ${userId} and tag >= ${start} group by 1`,
    sql<{ w: string; tag: string; protein: number }[]>`select date_trunc('week', tag)::date::text as w, tag::text, sum((protein + coalesce(protein_bis, protein)) / 2)::float as protein from mahlzeiten where user_id = ${userId} and tag >= ${start} group by 1, 2`,
    sql<{ w: string; topf_id: string; summe: number; tage: number }[]>`select date_trunc('week', tag)::date::text as w, topf_id::text, sum(cent)::int as summe, count(distinct tag)::int as tage
      from geld_buchungen b join geld_toepfe t on t.id = b.topf_id where b.haushalt_id = ${h} and t.art = 'woche' and b.tag >= ${start} group by 1, 2`,
    sql<{ id: string; betrag_cent: number; start: string }[]>`select id::text, betrag_cent, start::text from geld_toepfe where haushalt_id = ${h} and art = 'woche' and aktiv`,
    trainingStand(userId),
    proteinZiel(userId),
    sql<{ kraft: number; ruhe: number; abende: number; boegen: number; engpass: number }[]>`select
      (select count(*)::int from trainings where user_id = ${userId} and art = 'kraft') as kraft,
      (select coalesce(round(sum(dauer_sek) / 60.0), 0)::int from ruhe where user_id = ${userId}) as ruhe,
      (select count(*)::int from checkins where user_id = ${userId} and art = 'abend') as abende,
      (select count(*)::int from checkins where user_id = ${userId} and art = 'woche') as boegen,
      (select count(*)::int from items where user_id = ${userId} and status = 'erledigt' and (hebel >= 2 or kategorie = 'engpass')) as engpass`,
    sql<{ w: string; min: number; leute: number }[]>`select date_trunc('week', tag)::date::text as w, coalesce(sum(minuten), 0)::int as min, count(distinct person_id)::int as leute from kontakte where user_id = ${userId} and tag >= ${start} group by 1`,
    sql<{ n: number }[]>`select count(*)::int as n from personen where user_id = ${userId}`,
    sql<{ w: string; n: number }[]>`select date_trunc('week', erledigt_at at time zone 'Europe/Berlin')::date::text as w, count(*)::int as n from items where user_id = ${userId} and status = 'erledigt' and wenn is not null and erledigt_at >= ${start} group by 1`,
  ]);
  const [tagCheck, tagErledigt] = await Promise.all([
    sql<{ tag: string; art: string }[]>`select tag::text as tag, art from checkins where user_id = ${userId} and art in ('morgen', 'abend') and tag >= ${montag}`,
    sql<{ tag: string; n: number }[]>`select (erledigt_at at time zone 'Europe/Berlin')::date::text as tag, count(*)::int as n from items where user_id = ${userId} and status = 'erledigt' and (erledigt_at at time zone 'Europe/Berlin')::date >= ${montag}::date group by 1`,
  ]);
  const tagDaten = new Map<string, { morgen: boolean; abend: boolean; erledigt: number }>();
  const tagHol = (t: string) => tagDaten.get(t) ?? (tagDaten.set(t, { morgen: false, abend: false, erledigt: 0 }), tagDaten.get(t)!);
  for (const c of tagCheck) tagHol(c.tag)[c.art as 'morgen' | 'abend'] = true;
  for (const e of tagErledigt) tagHol(e.tag).erledigt = e.n;
  const mK = nachWoche(kontakte), mP = nachWoche(wennN);
  const mE = nachWoche(erledigt), mW = nachWoche(wissen), mA = nachWoche(abende), mR = nachWoche(ruhe), mT = nachWoche(training), mN = nachWoche(naechte);
  const bogen = new Map(boegen.map((b) => [b.w, b.antworten]));
  const proteinTage = (w: string) => essen.filter((e) => e.w === w && e.protein >= pz.ziel).length;
  const essenTage = (w: string) => essen.filter((e) => e.w === w).length;

  const verlauf = wochen.map((w) => {
    const geld = toepfe.filter((t) => t.start < new Date(Date.parse(w + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10));
    const imRahmen = geld.filter((t) => (geldWoche.find((g) => g.w === w && g.topf_id === t.id)?.summe ?? 0) <= t.betrag_cent).length;
    const geldTage = new Set(geldWoche.filter((g) => g.w === w).map((g) => g.topf_id)).size ? Math.max(...geldWoche.filter((g) => g.w === w).map((g) => g.tage)) : 0;
    const t: Record<Konto, Teil[]> = {
      zeit: [{ name: 'Aufgaben mit hohem Hebel', ist: mE.get(w)?.engpass ?? 0, ziel: 5 }, { name: 'Abende mit Plan für morgen', ist: mA.get(w)?.plan ?? 0, ziel: 5 }, { name: 'Erledigt nach Wenn-dann-Plan', ist: mP.get(w)?.n ?? 0, ziel: 3 }],
      sozial: [{ name: 'Erledigtes für Familie und Freunde', ist: mE.get(w)?.sozial ?? 0, ziel: 3 },
        ...(personenN[0].n ? [{ name: 'Zeit mit Menschen', ist: Math.round((mK.get(w)?.min ?? 0) / 6) / 10, ziel: 6, einheit: 'Std.' }, { name: 'Menschen kontaktiert', ist: mK.get(w)?.leute ?? 0, ziel: Math.min(5, personenN[0].n) }] : [])],
      mental: [{ name: 'Ruhe', ist: mR.get(w)?.min ?? 0, ziel: 60, einheit: 'Min.' }, { name: 'Abendfragen', ist: mA.get(w)?.tage ?? 0, ziel: 5 }, { name: 'Neues Wissen festgehalten', ist: mW.get(w)?.n ?? 0, ziel: 2 }],
      koerper: [
        { name: 'Kraft', ist: mT.get(w)?.kraft ?? 0, ziel: stand.einheitenSoll },
        { name: 'Zone 2', ist: mT.get(w)?.zone2 ?? 0, ziel: 180, einheit: 'Min.' },
        { name: 'Intervalle', ist: mT.get(w)?.intervall ?? 0, ziel: 1 },
        ...(mN.get(w)?.daten ? [{ name: 'Nächte mit 7 Stunden', ist: mN.get(w)!.gut, ziel: 5 }] : []),
        ...(essenTage(w) ? [{ name: 'Tage mit Protein-Ziel', ist: proteinTage(w), ziel: 5 }] : []),
      ],
      geld: geld.length ? [{ name: 'Töpfe im Rahmen', ist: imRahmen, ziel: geld.length }, { name: 'Tage mit erfassten Ausgaben', ist: geldTage, ziel: 4 }] : [],
    };
    const b = bogen.get(w);
    const gefuehl = Object.fromEntries(KONTEN.map((k) => [k, b?.[k]?.wert ?? null])) as Record<Konto, number | null>;
    const ringe = Object.fromEntries(KONTEN.map((k) => [k, ring(t[k])])) as Record<Konto, number | null>;
    return { woche: w, teile: t, ringe, gefuehl, who5: b ? who5(b) : null, alleZu: KONTEN.every((k) => (ringe[k] ?? 0) >= 1), toepfeImRahmen: geld.length > 0 && imRahmen === geld.length && w < montag };
  });

  const punkte = Object.fromEntries(KONTEN.map((k) => [k, verlauf.reduce((a, v) => a + (v.ringe[k] ?? 0) * 100, 0)])) as Zahl;
  const gesamt = Object.values(punkte).reduce((a, b) => a + b, 0) / KONTEN.length;
  const g = await geldStand(userId).catch(() => null);
  const summen: Summen = {
    kraft: alle[0].kraft, ruheMin: alle[0].ruhe, abende: alle[0].abende, wochenboegen: alle[0].boegen, engpassErledigt: alle[0].engpass,
    who5Max: Math.max(-1, ...verlauf.map((v) => v.who5 ?? -1)) >= 0 ? Math.max(...verlauf.map((v) => v.who5 ?? -1)) : null,
    wochenAlleRinge: verlauf.filter((v) => v.alleZu).length, wochenToepfeImRahmen: verlauf.filter((v) => v.toepfeImRahmen).length,
    geldStufe: g?.aktuell.nr ?? 1, protein: Math.max(0, ...wochen.map(proteinTage)),
  };
  let alt: Record<string, string> = {};
  try { alt = JSON.parse((await getSetting(`meilensteine:${userId}`)) || '{}'); } catch { alt = {}; }
  const m = meilensteineAktualisieren(alt, summen, heute);
  if (m.neu.length) await setSetting(`meilensteine:${userId}`, JSON.stringify(m.alle));
  return {
    wochen, verlauf, jetzt: verlauf[verlauf.length - 1], tage: wochenTage(montag, heute, tagDaten),
    level: Object.fromEntries(KONTEN.map((k) => [k, level(punkte[k])])), gesamt: level(gesamt),
    meilensteine: MEILENSTEINE.map((x) => ({ id: x.id, name: x.name, wie: x.wie, konto: x.konto, am: m.alle[x.id] ?? null })),
    neu: m.neu.map((id) => MEILENSTEINE.find((x) => x.id === id)!.name),
  };
}
