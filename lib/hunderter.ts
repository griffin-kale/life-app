import { askJson, MODEL } from './claude';
import { ensureSchema, sql } from './db';
import { Hinweis } from './fehler';
import { kalenderKurz } from './kalender';
import { heuteBerlin, jetztBerlin, minutenBerlin } from './zeit';
import {
  BEREICHE_H, BEREICH_NAME, BREMSEN, JOKER, KONTEN_L, KONTO_NAME, PHASE_MIN, TAGE, bewerten, istTag, jokerErlaubt, plusTage, pruefeVerordnung,
  raster, saisonEnde, saisonKalender, saisonTag, tageZwischen, type HBereich, type LKonto, type RasterZelle, type TagBewertung, type Verordnung,
} from './hunderter-regeln';

/**
 * Die Hunderter (0.32, Peter 12.11.2026). Jede Abfrage filtert nach dem Menschen der Sitzung.
 * Phasen kommen aus den Fokusblöcken mit Bereich (ab 45 Minuten), dazu Nachträge von Hand.
 * Die Leben-Aufgaben verordnet Claude einmal am Tag über askJson, also mit Platzhaltern statt Namen.
 */

type Kopf = { id: number; start: string };
type TagZeile = { tag: string; content: number; hand: Record<string, number>; leben: { konto: LKonto; text: string; erledigt: boolean }[] | null; fazit: string; bremsen: string[]; abgeschlossen: boolean };

export type LebenAufgabe = { konto: LKonto; name: string; text: string; erledigt: boolean };
export type HunderterHeute = {
  id: number; start: string; ende: string; heute: string; nr: number; jokerHeute: boolean; jokerFrei: number; jokerTage: string[];
  jokerHeuteMoeglich: boolean; vorbei: boolean;
  content: number; phasen: { bereich: HBereich; name: string; fokus: number; hand: number; n: number }[];
  leben: LebenAufgabe[]; bewertung: TagBewertung; fazit: string; bremsen: string[]; abgeschlossen: boolean;
};

async function kopf(userId: string): Promise<Kopf | null> {
  await ensureSchema();
  const [k] = await sql<Kopf[]>`select id, to_char(start, 'YYYY-MM-DD') as start from hunderter where user_id = ${userId} order by id desc limit 1`;
  return k ?? null;
}
async function jokerVon(k: Kopf, userId: string): Promise<string[]> {
  const j = await sql<{ tag: string }[]>`select to_char(tag, 'YYYY-MM-DD') as tag from hunderter_joker where hunderter_id = ${k.id} and user_id = ${userId} order by tag`;
  return j.map((x) => x.tag);
}
async function tagZeilen(k: Kopf, userId: string, von: string, bis: string): Promise<Map<string, TagZeile>> {
  const z = await sql<TagZeile[]>`
    select to_char(tag, 'YYYY-MM-DD') as tag, content, hand, leben, fazit, bremsen, abgeschlossen from hunderter_tage
    where hunderter_id = ${k.id} and user_id = ${userId} and tag between ${von} and ${bis}`;
  return new Map(z.map((x) => [x.tag, x]));
}
/** Fokusphasen mit Bereich pro Tag und Bereich. Ein Block zählt ab 45 Minuten Fokus. */
async function fokusPhasen(userId: string, von: string, bis: string): Promise<Map<string, Record<string, number>>> {
  const z = await sql<{ tag: string; bereich: string; n: number }[]>`
    select to_char((start at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') as tag, bereich, count(*)::int as n
    from fokus_bloecke where user_id = ${userId} and bereich is not null
      and (start at time zone 'Europe/Berlin')::date between ${von} and ${bis}
      and least(minuten, extract(epoch from (coalesce(ende, now()) - start)) / 60) >= ${PHASE_MIN}
    group by 1, 2`;
  const aus = new Map<string, Record<string, number>>();
  for (const r of z) aus.set(r.tag, { ...(aus.get(r.tag) ?? {}), [r.bereich]: r.n });
  return aus;
}

