import { askJson, geschuetzteNamen, MODEL } from './claude';
import { ensureSchema, getSetting, sql } from './db';
import { BOEGEN, who5, type Antwort } from './fragen';
import { engpassAus, heuteBerlin, offene } from './priorisieren';
import { koerperZusammenfassung, warnsignale } from './coach-regeln';
import { koerperStand } from './koerper';
import { geldKurz, geldStand } from './geld';
import { menschenKurz } from './menschen';
import { tageslage } from './tag';
import { standZeilenLesen } from './stand';
import { kalenderKurz } from './kalender';

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
    offene(),
    getSetting('kontext'),
    sql<Checkin[]>`select art, tag::text as tag, antworten from checkins where user_id = ${userId} and tag >= (current_date - 8) order by tag, art`,
    geschuetzteNamen(),
    koerperStand(userId),
    geldKurz(userId).catch(() => ''),
    geldStand(userId).catch(() => null),
    menschenKurz(userId).catch(() => ''),
  ]);
  const [lage, stand, kalender] = await Promise.all([tageslage(userId).catch(() => null), standZeilenLesen(userId).catch(() => [] as string[]), kalenderKurz(userId).catch(() => [] as string[])]);
  const zk = await sql<{ was: string }[]>`select was from zeit_kaufen where user_id = ${userId} and status = 'idee' limit 5`.catch(() => [] as { was: string }[]);
  const warnungen = [...k.warnungen, ...(g?.warnungen ?? []), ...warnsignale(items)];
  const koerper = koerperZusammenfassung({ naechte: k.naechte.slice(0, 7), erholung: k.tage.slice(0, 7).map((t) => t.erholung), ruhepuls: k.tage.slice(0, 14).map((t) => t.ruhepuls),
    kraft: k.kraft, kraftSoll: k.stand.einheitenSoll, zone2: k.zone2, intervall: k.intervall, proteinGestern: k.proteinGestern, proteinZiel: k.proteinZiel, ruheMin: k.ruheMin, ruheTage: k.ruheTage });
  const jetzt = items.filter((i) => i.stapel === 'jetzt').slice(0, 3);
  const menschen = namen.filter((n) => n.art === 'Person' && !/^(Peter|Gneuß|Peter Gneuß)$/.test(n.name)).map((n) => n.name);
  const wtag = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const zeilen = [
    'Du bist Peters Coach: ein erfahrener Trainer und Stabschef in einem. Du kennst seine Daten der letzten Tage und sagst ihm in wenigen Sätzen, worauf es heute ankommt.',
    'Ton je nach Lage: Liegt ein Warnsignal vor oder geht es ihm schlecht, sprich direkt und konkret wie ein Trainer. Sonst ruhig, warm, ohne Pathos. Du-Form, Deutsch.',
    'Schreibregeln: aktive Sätze mit konkretem Subjekt, keine Floskeln, keine rhetorischen Fragen, keine Konstruktion „nicht X, sondern Y“, kein Lob ohne Anlass, keine Diagnosen. Bei körperlichen Warnzeichen, die über Wochen anhalten, rätst du zu ärztlicher Abklärung.',
    `Heute ist ${wtag}.`,
    'Engpass: ' + (engpassAus(kontext) || 'nicht festgelegt'),
    stand.length ? 'Peters Stand aus der Standortbestimmung:\n' + stand.join('\n') : '',
    lage?.standortEtappe ? `Peter hat die Standortbestimmung noch nicht abgeschlossen (Etappe ${lage.standortEtappe} von 3 ist offen). Geht es um Richtung, Prioritäten oder den Engpass, schlag ihm diese Etappe vor: zwölf Minuten, frei erzählt.` : '',
    ...kalender,
    jetzt.length ? 'Heute dran:\n' + jetzt.map((i) => `- ${i.schritt || i.titel || i.text.slice(0, 80)}${i.frist ? ` (Frist ${i.frist})` : ''}${i.wenn ? ` | Plan: ${i.wenn}` : ''}`).join('\n') : 'Heute ist noch nichts gesetzt.',
    warnungen.length ? 'Warnsignale (von Life berechnet, sprich sie an):\n' + warnungen.map((w) => '- ' + w).join('\n') : 'Keine Warnsignale.',
    'Körper (zusammengefasst):\n' + koerper + (k.trainingstagHeute ? `\nHeute ist ein Trainingstag (Ganzkörper, Blockwoche ${k.blockWoche} von 5).` : ''),
    geld,
    menschenText,
    zk.length && new Date().getDay() === 1 ? 'Liste „Zeit kaufen“ (heute ist Wochenrunde, sprich eine Idee an): ' + zk.map((z) => z.was).join(', ') : '',
    checkins.length ? 'Antworten der letzten Tage:\n' + checkins.map(zeile).filter(Boolean).join('\n') : 'Noch keine Antworten aus den Fragebögen.',
    menschen.length ? 'Menschen in Peters Leben: ' + menschen.slice(0, 30).join(', ') : '',
    lage?.offen.length ? 'Heute noch offen (von Life berechnet):\n' + lage.offen.map((o) => '- ' + o).join('\n') : '',
    lage ? `Empfehlung von Life für jetzt: ${lage.empfehlung.titel}. ${lage.empfehlung.grund}` : '',
  ].filter(Boolean);
  return { zeilen, warnungen };
}

