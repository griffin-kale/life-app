/** Bausteine auf „Heute“. Jeder Mensch stellt sie selbst zusammen. „Jetzt dran“ und der Fragebogen bleiben immer an. */
export const BAUSTEINE = ['woche', 'kompass', 'fragebogen', 'coach', 'festhalten', 'koerper', 'geld', 'menschen', 'jetzt', 'naechste', 'erledigt'] as const;
export type Baustein = (typeof BAUSTEINE)[number];
export const FEST: readonly Baustein[] = ['fragebogen', 'jetzt'];
export const STANDARD: Baustein[] = ['woche', 'kompass', 'fragebogen', 'coach', 'festhalten', 'jetzt', 'naechste', 'erledigt'];
export const BAUSTEIN_NAME: Record<Baustein, [string, string]> = {
  woche: ['Wochenstand', 'Sieben Tagespunkte oben'],
  kompass: ['Kompass', 'Fünf Ringe und Level'],
  fragebogen: ['Fragebogen', 'Erscheint, wenn er dran ist'],
  coach: ['Coach', 'Morgens und abends'],
  festhalten: ['Festhalten-Feld', 'Ohne Feld sitzt oben rechts ein Plus'],
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
