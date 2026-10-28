import { ensureSchema, getSetting, proNutzer, sql } from './db';
import { kontenZeilen, streifen, type KontoZeile, type StreifenBlock } from './cockpit-regeln';
import { geldStand } from './geld';
import { kalenderStand } from './kalender';
import { koerperStand } from './koerper';
import { menschenStand } from './menschen';
import { offene } from './priorisieren';
import { wochenziel } from './stand';
import { aufgabe } from './tag';
import { montagVon } from './tagesregeln';
import { heuteBerlin, minutenBerlin } from './zeit';

export type Cockpit = {
  erholung: number | null; schlafMin: number | null; whoop: boolean;
  frei: number | null; kalender: boolean; streifen: StreifenBlock[];
  woche: { erledigt: number; fokus: { erledigt: number; von: number } | null; wochenziel: string };
  konten: KontoZeile[];
};

/**
 * Alles für das Cockpit auf Heute in einem Abruf. Jeder Teil darf einzeln fehlen (kein WHOOP, kein Kalender, kein Geld),
 * dann zeigt die Kachel den nächsten Schritt statt einer Null.
 */
export async function cockpit(userId: string): Promise<Cockpit> {
  await ensureSchema();
  const heute = heuteBerlin(); const ab = minutenBerlin(); const montag = montagVon(heute);
  const [items, kal, k, m, g, wz, fokusRoh, [erl], [ruhe], [kraft]] = await Promise.all([
    offene(userId).catch(() => []),
    kalenderStand(userId).catch(() => null),
    koerperStand(userId).catch(() => null),
    menschenStand(userId).catch(() => null),
    geldStand(userId).catch(() => null),
    wochenziel(userId).catch(() => ''),
    getSetting(proNutzer('fokus', userId)),
    sql<{ n: number }[]>`select count(*)::int as n from items where user_id = ${userId} and status = 'erledigt' and (erledigt_at at time zone 'Europe/Berlin')::date >= ${montag}::date`,
    sql<{ min: number }[]>`select coalesce(round(sum(dauer_sek) / 60.0), 0)::int as min from ruhe where user_id = ${userId} and tag = ${heute}`,
    sql<{ n: number }[]>`select count(*)::int as n from trainings where user_id = ${userId} and tag = ${heute} and art = 'kraft'`,
  ]);
  // Die eine Sache steht groß darüber, im Streifen nur die anderen Aufgaben mit Uhrzeit
  const eins = items.filter((i) => i.stapel === 'jetzt').sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99))[0];
  const jetzt = items.filter((i) => i.stapel === 'jetzt' && i.zeit_tag === heute && i !== eins)
    .map((i) => ({ titel: aufgabe(i), zeit: i.zeit, dauer: i.aufwand_min }));
  const s = streifen(kal?.heute?.bloecke ?? [], jetzt, ab);
  // Drei Dinge der Woche aus dem Wochenstart: wie viele davon sind erledigt
  let fokus: Cockpit['woche']['fokus'] = null;
  try {
    const f = JSON.parse(fokusRoh || '{}');
    if (f.montag === montag && Array.isArray(f.ids) && f.ids.length) {
      const ids = f.ids.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
      const [r] = ids.length ? await sql<{ n: number }[]>`select count(*)::int as n from items where user_id = ${userId} and id in ${sql(ids)} and status = 'erledigt'` : [{ n: 0 }];
      fokus = { erledigt: r.n, von: ids.length };
    }
  } catch { fokus = null; }
  const geb = m?.geburtstage.find((p) => p.bisGeburtstag !== null && p.bisGeburtstag <= 7) ?? null;
  const faellig = m?.faellig[0] ?? null;
  const woche = g?.woche ?? [];
  const nacht = k?.letzteNacht ?? null;
  return {
    erholung: nacht?.erholung ?? null, schlafMin: nacht?.schlaf_min ?? null, whoop: !!nacht,
    frei: kal?.heute ? kal.heute.frei : null, kalender: !!kal?.bereit, streifen: s,
    woche: { erledigt: erl.n, fokus, wochenziel: wz },
    konten: kontenZeilen({
      frei: kal?.heute ? kal.heute.frei : null, naechsterTermin: s.find((b) => b.quelle === 'kalender') ?? null,
      trainingstag: !!k?.trainingstagHeute, kraftHeute: kraft.n > 0, trainingUhrzeit: k?.stand.uhrzeit ?? null,
      protein: k?.essen ? (k.essen.protein + k.essen.protein_bis) / 2 : null, proteinZiel: k?.proteinZiel ?? null,
      ruheMinHeute: ruhe.min, ruheTageWoche: k?.ruheTage ?? 0,
      geburtstag: geb ? { name: geb.name, inTagen: geb.bisGeburtstag! } : null,
      faellig: faellig ? { name: faellig.name, seit: faellig.seit } : null,
      geld: woche.length ? { ausgaben: woche.reduce((a, t) => a + (t.ausgaben ?? 0), 0), rahmen: woche.reduce((a, t) => a + (t.rahmen ?? 0), 0) } : null,
    }),
  };
}
