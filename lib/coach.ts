import { askJson, askJsonTief, geschuetzteNamen, MODEL } from './claude';
import { AKTIONEN_TEXT, aktionenPruefen, bestaetigung, entscheidend, type CoachAktion } from './coach-aktion';
import { ensureSchema, getSetting, proNutzer, setSetting, sql } from './db';
import { BOEGEN, who5, type Antwort } from './fragen';
import { engpassAus, heuteBerlin, offene } from './priorisieren';
import { koerperZusammenfassung, warnsignale } from './coach-regeln';
import { koerperStand } from './koerper';
import { geldKurz, geldStand, haushalt } from './geld';
import { menschenKurz } from './menschen';
import { tageslage } from './tag';
import { standZeilenLesen, wochenzielSetzen } from './stand';
import { aktuelleSaison, saisonZeilen } from './saison';
import { createItem, enrich } from './enrich';
import { kalenderKurz } from './kalender';
import { oeffentlich } from './fehler';
import { fristRelativ, jetztBerlin } from './zeit';

export { warnsignale };

/**
 * Der Coach in der Tasche: morgens ein Satz zum Tag, abends ein Rückblick.
 * Warnsignale rechnet Life selbst aus. Claude formuliert nur und bekommt alles pseudonymisiert.
 */

export type CoachAntwort = { text: string; geste?: string; warnungen: string[] };
type Checkin = { art: string; tag: string; antworten: Record<string, Antwort> };

const zeile = (c: Checkin) => {
  const b = BOEGEN[c.art as keyof typeof BOEGEN]; if (!b) return '';
  const teile = b.fragen.map((f) => {
    const a = c.antworten[f.id]; if (!a) return '';
    const wert = f.typ === 'skala' && a.wert !== undefined ? f.werte.find((x) => x.wert === a.wert)?.label : '';
    const rest = [wert, a.auswahl?.join(', '), a.aufgabe ? `${a.aufgabe}${a.zeit ? ` (${a.zeit})` : ''}` : '', a.text, a.notiz ? `Notiz: ${a.notiz}` : ''].filter(Boolean).join('; ');
    return rest ? `${f.frage}: ${rest}` : '';
  }).filter(Boolean);
  const w = c.art === 'woche' ? who5(c.antworten) : null;
  // Kein Datum an Claude: nur „heute“, „gestern“, „vor 3 Tagen“
  const tage = Math.round((Date.parse(heuteBerlin()) - Date.parse(c.tag)) / 864e5);
  const wann = tage <= 0 ? 'heute' : tage === 1 ? 'gestern' : `vor ${tage} Tagen`;
  return `${wann} ${b.titel}${w !== null ? ` (WHO-5: ${w} von 100)` : ''}: ${teile.join(' | ')}`;
};

