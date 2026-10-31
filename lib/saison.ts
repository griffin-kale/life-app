import { askJson, MODEL } from './claude';
import { ensureSchema, getSetting, proNutzer, sql } from './db';
import { Hinweis } from './fehler';
import { standAus } from './standort';
import { heuteBerlin } from './zeit';
import {
  BEREICH_TITEL, BEREICHE_S, HINDERNISSE, imPlan, naechsterMontag, pruefeHebelVorschlaege, saisonEnde, saisonName, saisonWoche,
  vorschlaegeAus, wennDannSatz, zielAnteil, type Bewertung, type HebelArt, type SaisonEingabe, type SBereich, type Vorschlag,
} from './saison-regeln';

/**
 * Saison mit Zielen und Hebeln (Life 2.0, Phase 2). Jede Abfrage filtert nach dem Menschen der Sitzung.
 * Einträge hängen über `items.ziel` (Titel) an einem Ziel. Benennt man ein Ziel um, ziehen die Einträge mit.
 */

const liste = (s: string) => s.split('\n').map((z) => z.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);

export type HebelStand = { id: number; titel: string; art: HebelArt; bewertung: Bewertung | null };
export type ZielStand = {
  id: number; bereich: SBereich; bereichTitel: string; titel: string; zielwert: number | null; stand: number;
  anteil: number | null; plan: ReturnType<typeof imPlan>; wenn: string; dann: string; wennDann: string;
  offen: number; erledigtWoche: number; hebel: HebelStand[];
};
export type SaisonStand = { id: number; start: string; ende: string; name: string; woche: number; leitsatz: string; ziele: ZielStand[]; leer: SBereich[] };

type SaisonZeile = { id: number; start: string; ende: string; leitsatz: string };
type ZielZeile = { id: number; bereich: SBereich; titel: string; zielwert: number | null; stand: number; wenn: string; dann: string };
type HebelZeile = { id: number; ziel_id: number; titel: string; art: HebelArt; bewertung: Bewertung | null };

/** Die laufende oder die nächste Saison. Eine vergangene zählt nicht mehr. */
async function saisonZeile(userId: string, heute = heuteBerlin()): Promise<SaisonZeile | null> {
  const [s] = await sql<SaisonZeile[]>`
    select id, start, ende, leitsatz from saisons where user_id = ${userId} and ende >= ${heute} order by start limit 1`;
  return s ?? null;
}

export async function aktuelleSaison(userId: string): Promise<SaisonStand | null> {
  await ensureSchema();
  const heute = heuteBerlin();
  const s = await saisonZeile(userId, heute);
  if (!s) return null;
  const woche = saisonWoche(s.start, heute);
  const [ziele, hebel, items] = await Promise.all([
    sql<ZielZeile[]>`select id, bereich, titel, zielwert, stand, wenn, dann from saison_ziele where saison_id = ${s.id} and user_id = ${userId}`,
    sql<HebelZeile[]>`
      select h.id, h.ziel_id, h.titel, h.art,
        (select w.bewertung from hebel_wochen w where w.hebel_id = h.id and w.user_id = ${userId} order by w.montag desc limit 1) as bewertung
      from hebel h join saison_ziele z on z.id = h.ziel_id
      where z.saison_id = ${s.id} and h.user_id = ${userId} order by h.pos, h.id`,
    sql<{ ziel: string; offen: number; woche: number }[]>`
      select ziel,
        count(*) filter (where status not in ('erledigt', 'archiv') and coalesce(stapel, '') <> 'streichen')::int as offen,
        count(*) filter (where status = 'erledigt' and erledigt_at >= date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')::int as woche
      from items where user_id = ${userId} and ziel is not null group by ziel`,
  ]);
  const nachZiel = new Map(items.map((i) => [i.ziel.toLowerCase(), i]));
  const stand: ZielStand[] = ziele
    .sort((a, b) => BEREICHE_S.indexOf(a.bereich) - BEREICHE_S.indexOf(b.bereich))
    .map((z) => {
      const it = nachZiel.get(z.titel.toLowerCase());
      return {
        ...z, bereichTitel: BEREICH_TITEL[z.bereich], anteil: zielAnteil(z.stand, z.zielwert), plan: imPlan(z.stand, z.zielwert, woche),
        wennDann: wennDannSatz(z.wenn, z.dann), offen: it?.offen ?? 0, erledigtWoche: it?.woche ?? 0,
        hebel: hebel.filter((h) => h.ziel_id === z.id).map(({ id, titel, art, bewertung }) => ({ id, titel, art, bewertung })),
      };
    });
  return {
    id: s.id, start: s.start, ende: s.ende, name: saisonName(s.start), woche, leitsatz: s.leitsatz, ziele: stand,
    leer: BEREICHE_S.filter((b) => !ziele.some((z) => z.bereich === b)),
  };
}

