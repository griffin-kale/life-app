/**
 * Bausteine auf „Heute“. Jeder Mensch stellt sie selbst zusammen. Die eine Sache und der Check-in bleiben immer an.
 * MAYA (0.33, Richtung B, Peter 23.11.2026): höchstens fünf Blöcke im Standard, sieben zur Wahl statt sechzehn.
 * Der Coach ist kein Baustein: Er sitzt als Leiste unten und geht als Blatt auf, auf dem Mac steht er rechts.
 */
export const BAUSTEINE = ['fragebogen', 'jetzt', 'saison', 'streifen', 'liste', 'kalender', 'erledigt'] as const;
export type Baustein = (typeof BAUSTEINE)[number];
export const FEST: readonly Baustein[] = ['fragebogen', 'jetzt'];
export const STANDARD: Baustein[] = ['fragebogen', 'jetzt', 'saison', 'streifen', 'liste'];
export const BAUSTEIN_NAME: Record<Baustein, [string, string]> = {
  fragebogen: ['Check-in', 'Morgen, Abend und Wochenrückblick, wenn sie dran sind'],
  jetzt: ['Die eine Sache', 'Immer an'],
  saison: ['Saison heute', 'Standards und Leben heute, solange eine Challenge läuft'],
  streifen: ['Als Nächstes', 'Die nächsten Termine und Blöcke'],
  liste: ['Liste', 'Was heute noch offen ist, mit Fortschritt'],
  kalender: ['Kalender', 'Der ganze Tag mit Terminen und freier Zeit'],
  erledigt: ['Heute erledigt', 'Zugeklappt, mit Energie-Bilanz'],
};

/** Prüft eine gespeicherte oder gesendete Liste: nur bekannte Bausteine, keine doppelt, Check-in vorn und die eine Sache dahinter immer dabei. */
export function bausteineAus(roh: unknown): Baustein[] {
  const liste = Array.isArray(roh) ? roh : [];
  const aus: Baustein[] = [];
  for (const x of liste) if ((BAUSTEINE as readonly string[]).includes(x as string) && !aus.includes(x as Baustein)) aus.push(x as Baustein);
  if (!aus.length) return [...STANDARD];
  if (!aus.includes('fragebogen')) aus.unshift('fragebogen');
  if (!aus.includes('jetzt')) aus.splice(aus.indexOf('fragebogen') + 1, 0, 'jetzt');
  return aus;
}

/** Stand der gespeicherten Listen. Ab 11 gilt die Liste von MAYA. */
export const STAND = 11;

/**
 * Bringt eine gespeicherte Liste auf den Stand von MAYA (0.33): Standard für alle, Kalender und Erledigt bleiben,
 * wenn sie vorher an waren. Gibt null zurück, wenn nichts zu tun ist.
 */
export function nachruesten(liste: readonly string[], stand: number): { liste: Baustein[]; stand: number } | null {
  if (stand >= STAND) return null;
  const neu: Baustein[] = [...STANDARD];
  for (const b of ['kalender', 'erledigt'] as const) if (liste.includes(b)) neu.push(b);
  return { liste: neu, stand: STAND };
}
