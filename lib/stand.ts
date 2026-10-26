import { askJsonTief } from './claude';
import { ensureSchema, getSetting, setSetting, sql } from './db';
import type { Antwort } from './fragen';
import { engpassAus, heuteBerlin, offene } from './priorisieren';
import { engpassSetzen, montagVon } from './tagesregeln';
import { BEREICH_NAME, baselineSetzen, etappe, pruefeAuswertung, standAus, standZeilen, uebernehmen, type Auswertung, type Stand, type Vorschlag } from './standort';
import { aufgabe } from './tag';

/** Stand lesen und schreiben, Etappen auswerten. Claude bekommt alles pseudonymisiert über askJson. */

const KEY = (u: string) => `stand:${u}`;

export async function standLesen(userId = 'peter'): Promise<Stand> { return standAus(await getSetting(KEY(userId))); }
async function standSchreiben(s: Stand, userId: string) { await setSetting(KEY(userId), JSON.stringify(s).slice(0, 20000)); }

export async function wochenziel(userId = 'peter'): Promise<string> {
  try { const w = JSON.parse((await getSetting(`wochenziel:${userId}`)) || '{}'); return w.montag === montagVon(heuteBerlin()) && typeof w.text === 'string' ? w.text : ''; } catch { return ''; }
}
export async function wochenzielSetzen(text: string, userId = 'peter') {
  await setSetting(`wochenziel:${userId}`, JSON.stringify({ montag: montagVon(heuteBerlin()), text: text.replace(/\s+/g, ' ').trim().slice(0, 200) }));
}

export async function standZeilenLesen(userId = 'peter'): Promise<string[]> {
  const [s, w] = await Promise.all([standLesen(userId), wochenziel(userId)]);
  return standZeilen(s, heuteBerlin(), w);
}

const antwortText = (nr: number, a: Record<string, Antwort>) => {
  const e = etappe(nr)!;
  return e.fragen.map((f) => {
    const x = a[f.id]; if (!x) return '';
    const teile = [x.wert !== undefined ? `${x.wert} von 10` : '', x.auswahl?.join(', '), x.text, x.notiz].filter(Boolean).join(' | ');
    return teile ? `${f.frage}${f.typ === 'zahl' ? ` (Nachfrage: ${f.nachfrage})` : ''}: ${teile}` : '';
  }).filter(Boolean).join('\n');
};

const ANWEISUNG: Record<number, string> = {
  1: 'Fasse in 2 bis 3 Sätzen zusammen, wo Peter steht, mit seinen Worten und Zahlen. Schlage genau einen persönlichen Fokus vor (art "fokus", bereich ein Konto: zeit, sozial, mental, koerper, geld): den Bereich, in dem ein kleiner Schritt am meisten bewirkt, mit einem Satz warum und dem kleinsten nächsten Schritt.',
  2: 'Fasse in 2 bis 3 Sätzen zusammen, wohin Peter will. Schlage vor: "werte" (die drei Werte mit je einem Halbsatz, was sie für ihn heißen), "jahr" (sein Bild in einem Jahr in höchstens zwei Sätzen), bis zu drei "quartal"-Ziele (je bereich: geschaeft, zeit, sozial, mental, koerper oder geld; konkret und messbar, mit Zahl, wenn er eine genannt hat) und "weglassen" (was er bewusst liegen lässt).',
  3: 'Leite mit Peter den Engpass seines Geschäfts her, nach der Engpasstheorie: Ziel in Zahlen, dann die Kette vom ersten Kontakt bis zum bezahlten Auftrag, dann die Stelle, an der sich am meisten staut. Fasse in 2 bis 3 Sätzen zusammen. Schlage vor: genau einen "engpass" (ein Satz mit Zahl, wenn möglich; dazu "herleitung": 2 bis 3 Sätze, warum genau diese Stelle), ein "wochenziel" für diese Woche, das den Engpass direkt verkleinert und bis Freitag schaffbar ist, und, wenn passend, "weglassen" (was er unterordnen oder liegen lassen sollte, damit der Engpass Zeit bekommt).',
};

