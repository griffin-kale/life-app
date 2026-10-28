import { ensureSchema, sql } from './db';
import { wochenTag } from './fragen';
import { heuteBerlin } from './priorisieren';
import { blockWoche, neuerBlock, standStart, TRAININGSTAGE, type Stand } from './training';
import { ausgefalleneTrainings, schlafWarnung, type Nacht } from './coach-regeln';

export type KoerperTag = { tag: string; schlaf_min: number | null; schlaf_leistung: number | null; erholung: number | null; hrv: number | null; ruhepuls: number | null; belastung: number | null };

/** Trainingsstand laden. Nach Woche 5 beginnt automatisch ein neuer Block. */
export async function trainingStand(userId: string): Promise<Stand> {
  await ensureSchema();
  const heute = heuteBerlin();
  const [row] = await sql<{ stand: Stand }[]>`select stand from training_stand where user_id = ${userId}`;
  let s = row?.stand ?? standStart(wochenTag(heute));
  const wochen = Math.floor((Date.parse(heute) - Date.parse(s.blockStart)) / (7 * 864e5));
  if (wochen >= 5) s = neuerBlock(s, wochenTag(heute));
  if (!row || s !== row.stand) await standSpeichern(s, userId);
  return s;
}

export async function standSpeichern(s: Stand, userId: string) {
  await sql`insert into training_stand (user_id, stand) values (${userId}, ${sql.json(s as never)})
    on conflict (user_id) do update set stand = excluded.stand, updated_at = now()`;
}

export async function proteinZiel(userId: string): Promise<{ ziel: number; gewicht: number | null }> {
  const [n] = await sql<{ gewicht_kg: string | null }[]>`select gewicht_kg from nutzer where id = ${userId}`;
  const kg = n?.gewicht_kg ? Number(n.gewicht_kg) : null;
  return { ziel: Math.round((kg ?? 80) * 1.6), gewicht: kg };
}

/** Alles für den Körper-Bildschirm und den Coach. */
export async function koerperStand(userId: string) {
  await ensureSchema();
  const heute = heuteBerlin();
  const montag = wochenTag(heute);
  const [stand, tage, woche, kraftTage, essen, gestern, pz, erste, ruhe] = await Promise.all([
    trainingStand(userId),
    sql<KoerperTag[]>`select tag::text as tag, schlaf_min, schlaf_leistung, erholung, hrv::float as hrv, ruhepuls, belastung::float as belastung
      from koerper_tage where user_id = ${userId} and tag > (${heute}::date - 15) order by tag desc`,
    sql<{ art: string; quelle: string; tag: string; zone2_min: number | null }[]>`
      select art, quelle, tag::text as tag, zone2_min from trainings where user_id = ${userId} and tag >= ${montag}`,
    sql<{ tag: string }[]>`select distinct tag::text as tag from trainings where user_id = ${userId} and art = 'kraft' and tag > (${heute}::date - 15)`,
    sql<{ protein: number; protein_bis: number; kcal: number; kcal_bis: number }[]>`
      select coalesce(sum(protein), 0)::float as protein, coalesce(sum(coalesce(protein_bis, protein)), 0)::float as protein_bis,
        coalesce(sum(kcal), 0)::float as kcal, coalesce(sum(coalesce(kcal_bis, kcal)), 0)::float as kcal_bis
      from mahlzeiten where user_id = ${userId} and tag = ${heute}`,
    sql<{ protein: number | null }[]>`select sum((protein + coalesce(protein_bis, protein)) / 2)::float as protein from mahlzeiten where user_id = ${userId} and tag = (${heute}::date - 1)`,
    proteinZiel(userId),
    sql<{ tag: string | null }[]>`select min(tag)::text as tag from trainings where user_id = ${userId} and art = 'kraft'`,
    sql<{ minuten: number; tage: number }[]>`select coalesce(round(sum(dauer_sek) / 60.0), 0)::int as minuten, count(distinct tag)::int as tage from ruhe where user_id = ${userId} and tag >= ${montag}`,
  ]);
  const kraft = new Set(woche.filter((t) => t.art === 'kraft').map((t) => t.tag)).size;
  const zone2 = woche.reduce((a, t) => a + (t.zone2_min ?? 0), 0);
  const intervall = woche.filter((t) => t.art === 'intervall').length;
  const naechte: Nacht[] = tage.map((t) => ({ tag: t.tag, schlaf_min: t.schlaf_min }));
  const planTage = TRAININGSTAGE[stand.einheitenSoll] ?? TRAININGSTAGE[3];
  const ausgefallen = ausgefalleneTrainings(planTage, kraftTage.map((k) => k.tag), heute, erste[0]?.tag ?? null);
  const wd = (new Date(heute + 'T12:00:00Z').getUTCDay() + 6) % 7;
  return {
    heute, stand, blockWoche: blockWoche(stand.blockStart, heute),
    letzteNacht: tage.find((t) => t.tag === heute) ?? null,
    tage, naechte, kraft, zone2, intervall, ausgefallen,
    trainingstagHeute: planTage.includes(wd) && !kraftTage.some((k) => k.tag === heute),
    ruheMin: ruhe[0]?.minuten ?? 0, ruheTage: ruhe[0]?.tage ?? 0,
    essen: essen[0], proteinGestern: gestern[0]?.protein ?? null, proteinZiel: pz.ziel, gewicht: pz.gewicht,
    warnungen: [schlafWarnung(naechte), ausgefallen >= 2 ? `${ausgefallen} geplante Krafteinheiten in Folge ausgefallen. Passe den Plan an, statt nachzuholen.` : null].filter((x): x is string => !!x),
  };
}
