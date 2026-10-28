import { ensureSchema, sql } from './db';
import { kalenderListe, termine } from './kalender';
import { wochenTag, type WochenTag } from './kalender-regeln';
import { koerperStand } from './koerper';
import { montagVon } from './tagesregeln';
import { rhythmen, wochenTage, type Rhythmus } from './woche-regeln';
import { heuteBerlin, plusTage } from './zeit';
import { haushalt } from './geld';

export type Woche = { montag: string; heute: string; kalender: boolean; tage: WochenTag[]; rhythmen: Rhythmus[] };

/** Die Woche von Montag bis Sonntag: Termine pro Tag mit freier Zeit, dazu die Rhythmen der fünf Konten. */
export async function woche(userId: string): Promise<Woche> {
  await ensureSchema();
  const heute = heuteBerlin(); const montag = montagVon(heute); const tage = wochenTage(montag); const ende = plusTage(montag, 7);
  const h = await haushalt(userId).catch(() => null);
  const [kal, t, k, erl, tr, ru, ko, bu] = await Promise.all([
    kalenderListe(userId).catch(() => []),
    termine(userId, montag, 7).catch(() => []),
    koerperStand(userId).catch(() => null),
    sql<{ tag: string; n: number }[]>`select (erledigt_at at time zone 'Europe/Berlin')::date::text as tag, count(*)::int as n from items
      where user_id = ${userId} and status = 'erledigt' and erledigt_at >= ${montag}::date and (erledigt_at at time zone 'Europe/Berlin')::date < ${ende}::date group by 1`,
    sql<{ tag: string }[]>`select distinct tag::text as tag from trainings where user_id = ${userId} and tag >= ${montag} and tag < ${ende}`,
    sql<{ tag: string }[]>`select tag::text as tag from ruhe where user_id = ${userId} and tag >= ${montag} and tag < ${ende} group by tag having sum(dauer_sek) >= 60`,
    sql<{ tag: string }[]>`select distinct tag::text as tag from kontakte where user_id = ${userId} and tag >= ${montag} and tag < ${ende}`,
    h ? sql<{ tag: string }[]>`select distinct tag::text as tag from geld_buchungen where haushalt_id = ${h} and user_id = ${userId} and tag >= ${montag} and tag < ${ende}` : Promise.resolve([]),
  ]);
  return {
    montag, heute, kalender: kal.some((x) => x.an),
    tage: tage.map((tag, i) => wochenTag(t, tag, i)),
    rhythmen: rhythmen({
      tage, heute, erledigt: Object.fromEntries(erl.map((r) => [r.tag, r.n])),
      training: tr.map((r) => r.tag), kraft: k?.kraft ?? 0, kraftSoll: k?.stand.einheitenSoll ?? 3, ausdauerMin: k?.zone2 ?? 0,
      ruhe: ru.map((r) => r.tag), kontakte: ko.map((r) => r.tag), buchungen: bu.map((r) => r.tag),
    }),
  };
}
