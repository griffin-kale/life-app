import { askJson, geschuetzteNamen, MODEL } from './claude';
import { ensureSchema, getSetting, sql } from './db';
import { BOEGEN, who5, type Antwort } from './fragen';
import { engpassAus, heuteBerlin, offene } from './priorisieren';
import { warnsignale } from './coach-regeln';

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
  return `${c.tag} ${b.titel}${w !== null ? ` (WHO-5: ${w} von 100)` : ''}: ${teile.join(' | ')}`;
};

export async function coachErstellen(art: 'morgen' | 'abend', userId = 'peter'): Promise<CoachAntwort> {
  await ensureSchema();
  const tag = heuteBerlin();
  const [items, kontext, checkins, namen] = await Promise.all([
    offene(),
    getSetting('kontext'),
    sql<Checkin[]>`select art, tag::text as tag, antworten from checkins where user_id = ${userId} and tag >= (current_date - 8) order by tag, art`,
    geschuetzteNamen(),
  ]);
  const warnungen = warnsignale(items);
  const jetzt = items.filter((i) => i.stapel === 'jetzt').slice(0, 3);
  const menschen = namen.filter((n) => n.art === 'Person' && !/^(Peter|Gneuß|Peter Gneuß)$/.test(n.name)).map((n) => n.name);
  const wtag = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const prompt = [
    `COACH ${art.toUpperCase()}`,
    'Du bist Peters Coach: ein erfahrener Trainer und Stabschef in einem. Du kennst seine Daten der letzten Tage und sagst ihm in wenigen Sätzen, worauf es heute ankommt.',
    'Ton je nach Lage: Liegt ein Warnsignal vor oder geht es ihm schlecht, sprich direkt und konkret wie ein Trainer. Sonst ruhig, warm, ohne Pathos. Du-Form, Deutsch.',
    'Schreibregeln: aktive Sätze mit konkretem Subjekt, keine Floskeln, keine rhetorischen Fragen, keine Konstruktion „nicht X, sondern Y“, kein Lob ohne Anlass, keine Diagnosen. Bei körperlichen Warnzeichen, die über Wochen anhalten, rätst du zu ärztlicher Abklärung.',
    `Heute ist ${wtag}.`,
    'Engpass: ' + (engpassAus(kontext) || 'nicht festgelegt'),
    jetzt.length ? 'Heute dran:\n' + jetzt.map((i) => `- ${i.schritt || i.titel || i.text.slice(0, 80)}${i.frist ? ` (Frist ${i.frist})` : ''}`).join('\n') : 'Heute ist noch nichts gesetzt.',
    warnungen.length ? 'Warnsignale (von Life berechnet, sprich sie an):\n' + warnungen.map((w) => '- ' + w).join('\n') : 'Keine Warnsignale.',
    checkins.length ? 'Antworten der letzten Tage:\n' + checkins.map(zeile).filter(Boolean).join('\n') : 'Noch keine Antworten aus den Fragebögen.',
    menschen.length ? 'Menschen in Peters Leben: ' + menschen.slice(0, 30).join(', ') : '',
    art === 'morgen'
      ? 'Antworte nur mit JSON: {"text": string (2 bis 3 Sätze, höchstens 280 Zeichen: worauf es heute ankommt, mit Bezug auf Erholung, Engpass und einen Plan von gestern Abend, falls vorhanden), "geste": string (eine kleine, konkrete, nette oder unerwartete Geste für einen der genannten Menschen oder die Familie, die heute höchstens 10 Minuten kostet, höchstens 140 Zeichen; leer, wenn niemand genannt ist)}'
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