/** Was das Blatt „Neue Saison“ braucht: Startvorschlag, Vorschläge aus „Dein Stand“ und der alten Liste, Hindernisse. */
export async function saisonGrundlage(userId: string): Promise<{ start: string; vorschlaege: Vorschlag[]; hindernisse: readonly string[] }> {
  const [standRoh, alt] = await Promise.all([getSetting(`stand:${userId}`), getSetting(proNutzer('ziele', userId))]);
  const stand = standAus(standRoh);
  return { start: naechsterMontag(heuteBerlin()), vorschlaege: vorschlaegeAus(stand.quartal ?? [], liste(alt)), hindernisse: HINDERNISSE };
}

export async function saisonAnlegen(eingabe: SaisonEingabe, userId: string): Promise<number> {
  await ensureSchema();
  return sql.begin(async (tx) => {
    // Nie zwei Saisons übereinander. Sperre pro Mensch, damit ein Doppeltipp keine zweite anlegt.
    await tx`select pg_advisory_xact_lock(7316002, hashtext(${userId}))`;
    const [laufend] = await tx<{ id: number }[]>`select id from saisons where user_id = ${userId} and ende >= ${eingabe.start} limit 1`;
    if (laufend) throw new Hinweis('Es gibt schon eine Saison für diesen Zeitraum.');
    const [s] = await tx<{ id: number }[]>`
      insert into saisons (user_id, start, ende, leitsatz) values (${userId}, ${eingabe.start}, ${saisonEnde(eingabe.start)}, ${eingabe.leitsatz}) returning id`;
    for (const z of eingabe.ziele) {
      const [zi] = await tx<{ id: number }[]>`
        insert into saison_ziele (saison_id, user_id, bereich, titel, zielwert, wenn, dann)
        values (${s.id}, ${userId}, ${z.bereich}, ${z.titel}, ${z.zielwert}, ${z.wenn}, ${z.dann}) returning id`;
      for (const [pos, h] of z.hebel.entries()) await tx`insert into hebel (ziel_id, user_id, titel, art, pos) values (${zi.id}, ${userId}, ${h.titel}, ${h.art}, ${pos})`;
    }
    return s.id;
  }) as Promise<number>;
}

/** Stand eines Ziels ändern (+1, −1 oder fester Wert), Titel, Zielwert oder Wenn-dann. Benennen zieht die Einträge mit. */
export async function zielAendern(id: number, aenderung: { stand?: number; delta?: number; titel?: string; zielwert?: number | null; wenn?: string; dann?: string }, userId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [z] = await tx<{ titel: string }[]>`select titel from saison_ziele where id = ${id} and user_id = ${userId} for update`;
    if (!z) return false;
    if (aenderung.delta !== undefined) await tx`update saison_ziele set stand = greatest(0, stand + ${aenderung.delta}) where id = ${id} and user_id = ${userId}`;
    if (aenderung.stand !== undefined) await tx`update saison_ziele set stand = ${aenderung.stand} where id = ${id} and user_id = ${userId}`;
    if (aenderung.zielwert !== undefined) await tx`update saison_ziele set zielwert = ${aenderung.zielwert} where id = ${id} and user_id = ${userId}`;
    if (aenderung.wenn !== undefined) await tx`update saison_ziele set wenn = ${aenderung.wenn} where id = ${id} and user_id = ${userId}`;
    if (aenderung.dann !== undefined) await tx`update saison_ziele set dann = ${aenderung.dann} where id = ${id} and user_id = ${userId}`;
    if (aenderung.titel && aenderung.titel !== z.titel) {
      await tx`update saison_ziele set titel = ${aenderung.titel} where id = ${id} and user_id = ${userId}`;
      await tx`update items set ziel = ${aenderung.titel} where user_id = ${userId} and ziel = ${z.titel}`;
    }
    return true;
  }) as Promise<boolean>;
}

/**
 * Die Ziele als Zeilen für Claude, Sortieren und die Auswahl im Eintrag.
 * Mit laufender Saison deren Ziele, sonst die alte Liste aus den Einstellungen.
 */
export async function zieleText(userId: string): Promise<string> {
  await ensureSchema();
  const s = await saisonZeile(userId);
  if (!s) return getSetting(proNutzer('ziele', userId));
  const z = await sql<{ titel: string }[]>`select titel from saison_ziele where saison_id = ${s.id} and user_id = ${userId} order by id`;
  return z.length ? z.map((x) => x.titel).join('\n') : getSetting(proNutzer('ziele', userId));
}