/** Was der Coach über heute weiß: Engpass, Aufgaben, Warnsignale, Körper, Geld, Menschen, Antworten. Alles geht pseudonymisiert raus. */
async function grundlage(userId: string) {
  await ensureSchema();
  const [items, kontext, checkins, namen, k, geld, g, menschenText] = await Promise.all([
    offene(userId),
    getSetting(proNutzer('kontext', userId)),
    sql<Checkin[]>`select art, tag::text as tag, antworten from checkins where user_id = ${userId} and tag >= (current_date - 8) order by tag, art`,
    geschuetzteNamen(),
    koerperStand(userId),
    geldKurz(userId).catch(() => ''),
    geldStand(userId).catch(() => null),
    menschenKurz(userId).catch(() => ''),
  ]);
  const [lage, stand, kalender, saison] = await Promise.all([tageslage(userId).catch(() => null), standZeilenLesen(userId).catch(() => [] as string[]), kalenderKurz(userId).catch(() => [] as string[]), saisonZeilen(userId).catch(() => [] as string[])]);
  const zk = await sql<{ was: string }[]>`select was from zeit_kaufen where user_id = ${userId} and status = 'idee' limit 5`.catch(() => [] as { was: string }[]);
  const merk = await merkzettel(userId).catch(() => [] as Merkpunkt[]);
  const warnungen = [...k.warnungen, ...(g?.warnungen ?? []), ...warnsignale(items)];
  const koerper = koerperZusammenfassung({ naechte: k.naechte.slice(0, 7), erholung: k.tage.slice(0, 7).map((t) => t.erholung), ruhepuls: k.tage.slice(0, 14).map((t) => t.ruhepuls),
    kraft: k.kraft, kraftSoll: k.stand.einheitenSoll, zone2: k.zone2, intervall: k.intervall, proteinGestern: k.proteinGestern, proteinZiel: k.proteinZiel, ruheMin: k.ruheMin, ruheTage: k.ruheTage });
  const jetzt = items.filter((i) => i.stapel === 'jetzt').slice(0, 3);
  const menschen = namen.filter((n) => n.art === 'Person' && !/^(Peter|Gneuß|Peter Gneuß)$/.test(n.name)).map((n) => n.name);
  // Phase 3: nur der Wochentag, kein Datum neben Schlaf, HRV und WHO-5
  const wtag = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' }).format(new Date());

  const zeilen = [
    'Du bist Peters Coach: ein erfahrener Trainer und Stabschef in einem. Du kennst seine Daten der letzten Tage und sagst ihm in wenigen Sätzen, worauf es heute ankommt.',
    'Ton je nach Lage: Liegt ein Warnsignal vor oder geht es ihm schlecht, sprich direkt und konkret wie ein Trainer. Sonst ruhig, warm, ohne Pathos. Du-Form, Deutsch.',
    'Schreibregeln: aktive Sätze mit konkretem Subjekt, keine Floskeln, keine rhetorischen Fragen, keine Konstruktion „nicht X, sondern Y“, kein Lob ohne Anlass, keine Diagnosen. Bei körperlichen Warnzeichen, die über Wochen anhalten, rätst du zu ärztlicher Abklärung.',
    `Heute ist ${wtag}.`,
    merk.length ? 'Dein Merkzettel (was Peter dir früher gesagt hat und weiter gilt, nummeriert; nutze es, ohne es aufzuzählen):\n' + merk.map((m, i) => `${i + 1}. ${m.text}`).join('\n') : 'Dein Merkzettel ist noch leer.',
    'Engpass: ' + (engpassAus(kontext) || 'nicht festgelegt'),
    stand.length ? 'Peters Stand aus der Standortbestimmung:\n' + stand.join('\n') : '',
    saison.length ? 'Peters Saison (zwölf Wochen, Ziele mit Hebeln und Wenn-dann-Plänen). Bezieh Rat auf diese Ziele, wenn es passt:\n' + saison.join('\n') : '',
    lage?.standortEtappe ? `Peter hat die Standortbestimmung noch nicht abgeschlossen (Etappe ${lage.standortEtappe} von 3 ist offen). Geht es um Richtung, Prioritäten oder den Engpass, schlag ihm diese Etappe vor: zwölf Minuten, frei erzählt.` : '',
    ...kalender,
    jetzt.length ? 'Heute dran:\n' + jetzt.map((i) => `- ${i.schritt || i.titel || i.text.slice(0, 80)}${i.frist ? ` (Frist ${fristRelativ(i.frist)})` : ''}${i.wenn ? ` | Plan: ${i.wenn}` : ''}`).join('\n') : 'Heute ist noch nichts gesetzt.',
    warnungen.length ? 'Warnsignale (von Life berechnet, sprich sie an):\n' + warnungen.map((w) => '- ' + w).join('\n') : 'Keine Warnsignale.',
    'Körper (zusammengefasst):\n' + koerper + (k.trainingstagHeute ? `\nHeute ist ein Trainingstag (Ganzkörper, Blockwoche ${k.blockWoche} von 5).` : ''),
    geld,
    menschenText,
    zk.length && jetztBerlin().wochentag === 'Mon' ? 'Liste „Zeit kaufen“ (heute ist Wochenrunde, sprich eine Idee an): ' + zk.map((z) => z.was).join(', ') : '',
    checkins.length ? 'Antworten der letzten Tage:\n' + checkins.map(zeile).filter(Boolean).join('\n') : 'Noch keine Antworten aus den Fragebögen.',
    menschen.length ? 'Menschen in Peters Leben: ' + menschen.slice(0, 30).join(', ') : '',
    lage?.offen.length ? 'Heute noch offen (von Life berechnet):\n' + lage.offen.map((o) => '- ' + o).join('\n') : '',
    lage ? `Empfehlung von Life für jetzt: ${lage.empfehlung.titel}. ${lage.empfehlung.grund}` : '',
  ].filter(Boolean);
  return { zeilen, warnungen, merk };
}

