/**
 * Die Hunderter (0.32, Peter 12.11.2026): 100 Tage, sechs Standards fürs Geschäft, fünf verordnete Leben-Aufgaben,
 * zehn Joker, die hinten anhängen. Reine Regeln ohne Datenbank, damit die Einheitstests sie direkt prüfen.
 * Datumswerte sind Kalendertage 'JJJJ-MM-TT' in Berlin, gerechnet wird in UTC ohne Uhrzeit.
 */

export const TAGE = 100;
export const JOKER = 10;
/** Für den laufenden Tag gibt es einen Joker nur bis 10 Uhr, damit er keine Ausrede am Abend wird (Peter, 12.11.2026). */
export const JOKER_BIS_MIN = 10 * 60;
/** Ab so vielen Minuten zählt ein Fokusblock als Phase (50 + 10, ein paar Minuten Kulanz). */
export const PHASE_MIN = 45;

export const BEREICHE_H = ['shop', 'mail', 'foerderung', 'plattform', 'admin'] as const;
export type HBereich = (typeof BEREICHE_H)[number];
export const BEREICH_NAME: Record<HBereich, string> = {
  shop: 'Shop', mail: 'Mail und Briefe', foerderung: 'Förderung', plattform: 'Plattform', admin: 'Admin und System',
};
export const BEREICH_KURZ: Record<HBereich, string> = { shop: 'Shop', mail: 'Mail', foerderung: 'Förderung', plattform: 'Plattform', admin: 'Admin' };

export const KONTEN_L = ['koerper', 'sozial', 'mental', 'geld', 'zeit'] as const;
export type LKonto = (typeof KONTEN_L)[number];
export const KONTO_NAME: Record<LKonto, string> = { koerper: 'Körper', sozial: 'Sozial', mental: 'Mental', geld: 'Geld', zeit: 'Zeit' };

export const BREMSEN = ['Termine', 'Energie', 'Störungen', 'Plan unklar', 'Familie', 'Nichts'] as const;

const TAG_MS = 86_400_000;
const ms = (tag: string) => Date.parse(tag + 'T00:00:00Z');
const tagAus = (t: number) => new Date(t).toISOString().slice(0, 10);
export const istTag = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && tagAus(ms(x)) === x;
export const plusTage = (tag: string, n: number) => tagAus(ms(tag) + n * TAG_MS);
export const tageZwischen = (von: string, bis: string) => Math.round((ms(bis) - ms(von)) / TAG_MS);

/** Wert eines Standards: nichts 0, Hälfte 0,8, voll 1 (Peter: „die Hälfte macht den Tag 80 % grün“). */
export const wert = (n: number) => (n <= 0 ? 0 : n === 1 ? 0.8 : 1);

export type TagEingabe = { content: number; phasen: Record<HBereich, number>; leben: boolean[]; verordnet: boolean };
export type TagBewertung = { prozent: number; zaehlt: boolean; voll: boolean; fehlt: string[] };

/**
 * Der Tag zählt, wenn jeder der sechs Standards mindestens die Hälfte hat und alle fünf Leben-Aufgaben erledigt sind
 * (Peter, 12.11.2026). Der Prozentwert ist der Schnitt der sechs Standards.
 */
export function bewerten(t: TagEingabe): TagBewertung {
  const werte = [wert(t.content), ...BEREICHE_H.map((b) => wert(t.phasen[b] ?? 0))];
  const prozent = Math.round((werte.reduce((a, b) => a + b, 0) / werte.length) * 100);
  const fehlt: string[] = [];
  if (t.content <= 0) fehlt.push('50 Content');
  for (const b of BEREICHE_H) if ((t.phasen[b] ?? 0) <= 0) fehlt.push(`1 Phase ${BEREICH_KURZ[b]}`);
  const offen = t.verordnet ? t.leben.filter((x) => !x).length : KONTEN_L.length;
  if (offen) fehlt.push(offen === 1 ? '1 Leben-Aufgabe' : `${offen} Leben-Aufgaben`);
  const zaehlt = fehlt.length === 0;
  return { prozent, zaehlt, voll: zaehlt && prozent === 100, fehlt };
}

/**
 * Welcher Tag der Saison ist heute? Joker-Tage zählen nicht mit. Vor dem Start 0.
 * Ende: der Tag, an dem 100 Tage ohne Joker erreicht sind. Jeder Joker im Zeitraum schiebt es um einen Tag.
 */
