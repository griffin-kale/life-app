/** Bausteine auf „Heute“. Jeder Mensch stellt sie selbst zusammen. „Jetzt dran“ und der Fragebogen bleiben immer an.
 *  Der Coach ist seit 0.18 kein Baustein mehr: Er sitzt als Leiste unten und geht als Blatt auf, auf dem Mac steht er rechts. */
export const BAUSTEINE = ['cockpit', 'streifen', 'konten', 'kompass', 'schnell', 'empfohlen', 'kalender', 'fragebogen', 'festhalten', 'koerper', 'geld', 'menschen', 'jetzt', 'naechste', 'erledigt'] as const;
export type Baustein = (typeof BAUSTEINE)[number];
export const FEST: readonly Baustein[] = ['fragebogen', 'jetzt'];
/** Life 2.0 (Peter, 27.10.2026): Cockpit oben, die eine Sache, Tagesstreifen, Konten. */
export const STANDARD: Baustein[] = ['cockpit', 'jetzt', 'streifen', 'fragebogen', 'konten', 'naechste', 'erledigt'];
export const BAUSTEIN_NAME: Record<Baustein, [string, string]> = {
  cockpit: ['Cockpit', 'Erholung, freie Zeit und Woche auf einen Blick'],
  streifen: ['Als Nächstes', 'Die nächsten drei Blöcke des Tages'],
  konten: ['Konten heute', 'Je Konto eine Zeile, was heute zählt'],
  kompass: ['Wochenringe', 'Klein neben dem Titel'],
  schnell: ['Schnellzugriffe', 'Zusätzlich zum Plus in der Mitte der Leiste'],
  empfohlen: ['Empfohlen für dich', 'Eine Sache, die heute passt, mit einem Tipp'],
  kalender: ['Kalender', 'Der ganze Tag mit Terminen und freier Zeit'],
  fragebogen: ['Fragebogen', 'Erscheint, wenn er dran ist'],
  festhalten: ['Festhalten-Feld', 'Zusätzlich zum Feld im Coach'],
  koerper: ['Körper kurz', 'Erholung und Schlaf'],
  geld: ['Geld kurz', 'Wochentöpfe'],
  menschen: ['Menschen', 'Wer gerade dran ist'],
  jetzt: ['Die eine Sache', 'Immer an'],
  naechste: ['Danach', 'Die anderen von heute, zugeklappt'],
  erledigt: ['Heute erledigt', 'Zugeklappt, mit Energie-Bilanz'],
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
const NEU: [number, Baustein, string][] = [[2, 'schnell', 'woche'], [3, 'empfohlen', 'schnell'], [4, 'kalender', 'empfohlen']];
export const STAND = 8;

/** Umbau 0.18 (Peter, 26.10.2026): Ringe nach oben, Jetzt dran früh, Kalender, Festhalten-Feld und Tagespunkte runter von Heute. */
const WEG_5: string[] = ['kalender', 'festhalten', 'woche'];
const RANG_5: Baustein[] = ['kompass', 'fragebogen', 'jetzt', 'empfohlen', 'schnell', 'naechste', 'koerper', 'geld', 'menschen', 'erledigt'];

/** Umbau 0.19 (Peter, 26.10.2026, The ONE Thing): die eine Sache vor dem Fragebogen, Empfohlen und Schnellzugriffe runter von Heute, Tagespunkte fallen weg. */
const WEG_6: string[] = ['empfohlen', 'schnell', 'woche'];

/** Setzt neue Bausteine einmal in eine gespeicherte Liste. Gibt null zurück, wenn nichts zu tun ist. */
export function nachruesten(liste: Baustein[], stand: number): { liste: Baustein[]; stand: number } | null {
  if (stand >= STAND) return null;
  let neu = [...liste];
  for (const [ab, b, hinter] of NEU) {
    if (stand >= ab || neu.includes(b)) continue;
    const i = neu.indexOf(hinter as Baustein); neu.splice(i >= 0 ? i + 1 : 0, 0, b);
  }
  if (stand < 5) {
    neu = neu.filter((b) => !WEG_5.includes(b));
    if (!neu.includes('kompass')) neu.unshift('kompass');
    neu.sort((a, b) => RANG_5.indexOf(a) - RANG_5.indexOf(b));
  }
  if (stand < 6) {
    neu = neu.filter((b) => !WEG_6.includes(b));
    const f = neu.indexOf('fragebogen'), j = neu.indexOf('jetzt');
    if (f >= 0 && j > f) { neu.splice(j, 1); neu.splice(f, 0, 'jetzt'); }
  }
  // 0.20 (Peter, 26.10.2026): Empfohlen ist wieder Standard, direkt unter der einen Sache. Schnellzugriffe sitzen jetzt in der Mitte der Leiste.
  if (stand < 7 && !neu.includes('empfohlen')) neu.splice(neu.indexOf('jetzt') + 1, 0, 'empfohlen');
  // 0.25 Life 2.0 (Peter, 27.10.2026): Cockpit statt Wochenringen, Tagesstreifen unter der einen Sache, Konten statt Empfohlen.
  if (stand < 8) {
    const k = neu.indexOf('kompass');
    if (k >= 0) neu.splice(k, 1, 'cockpit'); else if (!neu.includes('cockpit')) neu.unshift('cockpit');
    neu = neu.filter((b) => b !== 'empfohlen');
    if (!neu.includes('streifen')) neu.splice(neu.indexOf('jetzt') + 1, 0, 'streifen');
    if (!neu.includes('konten')) { const f = neu.indexOf('fragebogen'); neu.splice(f >= 0 ? f + 1 : neu.indexOf('streifen') + 1, 0, 'konten'); }
  }
  return { liste: neu, stand: STAND };
}