const phasenAus = (fokus: Record<string, number> | undefined, hand: Record<string, number> | undefined) =>
  BEREICHE_H.map((b) => {
    const f = fokus?.[b] ?? 0; const h = Number(hand?.[b] ?? 0);
    return { bereich: b, name: BEREICH_NAME[b], fokus: f, hand: h, n: Math.max(0, f + h) };
  });

function bewertungAus(z: TagZeile | undefined, fokus: Record<string, number> | undefined): TagBewertung {
  const ph = phasenAus(fokus, z?.hand);
  return bewerten({
    content: z?.content ?? 0,
    phasen: Object.fromEntries(ph.map((p) => [p.bereich, p.n])) as Record<HBereich, number>,
    leben: (z?.leben ?? []).map((l) => l.erledigt),
    verordnet: !!z?.leben?.length,
  });
}

/** Laufen die Hunderter gerade (heute ein Saisontag)? */
export async function laeuft(userId: string): Promise<boolean> {
  const k = await kopf(userId);
  if (!k) return false;
  const j = await jokerVon(k, userId);
  const heute = heuteBerlin();
  return heute >= k.start && heute <= saisonEnde(k.start, j);
}

/** Eine neue Hunderter-Saison. Start heute oder an einem der nächsten sieben Tage. */
export async function anlegen(start: string, userId: string): Promise<number> {
  await ensureSchema();
  const heute = heuteBerlin();
  if (!istTag(start) || start < heute || tageZwischen(heute, start) > 7) throw new Hinweis('Der Start liegt heute oder in den nächsten sieben Tagen.');
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7316003, hashtext(${userId}))`;
    const [alt] = await tx<Kopf[]>`select id, to_char(start, 'YYYY-MM-DD') as start from hunderter where user_id = ${userId} order by id desc limit 1`;
    if (alt) {
      const j = await tx<{ tag: string }[]>`select to_char(tag, 'YYYY-MM-DD') as tag from hunderter_joker where hunderter_id = ${alt.id}`;
      if (saisonEnde(alt.start, j.map((x) => x.tag)) >= heute) throw new Hinweis('Die Hunderter laufen schon.');
    }
    const [n] = await tx<{ id: number }[]>`insert into hunderter (user_id, start) values (${userId}, ${start}) returning id`;
    return n.id;
  }) as Promise<number>;
}

/** Die Leben-Aufgaben für heute. Fehlen sie, verordnet Claude sie einmal (Kalender ohne Namen, nur Wochentag). */
async function verordnen(k: Kopf, tag: string, nr: number, userId: string): Promise<void> {
  const [da] = await sql<{ n: number }[]>`select count(*)::int as n from hunderter_tage where hunderter_id = ${k.id} and user_id = ${userId} and tag = ${tag} and leben is not null`;
  if (da.n) return;
  const gestern = await sql<{ leben: { konto: string; text: string }[] | null }[]>`
    select leben from hunderter_tage where hunderter_id = ${k.id} and user_id = ${userId} and tag between ${plusTage(tag, -3)} and ${plusTage(tag, -1)}`;
  const kalender = await kalenderKurz(userId).catch(() => [] as string[]);
  const wt = ({ Mon: 'Montag', Tue: 'Dienstag', Wed: 'Mittwoch', Thu: 'Donnerstag', Fri: 'Freitag', Sat: 'Samstag', Sun: 'Sonntag' } as Record<string, string>)[jetztBerlin().wochentag] ?? 'heute';
  const prompt = [
    'HUNDERTER LEBEN',
    `Peter ist an Tag ${nr} von 100 eines harten Arbeitsblocks. Damit er dabei sein Leben nicht zerhaut, verordnest du ihm heute (${wt}) genau eine kleine Aufgabe pro Konto: Körper, Sozial, Mental, Geld, Zeit.`,
    'Regeln: jede Aufgabe 2 bis 10 Minuten, konkret und abhakbar, höchstens 10 Wörter, Verb oder Zahl vorn. Er kann nicht tauschen, also nur, was heute sicher machbar ist. Peter hat Frau und zwei kleine Söhne (die Jungs). Keine Gesundheitsratschläge, nichts mit Geld ausgeben.',
    kalender.length ? 'Sein Kalender heute:\n' + kalender.slice(0, 12).join('\n') : 'Kein Kalender verbunden.',
    gestern.some((g) => g.leben?.length) ? 'Nicht wiederholen, das gab es zuletzt:\n' + gestern.flatMap((g) => (g.leben ?? []).map((l) => `- ${l.text}`)).slice(0, 15).join('\n') : '',
    'Antworte nur mit JSON: {"koerper": string, "sozial": string, "mental": string, "geld": string, "zeit": string}',
  ].filter(Boolean).join('\n');
  let v: Verordnung;
  try { v = pruefeVerordnung(await askJson<unknown>(prompt, MODEL(), 400), nr); }
  catch { v = pruefeVerordnung(null, nr); }
  const leben = KONTEN_L.map((konto) => ({ konto, text: v[konto], erledigt: false }));
  await sql`
    insert into hunderter_tage (hunderter_id, user_id, tag, leben) values (${k.id}, ${userId}, ${tag}, ${sql.json(leben)})
    on conflict (hunderter_id, tag) do update set leben = coalesce(hunderter_tage.leben, excluded.leben)`;
}

/** Stand für heute. Verordnet die Leben-Aufgaben, wenn sie fehlen und der Tag zählt. */
export async function heuteStand(userId: string, mitVerordnung = true): Promise<HunderterHeute | null> {
  const k = await kopf(userId);
  if (!k) return null;
  const heute = heuteBerlin();
  const joker = await jokerVon(k, userId);
  const ende = saisonEnde(k.start, joker);
  const nr = saisonTag(k.start, heute, joker);
  const vorbei = heute > ende;
  const jokerHeute = joker.includes(heute);
  if (mitVerordnung && nr > 0 && !vorbei) await verordnen(k, heute, nr, userId).catch(() => {});
  const [zeilen, fokus] = await Promise.all([tagZeilen(k, userId, heute, heute), fokusPhasen(userId, heute, heute)]);
  const z = zeilen.get(heute);
  const f = fokus.get(heute);
  return {
    id: k.id, start: k.start, ende, heute, nr, jokerHeute, jokerFrei: JOKER - joker.length, jokerTage: joker, vorbei,
    jokerHeuteMoeglich: !jokerJa(k, heute, joker, true),
    content: z?.content ?? 0, phasen: phasenAus(f, z?.hand),
    leben: (z?.leben ?? []).map((l) => ({ konto: l.konto, name: KONTO_NAME[l.konto] ?? l.konto, text: l.text, erledigt: !!l.erledigt })),
    bewertung: bewertungAus(z, f), fazit: z?.fazit ?? '', bremsen: z?.bremsen ?? [], abgeschlossen: !!z?.abgeschlossen,
  };
}
const jokerJa = (k: Kopf, tag: string, joker: string[], setzen: boolean) => jokerErlaubt(tag, heuteBerlin(), minutenBerlin(), k.start, joker, setzen);

/** Schreibt nur in den laufenden Tag einer laufenden Saison. */
async function laufenderTag(userId: string): Promise<{ k: Kopf; tag: string }> {
  const k = await kopf(userId);
  if (!k) throw new Hinweis('Es laufen keine Hunderter.');
  const heute = heuteBerlin();
  const joker = await jokerVon(k, userId);
  if (saisonTag(k.start, heute, joker) < 1 || heute > saisonEnde(k.start, joker)) throw new Hinweis('Heute ist kein Hunderter-Tag.');
  return { k, tag: heute };
}

export async function contentSetzen(n: number, userId: string): Promise<void> {
  if (![0, 1, 2].includes(n)) throw new Hinweis('Ungültiger Wert.');
  const { k, tag } = await laufenderTag(userId);
  await sql`insert into hunderter_tage (hunderter_id, user_id, tag, content) values (${k.id}, ${userId}, ${tag}, ${n})
    on conflict (hunderter_id, tag) do update set content = excluded.content`;
}

/** Eine Phase von Hand nachtragen (+1) oder zurücknehmen (−1). Unter null geht es nicht, auch nicht gegen Fokusblöcke. */
export async function phaseHand(bereich: HBereich, delta: 1 | -1, userId: string): Promise<void> {
  if (!BEREICHE_H.includes(bereich)) throw new Hinweis('Diesen Bereich gibt es nicht.');
  const { k, tag } = await laufenderTag(userId);
  const f = (await fokusPhasen(userId, tag, tag)).get(tag)?.[bereich] ?? 0;
  await sql.begin(async (tx) => {
    await tx`insert into hunderter_tage (hunderter_id, user_id, tag) values (${k.id}, ${userId}, ${tag}) on conflict (hunderter_id, tag) do nothing`;
    const [z] = await tx<{ hand: Record<string, number> }[]>`select hand from hunderter_tage where hunderter_id = ${k.id} and tag = ${tag} and user_id = ${userId} for update`;
    const alt = Number(z?.hand?.[bereich] ?? 0);
    const neu = Math.min(4, Math.max(-f, alt + delta));
    await tx`update hunderter_tage set hand = ${sql.json({ ...(z?.hand ?? {}), [bereich]: neu })} where hunderter_id = ${k.id} and tag = ${tag} and user_id = ${userId}`;
  });
}

export async function lebenAbhaken(konto: LKonto, erledigt: boolean, userId: string): Promise<void> {
  if (!KONTEN_L.includes(konto)) throw new Hinweis('Dieses Konto gibt es nicht.');
  const { k, tag } = await laufenderTag(userId);
  await sql.begin(async (tx) => {
    const [z] = await tx<{ leben: TagZeile['leben'] }[]>`select leben from hunderter_tage where hunderter_id = ${k.id} and tag = ${tag} and user_id = ${userId} for update`;
    if (!z?.leben) throw new Hinweis('Für heute ist noch nichts verordnet.');
    const leben = z.leben.map((l) => (l.konto === konto ? { ...l, erledigt } : l));
    await tx`update hunderter_tage set leben = ${sql.json(leben)} where hunderter_id = ${k.id} and tag = ${tag} and user_id = ${userId}`;
  });
}

export async function joker(tag: string, setzen: boolean, userId: string): Promise<void> {
  const k = await kopf(userId);
  if (!k) throw new Hinweis('Es laufen keine Hunderter.');
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7316004, hashtext(${userId}))`;
    const j = (await tx<{ tag: string }[]>`select to_char(tag, 'YYYY-MM-DD') as tag from hunderter_joker where hunderter_id = ${k.id} and user_id = ${userId}`).map((x) => x.tag);
    const nein = jokerJa(k, tag, j, setzen);
    if (nein) throw new Hinweis(nein);
    if (setzen) await tx`insert into hunderter_joker (hunderter_id, user_id, tag) values (${k.id}, ${userId}, ${tag})`;
    else await tx`delete from hunderter_joker where hunderter_id = ${k.id} and user_id = ${userId} and tag = ${tag}`;
  });
}