export function saisonTag(start: string, heute: string, joker: string[]): number {
  if (heute < start) return 0;
  const j = new Set(joker);
  if (j.has(heute)) return 0;
  let n = 0;
  for (let t = start; t <= heute; t = plusTage(t, 1)) if (!j.has(t)) n++;
  return n;
}
export function saisonEnde(start: string, joker: string[]): string {
  const j = new Set(joker);
  let n = 0; let t = start;
  for (let i = 0; i < TAGE + JOKER + 1; i++, t = plusTage(t, 1)) {
    if (!j.has(t)) n++;
    if (n === TAGE) return t;
  }
  return t;
}
/** Die Kalendertage der Saison ohne Joker, in Reihenfolge. Feld i ist Tag i+1. */
export function saisonKalender(start: string, joker: string[]): string[] {
  const j = new Set(joker);
  const aus: string[] = [];
  for (let t = start; aus.length < TAGE; t = plusTage(t, 1)) if (!j.has(t)) aus.push(t);
  return aus;
}

/** Darf an diesem Tag ein Joker gesetzt (oder zurückgenommen) werden? */
export function jokerErlaubt(tag: string, heute: string, minuteHeute: number, start: string, joker: string[], setzen: boolean): string | null {
  if (!istTag(tag)) return 'Ungültiger Tag.';
  if (tag < start) return 'Vor dem Start gibt es keinen Joker.';
  if (tag < heute) return 'Für vergangene Tage gibt es keinen Joker.';
  if (tag === heute && minuteHeute >= JOKER_BIS_MIN) return 'Für heute geht ein Joker nur bis 10 Uhr.';
  if (tag > saisonEnde(start, joker)) return 'Dieser Tag liegt nach dem Ende der Saison.';
  if (setzen) {
    if (joker.includes(tag)) return 'Dieser Tag ist schon ein Joker.';
    if (joker.length >= JOKER) return 'Alle zehn Joker sind vergeben.';
  } else if (!joker.includes(tag)) return 'Dieser Tag ist kein Joker.';
  return null;
}

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export type Verordnung = Record<LKonto, string>;

/** Feste Aufgaben, falls Claude nicht antwortet. Klein genug für einen miesen Tag, wechseln nach dem Saisontag. */
const ERSATZ: Record<LKonto, string[]> = {
  koerper: ['30 Liegestütze in drei Sätzen', '10 Minuten zügig spazieren', '3 Minuten Plank in Sätzen', '40 Kniebeugen in zwei Sätzen', 'Eine Portion Gemüse zum Mittag'],
  sozial: ['10 Minuten mit den Jungs, Handy in der Küche', 'Deiner Frau eine Sache sagen, die du an ihr schätzt', 'Eine Sprachnachricht an einen Freund', '10 Minuten vorlesen, Handy weg', 'Einem Menschen danken, der dir geholfen hat'],
  mental: ['5 Minuten zyklisches Seufzen', '5 Minuten Stille ohne Handy', 'Drei gute Dinge aufschreiben', '10 Minuten Spaziergang ohne Kopfhörer', 'Vor dem Schlafen 5 Minuten Atem'],
  geld: ['Eine Abbuchung vom Konto prüfen', 'Die Wochentöpfe ansehen', 'Einen Bon festhalten', 'Ein Abo prüfen, das du kaum nutzt', 'Eine offene Rechnung prüfen'],
  zeit: ['Morgen den ersten Block im Kalender setzen', 'Eine Sache auf den Parkplatz schieben', 'Den Schreibtisch für morgen leer machen', 'Eine Aufgabe abgeben oder streichen', 'Mails nach 18 Uhr zu lassen'],
};
export function ersatzVerordnung(saisonTagNr: number): Verordnung {
  const i = Math.max(0, saisonTagNr - 1);
  return Object.fromEntries(KONTEN_L.map((k) => [k, ERSATZ[k][i % ERSATZ[k].length]])) as Verordnung;
}

/** Prüft Claudes Verordnung: ein Satz pro Konto, kurz, sonst greift der Ersatz für genau dieses Konto. */
export function pruefeVerordnung(roh: unknown, saisonTagNr: number): Verordnung {
  const ersatz = ersatzVerordnung(saisonTagNr);
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const aus = { ...ersatz };
  for (const k of KONTEN_L) {
    const t = text(o[k], 90);
    if (t.length >= 5 && !/[<>{}]/.test(t)) aus[k] = t;
  }
  return aus;
}

export type RasterZelle = { tag: string; nr: number; zustand: 'voll' | 'zaehlt' | 'nicht' | 'heute' | 'offen' };
/** Zustand je Saisontag fürs Raster. Vergangene Tage ohne Werte zählen nicht. */
export function raster(kalender: string[], heute: string, bewertet: Map<string, TagBewertung>): RasterZelle[] {
  return kalender.map((tag, i) => {
    const b = bewertet.get(tag);
    const zustand = tag === heute ? (b?.zaehlt ? (b.voll ? 'voll' : 'zaehlt') : 'heute') : tag > heute ? 'offen' : b?.voll ? 'voll' : b?.zaehlt ? 'zaehlt' : 'nicht';
    return { tag, nr: i + 1, zustand };
  });
}