/** Zeilen für Coach und Sortieren: Leitsatz, Woche, Ziele mit Hebeln und Wenn-dann. Ohne Datum, nur die Woche der Saison. */
export async function saisonZeilen(userId: string): Promise<string[]> {
  const s = await aktuelleSaison(userId);
  if (!s || s.woche < 1) return [];
  return [
    `Saison ${s.name}, Woche ${s.woche} von 12.` + (s.leitsatz ? ` Leitsatz: ${s.leitsatz}` : ''),
    ...s.ziele.map((z) => `- ${z.bereichTitel}: ${z.titel}` + (z.zielwert ? ` (${z.stand} von ${z.zielwert})` : '')
      + (z.hebel.length ? `. Hebel: ${z.hebel.map((h) => h.titel).join('; ')}` : '') + (z.wennDann ? `. ${z.wennDann}` : '')),
  ];
}

/** Claude schlägt pro Ziel drei Hebel und einen Dann-Satz vor. Geht über askJson, also mit Platzhaltern statt Namen. */
export async function hebelVorschlagen(ziele: { bereich: SBereich; titel: string; wenn: string }[], userId: string): Promise<Record<string, { hebel: string[]; dann: string }>> {
  const sauber = ziele.filter((z) => BEREICHE_S.includes(z.bereich) && z.titel.trim()).slice(0, 6);
  if (!sauber.length) return {};
  // Nur wer schon eine Saison anlegen darf, fragt Claude: ohne laufende Saison oder kurz vor der nächsten
  const s = await saisonZeile(userId);
  if (s && saisonWoche(s.start, heuteBerlin()) >= 1) throw new Hinweis('Es läuft schon eine Saison.');
  const prompt = [
    'SAISON HEBEL',
    'Peter plant eine Saison von zwölf Wochen. Schlage für jedes Ziel genau drei Hebel vor: regelmäßige, konkrete Handlungen, die das Ziel tragen und in einen Kalender passen (mit Wochentag oder Häufigkeit, höchstens 8 Wörter, Verb oder Zeitangabe am Anfang).',
    'Dazu pro Ziel einen Dann-Satz für das genannte Hindernis: was Peter stattdessen tut, kleiner, aber am selben Tag (höchstens 14 Wörter, ohne „Wenn“ und ohne „dann“ am Anfang).',
    'Ziele:',
    ...sauber.map((z) => `- ${z.bereich}: ${z.titel.slice(0, 80)}${z.wenn ? ` | Hindernis: ${z.wenn.slice(0, 80)}` : ''}`),
    'Antworte nur mit JSON: {"ziele": [{"bereich": string (genau wie oben), "hebel": [string, string, string], "dann": string}]}',
  ].join('\n');
  const roh = await askJson<unknown>(prompt, MODEL(), 900);
  return pruefeHebelVorschlaege(roh, sauber.map((z) => z.bereich));
}

/** Wochenrunde: einen Hebel für die laufende Woche bewerten. Ein zweites Mal überschreibt. Nur eigene Hebel. */
export async function hebelBewerten(hebelId: number, montag: string, bewertung: Bewertung, userId: string): Promise<boolean> {
  const r = await sql`
    insert into hebel_wochen (hebel_id, user_id, montag, bewertung)
    select id, ${userId}, ${montag}, ${bewertung} from hebel where id = ${hebelId} and user_id = ${userId}
    on conflict (hebel_id, montag) do update set bewertung = excluded.bewertung`;
  return r.count > 0;
}

/** Ein Ziel in einem noch freien Bereich der laufenden Saison ergänzen. */
export async function zielErgaenzen(bereich: SBereich, titel: string, userId: string): Promise<number> {
  const s = await saisonZeile(userId);
  if (!s) throw new Hinweis('Es läuft keine Saison.');
  const [z] = await sql<{ id: number }[]>`
    insert into saison_ziele (saison_id, user_id, bereich, titel) values (${s.id}, ${userId}, ${bereich}, ${titel})
    on conflict (saison_id, bereich) do nothing returning id`;
  if (!z) throw new Hinweis('Dieser Bereich hat schon ein Ziel.');
  return z.id;
}

/** Hebel dazu (höchstens drei pro Ziel) oder weg. Nur eigene Ziele und Hebel. */
export async function hebelDazu(zielId: number, titel: string, userId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [z] = await tx<{ n: number }[]>`
      select (select count(*)::int from hebel h where h.ziel_id = z.id) as n from saison_ziele z where z.id = ${zielId} and z.user_id = ${userId} for update`;
    if (!z) return false;
    if (z.n >= 3) throw new Hinweis('Ein Ziel hat höchstens drei Hebel.');
    await tx`insert into hebel (ziel_id, user_id, titel, pos) values (${zielId}, ${userId}, ${titel}, ${z.n})`;
    return true;
  }) as Promise<boolean>;
}
export async function hebelWeg(hebelId: number, userId: string): Promise<boolean> {
  const r = await sql`delete from hebel where id = ${hebelId} and user_id = ${userId}`;
  return r.count > 0;
}
