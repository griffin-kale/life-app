import { ensureSchema, getSetting, setSetting, sql } from './db';
import { ereignisse, kalenderBereit, kalenderFinden, KalenderFehler } from './caldav';
import { artRaten, kalenderZeilen, tagesplan, type KalenderArt, type Termin } from './kalender-regeln';
import { geschuetzteNamen } from './claude';
import { heuteBerlin, jetztBerlin, minutenBerlin, plusTage, tagesbeginn } from './zeit';

/** Kalender abgleichen und lesen. Termine bleiben auf dem Server, der Coach bekommt nur die Zusammenfassung. */

export type KalenderZeile = { href: string; name: string; farbe: string; an: boolean; art: KalenderArt };

export async function kalenderListe(userId = 'peter'): Promise<KalenderZeile[]> {
  await ensureSchema();
  return sql<KalenderZeile[]>`select href, name, farbe, an, art from kalender where user_id = ${userId} order by art, name`;
}

/** Holt die Kalender und die Termine von gestern bis in acht Tagen. Ersetzt die gespeicherten Termine in diesem Fenster. */
export async function abgleichen(userId = 'peter'): Promise<{ kalender: number; termine: number }> {
  if (!kalenderBereit()) throw new KalenderFehler('Kalender: noch nicht eingerichtet');
  await ensureSchema();
  const gefunden = await kalenderFinden();
  for (const k of gefunden) {
    await sql`insert into kalender (user_id, href, name, farbe, art) values (${userId}, ${k.href}, ${k.name}, ${k.farbe}, ${artRaten(k.name)})
      on conflict (user_id, href) do update set name = excluded.name, farbe = excluded.farbe`;
  }
  const hrefs = gefunden.map((k) => k.href);
  if (hrefs.length) await sql`delete from kalender where user_id = ${userId} and href not in ${sql(hrefs)}`;
  const an = (await kalenderListe(userId)).filter((k) => k.an);
  const heute = heuteBerlin();
  const von = tagesbeginn(plusTage(heute, -1)); const bis = tagesbeginn(plusTage(heute, 9));
  let n = 0;
  const neu: { kalender: string; uid: string; beginn: string; ende: string; ganztag: boolean; titel: string }[] = [];
  for (const k of an) {
    const e = await ereignisse(k.href, von, bis);
    const gesehen = new Set<string>();
    for (const v of e) { const key = v.uid + v.beginn; if (gesehen.has(key)) continue; gesehen.add(key); neu.push({ kalender: k.href, ...v }); }
  }
  await sql.begin(async (tx) => {
    await tx`delete from termine where user_id = ${userId} and ende >= ${von} and beginn <= ${bis}`;
    await tx`delete from termine where user_id = ${userId} and kalender not in ${tx(an.length ? an.map((k) => k.href) : [''])}`;
    for (const t of neu) {
      await tx`insert into termine (user_id, kalender, uid, beginn, ende, ganztag, titel) values (${userId}, ${t.kalender}, ${t.uid}, ${t.beginn}, ${t.ende}, ${t.ganztag}, ${t.titel})
        on conflict do nothing`;
      n++;
    }
  });
  await setSetting(`kalender_abgleich:${userId}`, new Date().toISOString());
  return { kalender: gefunden.length, termine: n };
}

/** Termine der eingeschalteten Kalender von heute bis in sieben Tagen. */
export async function termine(userId = 'peter'): Promise<Termin[]> {
  await ensureSchema();
  const heute = heuteBerlin();
  const rows = await sql<{ beginn: Date; ende: Date; ganztag: boolean; titel: string; art: KalenderArt }[]>`
    select t.beginn, t.ende, t.ganztag, t.titel, k.art from termine t join kalender k on k.user_id = t.user_id and k.href = t.kalender
    where t.user_id = ${userId} and k.an and t.ende >= ${tagesbeginn(heute)} and t.beginn < ${tagesbeginn(plusTage(heute, 8))}
    order by t.beginn limit 500`;
  return rows.map((r) => ({ beginn: new Date(r.beginn).toISOString(), ende: new Date(r.ende).toISOString(), ganztag: r.ganztag, titel: r.titel, art: r.art }));
}

const jetztMin = () => minutenBerlin();

export type KalenderStand = { bereit: boolean; zuletzt: string | null; kalender: KalenderZeile[]; heute: ReturnType<typeof tagesplan> | null };

export async function kalenderStand(userId = 'peter', ziel?: { titel: string; dauer: number }): Promise<KalenderStand> {
  const bereit = kalenderBereit();
  const [liste, zuletzt] = await Promise.all([kalenderListe(userId), getSetting(`kalender_abgleich:${userId}`)]);
  if (!bereit || !liste.length) return { bereit, zuletzt: zuletzt || null, kalender: liste, heute: null };
  const t = await termine(userId);
  return { bereit, zuletzt: zuletzt || null, kalender: liste, heute: tagesplan(t, heuteBerlin(), { ab: jetztMin(), ziel: ziel?.titel, dauer: ziel?.dauer }) };
}

/** Zeilen für den Coach. Leer, solange kein Kalender verbunden ist. */
export async function kalenderKurz(userId = 'peter'): Promise<string[]> {
  if (!kalenderBereit() || !(await kalenderListe(userId)).some((k) => k.an)) return [];
  // Phase 3: Titel mit Gesundheitswörtern und unbekannten Namen nach „mit“ oder „bei“ gehen nicht an Claude
  const bekannte = (await geschuetzteNamen()).map((n) => n.name);
  return kalenderZeilen(await termine(userId), heuteBerlin(), jetztMin(), bekannte);
}

/** Alle 30 Minuten zwischen 6 und 22 Uhr. Fehler landen nur als kurze Meldung im Log, ohne Inhalte. */
export async function vielleichtAbgleichen(userId = 'peter') {
  if (!kalenderBereit()) return;
  const zuletzt = Date.parse((await getSetting(`kalender_abgleich:${userId}`)) || '0');
  const h = jetztBerlin().stunde;
  if (h < 6 || h >= 22 || Date.now() - zuletzt < 30 * 60_000) return;
  await setSetting(`kalender_abgleich:${userId}`, new Date().toISOString()); // auch bei Fehler nicht jede Minute neu
  await abgleichen(userId).catch((e) => console.error('kalender', e instanceof KalenderFehler ? e.message : 'Abgleich fehlgeschlagen'));
}
