import { ensureSchema, getSetting, sql, type Item } from './db';
import { koerperStand } from './koerper';
import { menschenStand } from './menschen';
import { heuteBerlin, offene } from './priorisieren';
import { empfehlung, montagVon, offenePunkte, type Empfehlung } from './tagesregeln';

/** Sammelt die Lage des Tages aus der Datenbank: Empfehlung, offene Punkte, Wochenstart. */

const uhr = () => {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date());
  const g = (k: string) => t.find((x) => x.type === k)?.value ?? '';
  return { stunde: Number(g('hour')), minute: Number(g('minute')), wochentag: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday')) + 1 };
};
export const aufgabe = (i: Pick<Item, 'schritt' | 'titel' | 'text'>) => (i.schritt || i.titel || i.text).slice(0, 80);

export async function wochenstartOffen(userId = 'peter') {
  return (await getSetting(`wochenstart:${userId}`)) !== montagVon(heuteBerlin());
}

export type Tageslage = { empfehlung: Empfehlung; offen: string[]; wochenstartOffen: boolean; jetzt: { id: string; titel: string; zeit: string | null; erledigt: boolean }[] };

export async function tageslage(userId = 'peter'): Promise<Tageslage> {
  await ensureSchema();
  const heute = heuteBerlin(); const u = uhr();
  const [k, items, erledigt, [ci], [heuteT], m, wo] = await Promise.all([
    koerperStand(userId),
    offene(),
    sql<Item[]>`select * from items where user_id = ${userId} and status = 'erledigt' and (erledigt_at at time zone 'Europe/Berlin')::date = ${heute}::date and stapel = 'jetzt'`,
    sql<{ morgen: boolean; abend: boolean; erholung: number | null }[]>`select bool_or(art = 'morgen') as morgen, bool_or(art = 'abend') as abend,
      max((antworten->'erholung'->>'wert')::int) filter (where art = 'morgen') as erholung from checkins where user_id = ${userId} and tag = ${heute}`,
    sql<{ kraft: boolean; ruhe: number }[]>`select exists(select 1 from trainings where user_id = ${userId} and tag = ${heute} and art = 'kraft') as kraft,
      coalesce((select round(sum(dauer_sek) / 60.0) from ruhe where user_id = ${userId} and tag = ${heute}), 0)::int as ruhe`,
    menschenStand(userId).catch(() => null),
    wochenstartOffen(userId),
  ]);
  const jetzt = [
    ...items.filter((i) => i.stapel === 'jetzt').map((i) => ({ id: i.id, titel: aufgabe(i), zeit: i.zeit && i.zeit_tag === heute ? i.zeit : null, erledigt: false })),
    ...erledigt.map((i) => ({ id: i.id, titel: aufgabe(i), zeit: null, erledigt: true })),
  ];
  const n = k.letzteNacht;
  return {
    wochenstartOffen: wo, jetzt,
    empfehlung: empfehlung({ ...u, erholung: n?.erholung ?? null, schlafMin: n?.schlaf_min ?? null, morgenErholung: ci?.erholung ?? null, trainingstag: k.trainingstagHeute, kraftHeute: heuteT.kraft, ruheHeuteMin: heuteT.ruhe, kontakt: m?.faellig[0]?.name ?? null, wochenstartOffen: wo }),
    offen: offenePunkte({ ...u, jetzt, morgen: !!ci?.morgen, abend: !!ci?.abend, trainingstag: k.trainingstagHeute, kraftHeute: heuteT.kraft, trainingUhrzeit: k.stand.uhrzeit, wochenstartOffen: wo }),
  };
}