export async function coachErstellen(art: 'morgen' | 'abend', userId: string): Promise<CoachAntwort> {
  const tag = heuteBerlin();
  const { zeilen, warnungen } = await grundlage(userId);
  const prompt = [
    `COACH ${art.toUpperCase()}`,
    ...zeilen,
    art === 'morgen'
      ? 'Antworte nur mit JSON: {"text": string (2 bis 3 Sätze, höchstens 280 Zeichen: worauf es heute ankommt, mit Bezug auf Schlaf und Erholung, Training, Engpass und einen Plan von gestern Abend, falls vorhanden; ist freie Zeit im Kalender bekannt, nenn für das Wichtigste eine konkrete Uhrzeit in einer Lücke und plane nie in Familienzeit), "geste": string (eine kleine, konkrete, nette oder unerwartete Geste für einen der genannten Menschen oder die Familie, bevorzugt für jemanden mit länger keinem Kontakt oder einem nahen Geburtstag, die heute höchstens 10 Minuten kostet, höchstens 140 Zeichen; leer, wenn niemand genannt ist)}'
      : 'Antworte nur mit JSON: {"text": string (Rückblick auf heute in 2 bis 3 Sätzen, höchstens 320 Zeichen: was du in den Antworten siehst, ein Muster der letzten Tage, falls eines da ist, und ein Satz zum Plan für morgen)}',
  ].filter(Boolean).join('\n\n');

  let text = ''; let geste = '';
  try {
    // Der Morgen setzt den Tag: dafür das stärkste Modell. Der Rückblick am Abend reicht mit dem Standard.
    const a = art === 'morgen' ? await askJsonTief<{ text?: unknown; geste?: unknown }>(prompt, 700) : await askJson<{ text?: unknown; geste?: unknown }>(prompt, MODEL(), 700);
    text = typeof a.text === 'string' ? a.text.trim().slice(0, 400) : '';
    geste = art === 'morgen' && typeof a.geste === 'string' ? a.geste.trim().slice(0, 200) : '';
  } catch { /* Ohne Claude bleiben die Warnsignale */ }
  const antwort: CoachAntwort = { text, ...(geste ? { geste } : {}), warnungen };
  if (text) {
    await sql`insert into coach (user_id, tag, art, antwort) values (${userId}, ${tag}, ${art}, ${sql.json(antwort)})
      on conflict (user_id, tag, art) do update set antwort = excluded.antwort, created_at = now()`;
  }
  return antwort;
}

export type ChatZeile = { rolle: 'ich' | 'coach'; text: string; zeit: string; experte?: boolean };
export type Merkpunkt = { id: number; text: string; erstellt: string };