/** Speichert die Antworten einer Etappe, setzt bei Etappe 1 die Baseline und lässt Claude auswerten. */
export async function etappeAuswerten(nr: 1 | 2 | 3, antworten: Record<string, Antwort>, userId = 'peter'): Promise<{ id: number; auswertung: Auswertung }> {
  await ensureSchema();
  const tag = heuteBerlin();
  let s = await standLesen(userId);
  if (nr === 1) s = baselineSetzen(s, antworten, tag);
  s = { ...s, etappen: { ...s.etappen, [String(nr)]: tag } };
  await standSchreiben(s, userId);
  const [{ id }] = await sql<{ id: number }[]>`insert into standort (user_id, etappe, antworten) values (${userId}, ${nr}, ${sql.json(antworten)}) returning id`;

  const [kontext, ziele, items] = await Promise.all([getSetting('kontext'), getSetting('ziele'), offene().catch(() => [])]);
  const e = etappe(nr)!;
  const prompt = [
    `STANDORT ETAPPE ${nr}`,
    'Du bist Peters Coach: erfahrener Trainer und Stabschef in einem. Peter hat gerade frei erzählt, oft diktiert. Hör genau hin, nimm seine Worte auf und erfinde nichts dazu.',
    'Schreibregeln: Du-Form, Deutsch, aktive Sätze mit konkretem Subjekt, keine Floskeln, keine rhetorischen Fragen, keine Konstruktion „nicht X, sondern Y“, keine Diagnosen.',
    `Etappe ${nr}: ${e.titel}.`,
    standZeilen(s, tag).length ? 'Was Peter schon festgelegt hat:\n' + standZeilen(s, tag).join('\n') : '',
    'Engpass bisher: ' + (engpassAus(kontext) || 'nicht festgelegt'),
    ziele ? 'Ziele und Bereiche: ' + ziele.split('\n').filter(Boolean).join(', ') : '',
    nr === 3 && items.length ? 'Offene Aufgaben (Auszug):\n' + items.slice(0, 15).map((i) => '- ' + aufgabe(i)).join('\n') : '',
    'Peters Antworten:\n' + antwortText(nr, antworten),
    ANWEISUNG[nr],
    'Antworte nur mit JSON: {"zusammenfassung": string (höchstens 400 Zeichen), "vorschlaege": [{"art": string, "text": string (höchstens 200 Zeichen), "bereich"?: string, "herleitung"?: string}]}',
  ].filter(Boolean).join('\n\n');
  let auswertung: Auswertung = { zusammenfassung: '', vorschlaege: [] };
  try { auswertung = pruefeAuswertung(nr, await askJsonTief(prompt, 1400)); }
  catch { auswertung = { zusammenfassung: 'Claude ist gerade nicht erreichbar. Deine Antworten sind gespeichert, die Auswertung kannst du gleich nochmal anstoßen.', vorschlaege: [] }; }
  await sql`update standort set auswertung = ${sql.json(auswertung)} where id = ${id}`;
  return { id, auswertung };
}

/** Wertet die zuletzt gespeicherte Etappe nochmal aus, zum Beispiel wenn Claude vorher nicht erreichbar war. */
export async function neuAuswerten(nr: 1 | 2 | 3, userId = 'peter') {
  const [r] = await sql<{ antworten: Record<string, Antwort> }[]>`select antworten from standort where user_id = ${userId} and etappe = ${nr} order by id desc limit 1`;
  if (!r) return null;
  return etappeAuswerten(nr, r.antworten, userId);
}

export async function letzteAuswertung(nr: number, userId = 'peter'): Promise<{ id: number; auswertung: Auswertung | null; antworten: Record<string, Antwort> } | null> {
  await ensureSchema();
  const [r] = await sql<{ id: number; auswertung: Auswertung | null; antworten: Record<string, Antwort> }[]>`select id, auswertung, antworten from standort where user_id = ${userId} and etappe = ${nr} order by id desc limit 1`;
  return r ?? null;
}

/** Übernimmt einen Vorschlag. Engpass geht in den Kontext, das Wochenziel in die Woche, alles andere in den Stand. */
export async function vorschlagUebernehmen(nr: number, v: Vorschlag, userId = 'peter'): Promise<Stand> {
  const geprueft = pruefeAuswertung(nr, { vorschlaege: [v] }).vorschlaege[0];
  if (!geprueft) throw new Error('Vorschlag ungültig');
  const s = uebernehmen(await standLesen(userId), geprueft, heuteBerlin());
  await standSchreiben(s, userId);
  if (geprueft.art === 'engpass') await setSetting('kontext', engpassSetzen(await getSetting('kontext'), geprueft.text).slice(0, 8000));
  if (geprueft.art === 'wochenziel') await wochenzielSetzen(geprueft.text, userId);
  return s;
}

export { BEREICH_NAME };