/** Abschluss: ein Satz und was gebremst hat. Beides freiwillig, Bremsen nur aus der festen Liste. */
export async function abschliessen(fazit: string, bremsen: string[], userId: string): Promise<void> {
  const { k, tag } = await laufenderTag(userId);
  const satz = fazit.replace(/\s+/g, ' ').trim().slice(0, 300);
  const b = [...new Set(bremsen.filter((x) => (BREMSEN as readonly string[]).includes(x)))];
  await sql`insert into hunderter_tage (hunderter_id, user_id, tag, fazit, bremsen, abgeschlossen) values (${k.id}, ${userId}, ${tag}, ${satz}, ${b}, true)
    on conflict (hunderter_id, tag) do update set fazit = excluded.fazit, bremsen = excluded.bremsen, abgeschlossen = true`;
}

export type HunderterUebersicht = {
  start: string; ende: string; heute: string; nr: number; jokerTage: string[]; jokerFrei: number;
  zellen: RasterZelle[]; gezaehlt: number; voll: number; vorbei: number;
  quoten: { name: string; tage: number }[]; phasen: number; contentPieces: number; leben: number;
  bremsen: { name: string; n: number }[];
};

/** Raster, Quoten und Zähler für die ganze Saison. */
export async function uebersicht(userId: string): Promise<HunderterUebersicht | null> {
  const k = await kopf(userId);
  if (!k) return null;
  const heute = heuteBerlin();
  const j = await jokerVon(k, userId);
  const kal = saisonKalender(k.start, j);
  const ende = kal[kal.length - 1];
  const [zeilen, fokus] = await Promise.all([tagZeilen(k, userId, k.start, ende), fokusPhasen(userId, k.start, ende)]);
  const bewertet = new Map<string, TagBewertung>();
  let phasen = 0; let content = 0; let leben = 0;
  const quote: Record<string, number> = { Content: 0, ...Object.fromEntries(BEREICHE_H.map((b) => [BEREICH_NAME[b], 0])), 'Leben 5/5': 0 };
  const bremsen = new Map<string, number>();
  const bisher = kal.filter((t) => t <= heute);
  for (const t of bisher) {
    const z = zeilen.get(t); const f = fokus.get(t);
    bewertet.set(t, bewertungAus(z, f));
    const ph = phasenAus(f, z?.hand);
    phasen += ph.reduce((a, p) => a + p.n, 0);
    content += (z?.content ?? 0) * 50;
    const lebenHeute = (z?.leben ?? []).filter((l) => l.erledigt).length;
    leben += lebenHeute;
    if ((z?.content ?? 0) > 0) quote.Content++;
    for (const p of ph) if (p.n > 0) quote[p.name]++;
    if (lebenHeute === KONTEN_L.length) quote['Leben 5/5']++;
    for (const b of z?.bremsen ?? []) bremsen.set(b, (bremsen.get(b) ?? 0) + 1);
  }
  const zellen = raster(kal, heute, bewertet);
  const vergangen = bisher.filter((t) => t < heute);
  return {
    start: k.start, ende, heute, nr: saisonTag(k.start, heute, j), jokerTage: j, jokerFrei: JOKER - j.length, zellen,
    gezaehlt: zellen.filter((z) => z.tag <= heute && (z.zustand === 'zaehlt' || z.zustand === 'voll')).length,
    voll: zellen.filter((z) => z.zustand === 'voll').length, vorbei: vergangen.length,
    quoten: Object.entries(quote).map(([name, tage]) => ({ name, tage })), phasen, contentPieces: content, leben,
    bremsen: [...bremsen.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
  };
}

/** Zeilen für den Coach: Tag, Stand heute, was fehlt. Ohne Datum. */
export async function hunderterZeilen(userId: string): Promise<string[]> {
  const h = await heuteStand(userId, false).catch(() => null);
  if (!h || h.vorbei || h.nr < 1) return [];
  return [
    `Die Hunderter: Tag ${h.nr} von ${TAGE}, ${h.jokerFrei} Joker frei. Pro Tag: 100 Content, je 2 Phasen à 50 + 10 für Shop, Mail, Förderung, Plattform, Admin, dazu 5 Leben-Aufgaben. Die Hälfte jedes Standards plus alle Leben-Aufgaben = der Tag zählt.`,
    `Heute ${h.bewertung.prozent} %, ${h.bewertung.zaehlt ? 'der Tag zählt' : 'fehlt noch: ' + h.bewertung.fehlt.join(', ')}.`,
  ];
}
