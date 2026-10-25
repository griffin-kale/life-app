/** Bausteine auf „Heute“. Jeder Mensch stellt sie selbst zusammen. „Jetzt dran“ und der Fragebogen bleiben immer an. */
export const BAUSTEINE = ['woche', 'schnell', 'kompass', 'fragebogen', 'coach', 'festhalten', 'koerper', 'geld', 'menschen', 'jetzt', 'naechste', 'erledigt'] as const;
export type Baustein = (typeof BAUSTEINE)[number];
export const FEST: readonly Baustein[] = ['fragebogen', 'jetzt'];
export const STANDARD: Baustein[] = ['woche', 'schnell', 'kompass', 'fragebogen', 'coach', 'festhalten', 'jetzt', 'naechste', 'erledigt'];
export const BAUSTEIN_NAME: Record<Baustein, [string, string]> = {
  woche: ['Wochenstand', 'Sieben Tagespunkte oben'],
  schnell: ['Schnellzugriffe', 'Plus mit Menü, Essen, Ausgabe, Ruhe, Training'],
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

/** Einmalig neue Bausteine in eine schon gespeicherte Liste setzen. Gibt null zurück, wenn nichts zu tun ist. */
export function nachruesten(liste: Baustein[], stand: number): { liste: Baustein[]; stand: number } | null {
  if (stand >= 2) return null;
  if (liste.includes('schnell')) return { liste, stand: 2 };
  const i = liste.indexOf('woche');
  const neu = [...liste]; neu.splice(i >= 0 ? i + 1 : 0, 0, 'schnell');
  return { liste: neu, stand: 2 };
}
