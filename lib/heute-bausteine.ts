/** Bausteine auf „Heute“. Jeder Mensch stellt sie selbst zusammen. „Jetzt dran“ und der Fragebogen bleiben immer an.
 *  Der Coach ist seit 0.18 kein Baustein mehr: Er sitzt als Leiste unten und geht als Blatt auf, auf dem Mac steht er rechts. */
export const BAUSTEINE = ['kompass', 'woche', 'schnell', 'empfohlen', 'kalender', 'fragebogen', 'festhalten', 'koerper', 'geld', 'menschen', 'jetzt', 'naechste', 'erledigt'] as const;
export type Baustein = (typeof BAUSTEINE)[number];
export const FEST: readonly Baustein[] = ['fragebogen', 'jetzt'];
export const STANDARD: Baustein[] = ['kompass', 'fragebogen', 'jetzt', 'empfohlen', 'schnell', 'naechste', 'erledigt'];
export const BAUSTEIN_NAME: Record<Baustein, [string, string]> = {
  kompass: ['Wochenringe', 'Fünf Ringe und Level, ganz oben'],
  woche: ['Wochenstand', 'Sieben Tagespunkte unter dem Titel'],
  schnell: ['Schnellzugriffe', 'Plus mit Menü, Essen, Ausgabe, Ruhe, Training'],
  empfohlen: ['Empfohlen für dich', 'Eine Sache, die heute passt, mit einem Tipp'],
  kalender: ['Kalender', 'Der ganze Tag mit Terminen und freier Zeit'],
  fragebogen: ['Fragebogen', 'Erscheint, wenn er dran ist'],
  festhalten: ['Festhalten-Feld', 'Zusätzlich zum Feld im Coach'],
  koerper: ['Körper kurz', 'Erholung und Schlaf'],
  geld: ['Geld kurz', 'Wochentöpfe'],
  menschen: ['Menschen', 'Wer gerade dran ist'],
  jetzt: ['Jetzt dran', 'Immer an'],
  naechste: ['Als Nächstes', 'Die nächsten drei'],
  erledigt: ['Heute erledigt', 'Mit Energie-Bilanz'],
};

/** Prüft eine gespeicherte oder gesendete Liste: nur bekannte Bausteine, keine doppelt, feste immer dabei. */
export function bausteineAus(roh: unknown): Baustein[] {
  const liste = Array.isArray(roh) ? roh : [];
  const aus: Baustein[] = [];
  for (const x of liste) if ((BAUSTEINE as readonly string[]).includes(x as string) && !aus.includes(x as Baustein)) aus.push(x as Baustein);
  if (!aus.length) return [...STANDARD];
  for (const f of FEST) if (!aus.includes(f)) aus.splice(f === 'jetzt' ? aus.length : 0, 0, f);
  return aus;
}

/** Neue Bausteine, die eine schon gespeicherte Liste einmal bekommt: ab welchem Stand, welcher Baustein, hinter welchem. */
const NEU: [number, Baustein, Baustein][] = [[2, 'schnell', 'woche'], [3, 'empfohlen', 'schnell'], [4, 'kalender', 'empfohlen']];
export const STAND = 5;

/** Umbau 0.18 (Peter, 26.10.2026): Ringe nach oben, Jetzt dran früh, Kalender, Festhalten-Feld und Tagespunkte runter von Heute. */
const WEG_5: Baustein[] = ['kalender', 'festhalten', 'woche'];
const RANG_5: Baustein[] = ['kompass', 'fragebogen', 'jetzt', 'empfohlen', 'schnell', 'naechste', 'koerper', 'geld', 'menschen', 'erledigt'];

/** Setzt neue Bausteine einmal in eine gespeicherte Liste. Gibt null zurück, wenn nichts zu tun ist. */
export function nachruesten(liste: Baustein[], stand: number): { liste: Baustein[]; stand: number } | null {
  if (stand >= STAND) return null;
  let neu = [...liste];
  for (const [ab, b, hinter] of NEU) {
    if (stand >= ab || neu.includes(b)) continue;
    const i = neu.indexOf(hinter); neu.splice(i >= 0 ? i + 1 : 0, 0, b);
  }
  if (stand < 5) {
    neu = neu.filter((b) => !WEG_5.includes(b));
    if (!neu.includes('kompass')) neu.unshift('kompass');
    neu.sort((a, b) => RANG_5.indexOf(a) - RANG_5.indexOf(b));
  }
  return { liste: neu, stand: STAND };
}