/** Der Merkzettel des Coachs (0.29, Peter 31.10.2026): was Peter ihm gesagt hat und über heute hinaus gilt. Älteste zuerst. */
export async function merkzettel(userId: string): Promise<Merkpunkt[]> {
  await ensureSchema();
  return sql<Merkpunkt[]>`select id::int as id, text, to_char(erstellt at time zone 'Europe/Berlin', 'YYYY-MM-DD') as erstellt from coach_merken where user_id = ${userId} order by id`;
}
export async function merkpunktWeg(id: number, userId: string): Promise<boolean> {
  const r = await sql`delete from coach_merken where id = ${id} and user_id = ${userId}`;
  return r.count > 0;
}

/** Das Gespräch der letzten sieben Tage für Claude, ohne Datum: „gestern“, „vor 3 Tagen“. */
async function gespraechWoche(userId: string): Promise<string> {
  const z = await sql<{ tag: string; rolle: string; text: string }[]>`
    select tag::text as tag, rolle, text from (
      select id, tag, rolle, text from coach_chat where user_id = ${userId} and tag >= (${heuteBerlin()}::date - 7) order by id desc limit 40
    ) x order by id`;
  let tag = ''; const aus: string[] = [];
  for (const r of z) {
    if (r.tag !== tag) {
      tag = r.tag;
      const t = Math.round((Date.parse(heuteBerlin()) - Date.parse(r.tag)) / 864e5);
      aus.push(t <= 0 ? '[heute]' : t === 1 ? '[gestern]' : `[vor ${t} Tagen]`);
    }
    aus.push(`${r.rolle === 'ich' ? 'Peter' : 'Coach'}: ${r.text}`);
  }
  return aus.join('\n');
}

/**
 * Gespräch mit dem Coach. Life schickt Claude die Lage, den Merkzettel und das Gespräch der letzten sieben Tage, alles pseudonymisiert.
 * `experte`: Peter will eine Expertenmeinung, dann antwortet Opus gründlicher und länger.
 */
export async function coachChat(nachricht: string, userId: string, experte = false): Promise<ChatZeile[]> {
  const tag = heuteBerlin();
  const text = nachricht.replace(/\s+/g, ' ').trim().slice(0, experte ? 4000 : 1000);
  await sql`insert into coach_chat (user_id, tag, rolle, text, experte) values (${userId}, ${tag}, 'ich', ${text}, ${experte})`;
  const h = await haushalt(userId);
  const [{ zeilen, merk }, gespraech, spar, saison] = await Promise.all([grundlage(userId), gespraechWoche(userId),
    sql<{ name: string }[]>`select name from geld_toepfe where haushalt_id = ${h} and art = 'spar' and aktiv order by sortierung, id`.catch(() => [] as { name: string }[]),
    aktuelleSaison(userId).catch(() => null)]);
  const sparziele = spar.map((x) => x.name);
  const prompt = [
    experte ? 'COACH EXPERTENMEINUNG' : 'COACH CHAT',
    ...zeilen,
    experte
      ? 'Peter bittet ausdrücklich um eine Expertenmeinung. Denk gründlich nach wie ein erfahrener Berater: Lage einordnen, die zwei, drei entscheidenden Punkte abwägen, eine klare Empfehlung mit Begründung und dem nächsten Schritt. Bis zu 10 Sätze, kurze Absätze mit Leerzeile erlaubt, keine Überschriften. Sag offen, wo du unsicher bist oder was du nicht weißt. Bei Gesundheit keine Diagnosen, bei Geld und Recht kein Ersatz für Fachleute.'
      : 'Peter schreibt dir direkt. Antworte wie ein guter Coach im Gespräch: 1 bis 4 Sätze, konkret, mit einem nächsten Schritt, wenn es passt. Keine Listen, keine Überschriften. Bei Fragen zu Gesundheit gibst du keine Diagnosen und rätst bei anhaltenden Beschwerden zu ärztlichem Rat.',
    'Gespräch der letzten Tage (das Letzte ist Peters neue Nachricht):\n' + gespraech,
    sparziele.length ? 'Sparziele (nur Namen): ' + sparziele.join(', ') : 'Sparziele: noch keine angelegt.',
    saison ? 'Eine Saison läuft gerade, saison_vorschlag geht nicht.' : 'Gerade läuft keine Saison.',
    AKTIONEN_TEXT,
    `Antworte nur mit JSON: {"text": string (deine Antwort, höchstens ${experte ? 1500 : 500} Zeichen), "aktionen": Liste (höchstens drei, sonst leer)}`,
  ].join('\n\n');
  let antwort = ''; const nachtraege: string[] = [];
  try {
    type A = { text?: unknown; aktionen?: unknown; aktion?: unknown };
    const a = experte ? await askJsonTief<A>(prompt, 2000) : entscheidend(text) ? await askJsonTief<A>(prompt, 900) : await askJson<A>(prompt, MODEL(), 900);
    antwort = typeof a.text === 'string' ? a.text.trim().slice(0, experte ? 1800 : 600) : '';
    for (const ak of aktionenPruefen(a, sparziele, { merkzettel: merk.length, saisonLaeuft: !!saison })) {
      if ('fehler' in ak) { nachtraege.push(`Nicht geändert: ${ak.fehler}`); continue; }
      nachtraege.push(await ausfuehren(ak, h, userId, merk).then(() => bestaetigung(ak)).catch(() => 'Nicht geändert: Das Speichern hat nicht geklappt.'));
    }
  } catch (e) { antwort = `Ich komme gerade nicht an Claude ran (${oeffentlich(e, 'keine Verbindung', 'coach')}). Versuch es gleich nochmal.`; }
  if (antwort) await sql`insert into coach_chat (user_id, tag, rolle, text, experte) values (${userId}, ${tag}, 'coach', ${antwort}, ${experte})`;
  for (const n of nachtraege) await sql`insert into coach_chat (user_id, tag, rolle, text) values (${userId}, ${tag}, 'coach', ${n})`;
  return chatVerlauf(userId);
}

