/**
 * Regeln für den Riegel der Ablage auf dem iPhone und für die Dauer der Anmeldung (0.31.2, Peter 31.10.2026).
 * Auf Peters iPhone gehen keine Passkeys (Firmen-Einstellung), deshalb eine PIN als Weg, solange das so ist.
 * Rein, ohne Datenbank, damit testbar.
 */
export const PIN_LAENGE = 6;
export const PIN_MAX_FEHL = 5;
export const OFFEN_MIN = 5;          // Riegel zu nach 5 Minuten ohne Nutzung
export const BESTAETIGT_MIN = 5;     // PIN anlegen oder ändern nur mit Bestätigung, höchstens 5 Minuten alt
export const SITZUNG_TAGE = 30;      // gilt 30 Tage ab der letzten Nutzung
export const OBERGRENZE_TAGE = 90;   // nach 90 Tagen trotzdem neu anmelden (Peter, 31.10.2026)
export const COOKIE_NEU_NACH_S = 24 * 3600; // das Cookie wird höchstens einmal am Tag neu ausgestellt

export const pinOk = (p: unknown): p is string => typeof p === 'string' && new RegExp(`^\\d{${PIN_LAENGE}}$`).test(p);

export type PinErgebnis = { ergebnis: 'offen' | 'falsch' | 'gesperrt'; fehl: number };
/** Nächster Stand nach einem PIN-Versuch. Ist die PIN gesperrt, zählt auch eine richtige PIN nicht. */
export function pinVersuch(fehlVorher: number, richtig: boolean): PinErgebnis {
  if (fehlVorher >= PIN_MAX_FEHL) return { ergebnis: 'gesperrt', fehl: fehlVorher };
  if (richtig) return { ergebnis: 'offen', fehl: 0 };
  const fehl = fehlVorher + 1;
  return { ergebnis: fehl >= PIN_MAX_FEHL ? 'gesperrt' : 'falsch', fehl };
}
/** Was Peter liest. Bis die Sperre greift, verrät der Text nicht, ob gesperrt; danach sagt er klar, was jetzt geht. */
export const PIN_TEXT = { falsch: 'Die PIN stimmt nicht.', gesperrt: 'Die PIN ist nach 5 Fehlversuchen gesperrt. Öffne mit Passwort und Code, danach gilt sie wieder.' };

const MIN = 60_000, TAG = 24 * 3600_000;
/** Gilt der Riegel noch? offenBis kommt aus der Sitzung in der Datenbank. */
export const riegelOffen = (offenBis: Date | null, jetzt = Date.now()) => !!offenBis && offenBis.getTime() > jetzt;
export const riegelBis = (jetzt = Date.now()) => new Date(jetzt + OFFEN_MIN * MIN);
export const frischBestaetigt = (bestaetigt: Date | null, jetzt = Date.now()) => !!bestaetigt && jetzt - bestaetigt.getTime() <= BESTAETIGT_MIN * MIN;
/** Gilt eine Sitzung? 30 Tage ab der letzten Nutzung, höchstens 90 Tage ab der Anmeldung. */
export function sitzungGilt(erstellt: Date, zuletzt: Date, jetzt = Date.now()): boolean {
  return jetzt - zuletzt.getTime() <= SITZUNG_TAGE * TAG && jetzt - erstellt.getTime() <= OBERGRENZE_TAGE * TAG;
}
/** Das Cookie neu ausstellen, wenn es älter als einen Tag ist, damit es sich bei Nutzung verlängert. */
export const cookieErneuern = (ausgestelltS: number | undefined, jetztS = Math.floor(Date.now() / 1000)) => !!ausgestelltS && jetztS - ausgestelltS > COOKIE_NEU_NACH_S;