export async function coachErstellen(art: 'morgen' | 'abend', userId = 'peter'): Promise<CoachAntwort> {
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
    const a = await askJson<{ text?: unknown; geste?: unknown }>(prompt, MODEL(), 700);
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

export type ChatZeile = { rolle: 'ich' | 'coach'; text: string; zeit: string };

/** Gespräch mit dem Coach. Gilt für den Tag: Life schickt Claude die Lage und den Verlauf von heute, beides pseudonymisiert. */
export async function coachChat(nachricht: string, userId = 'peter'): Promise<ChatZeile[]> {
  const tag = heuteBerlin();
  const text = nachricht.replace(/\s+/g, ' ').trim().slice(0, 1000);
  await sql`insert into coach_chat (user_id, tag, rolle, text) values (${userId}, ${tag}, 'ich', ${text})`;
  const [{ zeilen }, verlauf] = await Promise.all([grundlage(userId), chatVerlauf(userId)]);
  const prompt = [
    'COACH CHAT',
    ...zeilen,
    'Peter schreibt dir direkt. Antworte wie ein guter Coach im Gespräch: 1 bis 4 Sätze, konkret, mit einem nächsten Schritt, wenn es passt. Keine Listen, keine Überschriften. Bei Fragen zu Gesundheit gibst du keine Diagnosen und rätst bei anhaltenden Beschwerden zu ärztlichem Rat.',
    'Gespräch von heute:\n' + verlauf.slice(-12).map((z) => `${z.rolle === 'ich' ? 'Peter' : 'Coach'}: ${z.text}`).join('\n'),
    'Antworte nur mit JSON: {"text": string (deine Antwort, höchstens 500 Zeichen)}',
  ].join('\n\n');
  let antwort = '';
  try {
    const a = await askJson<{ text?: unknown }>(prompt, MODEL(), 600);
    antwort = typeof a.text === 'string' ? a.text.trim().slice(0, 600) : '';
  } catch (e) { antwort = `Ich komme gerade nicht an Claude ran (${(e as Error).message}). Versuch es gleich nochmal.`; }
  if (antwort) await sql`insert into coach_chat (user_id, tag, rolle, text) values (${userId}, ${tag}, 'coach', ${antwort})`;
  return chatVerlauf(userId);
}

export async function chatVerlauf(userId = 'peter'): Promise<ChatZeile[]> {
  await ensureSchema();
  return sql<ChatZeile[]>`select rolle, text, to_char(created_at at time zone 'Europe/Berlin', 'HH24:MI') as zeit from coach_chat where user_id = ${userId} and tag = ${heuteBerlin()} order by id`;
}