/** Führt eine geprüfte Aktion aus. Geld nur im eigenen Haushalt, alles andere nur für den Menschen der Sitzung. */
async function ausfuehren(a: CoachAktion, h: string, userId: string, merk: Merkpunkt[]): Promise<void> {
  if (a.art === 'merken') { await sql`insert into coach_merken (user_id, text) values (${userId}, ${a.text})`; return; }
  if (a.art === 'vergessen') { const p = merk[a.nr - 1]; if (!p || !(await merkpunktWeg(p.id, userId))) throw new Error('kein Punkt'); return; }
  if (a.art === 'festhalten') { const id = await createItem(a.text, userId); enrich(id).catch(() => {}); return; }
  if (a.art === 'wochenziel') { await wochenzielSetzen(a.text, userId); return; }
  if (a.art === 'saison_vorschlag') { await setSetting(proNutzer('saison_coach', userId), JSON.stringify(a.ziele)); return; }
  if (a.art === 'sparziel_ziel') {
    const r = await sql`update geld_toepfe set betrag_cent = ${a.cent} where haushalt_id = ${h} and art = 'spar' and aktiv and lower(name) = lower(${a.ziel})`;
    if (!r.count) throw new Error('kein Sparziel');
    return;
  }
  await sql`insert into geld_profil (haushalt_id) values (${h}) on conflict do nothing`;
  if (a.art === 'ruecklage') await sql`update geld_profil set ruecklage_cent = ${a.cent}, updated_at = now() where haushalt_id = ${h}`;
  else await sql`update geld_profil set sparrate_cent = ${a.cent}, updated_at = now() where haushalt_id = ${h}`;
}

export async function chatVerlauf(userId: string): Promise<ChatZeile[]> {
  await ensureSchema();
  return sql<ChatZeile[]>`select rolle, text, to_char(created_at at time zone 'Europe/Berlin', 'HH24:MI') as zeit, experte from coach_chat where user_id = ${userId} and tag = ${heuteBerlin()} order by id`;
}
