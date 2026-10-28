import { getSetting, ensureSchema, proNutzer, sql } from './db';
import { namenAus } from './pseudonym';
import { heuteBerlin } from './priorisieren';
import { bisGeburtstag, faellig, freundschaftsStufe, KREISE, TAKT, type Kreis } from './menschen-regeln';

/**
 * Menschen in Peters Leben. Life erkennt bekannte Namen in Einträgen selbst (ohne Claude) und zählt das als Kontakt.
 * Neue Namen schlägt Life vor, sobald Claude sie einmal gemeldet hat.
 */

export type Person = { id: string; name: string; kreis: Kreis; geburtstag: string | null; takt_tage: number; notiz: string | null; created_at: string };

export async function menschenStand(userId: string) {
  await ensureSchema();
  const heute = heuteBerlin();
  const [personen, letzte, auto] = await Promise.all([
    sql<Person[]>`select id::text, name, kreis, geburtstag::text, takt_tage, notiz, created_at::date::text as created_at from personen where user_id = ${userId} order by kreis, name`,
    sql<{ person_id: string; tag: string; minuten: number; woche_min: number; anzahl: number }[]>`
      select person_id::text, max(tag)::text as tag, coalesce(sum(minuten), 0)::int as minuten,
        coalesce(sum(minuten) filter (where tag >= date_trunc('week', ${heute}::date)), 0)::int as woche_min, count(*)::int as anzahl
      from kontakte where user_id = ${userId} group by person_id`,
    getSetting(proNutzer('namen_auto', userId)),
  ]);
  const liste = personen.map((p) => {
    const k = letzte.find((x) => x.person_id === p.id);
    const f = faellig(k?.tag ?? null, p.created_at, p.takt_tage, heute);
    const stunden = Math.round(((k?.minuten ?? 0) / 60) * 10) / 10;
    return { ...p, letzter: k?.tag ?? null, seit: f.seit, faellig: f.faellig, stunden, wocheMin: k?.woche_min ?? 0, kontakte: k?.anzahl ?? 0,
      bisGeburtstag: p.geburtstag ? bisGeburtstag(p.geburtstag, heute) : null, freundschaft: p.kreis === 'freunde' ? freundschaftsStufe(stunden) : null };
  });
  const bekannt = new Set(personen.map((p) => p.name.toLowerCase()));
  const vorschlaege = namenAus(auto).filter((n) => n.art === 'Person' && !bekannt.has(n.name.toLowerCase())).map((n) => n.name).slice(0, 12);
  return {
    heute, liste, vorschlaege,
    faellig: liste.filter((p) => p.faellig).sort((a, b) => b.seit / b.takt_tage - a.seit / a.takt_tage),
    geburtstage: liste.filter((p) => p.bisGeburtstag !== null && p.bisGeburtstag <= 14).sort((a, b) => a.bisGeburtstag! - b.bisGeburtstag!),
    wocheMin: liste.reduce((a, p) => a + p.wocheMin, 0),
    familieMin: liste.filter((p) => p.kreis === 'familie').reduce((a, p) => a + p.wocheMin, 0),
  };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Findet bekannte Personen im Text eines Eintrags und hält das als Kontakt fest. Läuft lokal, ohne Claude. */
export async function kontakteAusEintrag(itemId: string, text: string, userId: string) {
  await ensureSchema();
  const personen = await sql<{ id: string; name: string }[]>`select id::text, name from personen where user_id = ${userId}`;
  for (const p of personen) {
    if (!new RegExp(`(?<![\\p{L}\\p{N}])${esc(p.name)}s?(?![\\p{L}\\p{N}])`, 'iu').test(text)) continue;
    await sql`insert into kontakte (user_id, person_id, tag, art, item_id) values (${userId}, ${p.id}, ${heuteBerlin()}, 'eintrag', ${itemId}) on conflict do nothing`;
  }
}

/** Für den Coach: fällige Menschen und Geburtstage. Namen werden dort ohnehin zu Platzhaltern. */
export async function menschenKurz(userId: string): Promise<string> {
  const m = await menschenStand(userId);
  const z: string[] = [];
  if (m.faellig.length) z.push('Länger kein Kontakt: ' + m.faellig.slice(0, 4).map((p) => `${p.name} (${KREISE[p.kreis]}, seit ${p.seit} Tagen)`).join(', '));
  if (m.geburtstage.length) z.push('Geburtstage bald: ' + m.geburtstage.slice(0, 3).map((p) => `${p.name} ${p.bisGeburtstag === 0 ? 'heute' : `in ${p.bisGeburtstag} Tagen`}`).join(', '));
  if (m.liste.length) z.push(`Zeit mit Menschen diese Woche: ${Math.round(m.wocheMin / 60 * 10) / 10} Stunden, davon Familie ${Math.round(m.familieMin / 60 * 10) / 10}`);
  return z.join('\n');
}

export { TAKT };
