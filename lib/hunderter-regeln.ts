/**
 * Challenge, das tägliche Format der Saison (seit 0.33, MAYA, Peter 23.11.2026). Entstanden als „Die Hunderter“ (0.32, Peter 12.11.2026):
 * eine feste Zahl Tage mit täglichen Standards, fünf verordneten Leben-Aufgaben und Jokern, die hinten anhängen.
 * Länge, Name und Standards sind seit 0.33 pro Challenge einstellbar. Ohne Angaben gilt der Stand der Hunderter.
 * Intern heißen Tabellen und Dateien weiter „hunderter“. Reine Regeln ohne Datenbank, damit die Einheitstests sie direkt prüfen.
 * Datumswerte sind Kalendertage 'JJJJ-MM-TT' in Berlin, gerechnet wird in UTC ohne Uhrzeit.
 */

export const TAGE = 100;
export const JOKER = 10;
/** Für den laufenden Tag gibt es einen Joker nur bis 10 Uhr, damit er keine Ausrede am Abend wird (Peter, 12.11.2026). */
export const JOKER_BIS_MIN = 10 * 60;
/** Ab so vielen Minuten zählt ein Fokusblock als Phase (50 + 10, ein paar Minuten Kulanz). */
export const PHASE_MIN = 45;

/** Längen zur Wahl (66 Tage: so lange brauchte eine Gewohnheit im Schnitt bei Lally u. a. 2010). Joker: ein Zehntel, mindestens drei. */
export const LAENGEN = [30, 66, 100] as const;
export const jokerFuer = (tage: number) => Math.max(3, Math.round(tage / 10));

/** Wie ein Standard zählt: „fokus“ über Fokusblöcke ab 45 Minuten (Tipp startet Fokus), „haken“ von Hand (Tipp zählt halb, voll, leer). */
export const ARTEN = ['fokus', 'haken'] as const;
export type StandardArt = (typeof ARTEN)[number];
export type Standard = { key: string; name: string; kurz: string; art: StandardArt };
export const MAX_STANDARDS = 6;

/** Die Standards der ersten Hunderter. Gelten für jede Challenge ohne eigene Liste, also für Peters laufende. */
export const BEREICHE_H = ['shop', 'mail', 'foerderung', 'plattform', 'admin'] as const;
export type HBereich = (typeof BEREICHE_H)[number];
export const BEREICH_NAME: Record<HBereich, string> = {
  shop: 'Shop', mail: 'Mail und Briefe', foerderung: 'Förderung', plattform: 'Plattform', admin: 'Admin und System',
};
export const BEREICH_KURZ: Record<HBereich, string> = { shop: 'Shop', mail: 'Mail', foerderung: 'Förderung', plattform: 'Plattform', admin: 'Admin' };
export const STANDARDS_START: Standard[] = [
  { key: 'content', name: 'Content', kurz: 'Content', art: 'haken' },
  ...BEREICHE_H.map((b) => ({ key: b, name: BEREICH_NAME[b], kurz: BEREICH_KURZ[b], art: 'fokus' as const })),
];

export type Format = { name: string; tage: number; joker: number; standards: Standard[] };
export const FORMAT_START: Format = { name: 'Die Hunderter', tage: TAGE, joker: JOKER, standards: STANDARDS_START };

const KEY = /^[a-z][a-z0-9]{0,11}$/;
const einText = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Liest ein gespeichertes Format. Fehlt etwas oder passt es nicht, gilt der Stand der ersten Hunderter. */
export function formatAus(z: { name?: unknown; tage?: unknown; joker?: unknown; standards?: unknown }): Format {
  const tage = (LAENGEN as readonly number[]).includes(Number(z.tage)) ? Number(z.tage) : TAGE;
  const joker = z.joker != null && Number.isInteger(Number(z.joker)) && Number(z.joker) >= 0 && Number(z.joker) <= 20 ? Number(z.joker) : JOKER;
  const p = Array.isArray(z.standards) ? pruefeStandards(z.standards) : null;
  return { name: einText(z.name, 40) || FORMAT_START.name, tage, joker, standards: p && typeof p !== 'string' ? p : STANDARDS_START };
}

/** Prüft Standards aus dem Browser: 1 bis 6, Namen 2 bis 24 Zeichen, keine doppelt, Art aus der festen Liste. Gibt einen Fehlertext oder die Liste. */
export function pruefeStandards(roh: unknown[]): Standard[] | string {
  if (!roh.length || roh.length > MAX_STANDARDS) return `Eine Challenge hat 1 bis ${MAX_STANDARDS} Standards.`;
  const aus: Standard[] = [];
  for (const [i, x] of roh.entries()) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const name = einText(o.name, 24);
    if (name.length < 2 || /[<>{}]/.test(name)) return 'Jeder Standard braucht einen Namen.';
    if (aus.some((s) => s.name.toLowerCase() === name.toLowerCase())) return 'Zwei Standards heißen gleich.';
    const art = (ARTEN as readonly string[]).includes(o.art as string) ? (o.art as StandardArt) : 'fokus';
    const key = typeof o.key === 'string' && KEY.test(o.key) && !aus.some((s) => s.key === o.key) ? o.key : `s${i + 1}`;
    if (aus.some((s) => s.key === key)) return 'Zwei Standards heißen gleich.';
    aus.push({ key, name, kurz: einText(o.kurz, 12) || name.split(' ')[0].slice(0, 12), art });
  }
  return aus;
}

/** Prüft eine neue Challenge aus dem Browser. */
export function pruefeFormat(roh: unknown): Format | string {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const name = einText(o.name, 40);
  if (name.length < 2 || /[<>{}]/.test(name)) return 'Gib der Challenge einen Namen.';
  const tage = Number(o.tage);
  if (!(LAENGEN as readonly number[]).includes(tage)) return 'Diese Länge gibt es nicht.';
  const st = pruefeStandards(Array.isArray(o.standards) ? o.standards : []);
  if (typeof st === 'string') return st;
  return { name, tage, joker: jokerFuer(tage), standards: st };
}

/**
 * Die fünf Leben-Aufgaben, je eine pro Lebensbereich. Die Schlüssel bleiben die alten (sozial, mental).
 * Namen wie in lib/bereiche.ts, ohne Import, damit die Unit-Tests die Datei direkt laden; tests/unit/bereiche.test.ts prüft die Gleichheit.
 */
export const KONTEN_L = ['koerper', 'mental', 'sozial', 'geld', 'zeit'] as const;
export type LKonto = (typeof KONTEN_L)[number];
export const KONTO_NAME: Record<LKonto, string> = { koerper: 'Körper', mental: 'Ruhe', sozial: 'Menschen', geld: 'Geld', zeit: 'Zeit' };

export const BREMSEN = ['Termine', 'Energie', 'Störungen', 'Plan unklar', 'Familie', 'Nichts'] as const;

const TAG_MS = 86_400_000;
const ms = (tag: string) => Date.parse(tag + 'T00:00:00Z');
const tagAus = (t: number) => new Date(t).toISOString().slice(0, 10);
export const istTag = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && tagAus(ms(x)) === x;
export const plusTage = (tag: string, n: number) => tagAus(ms(tag) + n * TAG_MS);
export const tageZwischen = (von: string, bis: string) => Math.round((ms(bis) - ms(von)) / TAG_MS);

/** Wert eines Standards: nichts 0, Hälfte 0,8, voll 1 (Peter: „die Hälfte macht den Tag 80 % grün“). */
export const wert = (n: number): number => (n <= 0 ? 0 : n === 1 ? 0.8 : 1);

/** Werte eines Tages pro Standard (0 leer, 1 Hälfte, 2 voll und mehr) und die Leben-Aufgaben. */
export type TagEingabe = { werte: Record<string, number>; leben: boolean[]; verordnet: boolean };
export type TagBewertung = { prozent: number; zaehlt: boolean; voll: boolean; fehlt: string[] };

/**
 * Der Tag zählt, wenn jeder Standard mindestens die Hälfte hat und alle fünf Leben-Aufgaben erledigt sind
 * (Peter, 12.11.2026). Der Prozentwert ist der Schnitt der Standards.
 */
export function bewerten(t: TagEingabe, standards: Standard[] = STANDARDS_START): TagBewertung {
  const werte = standards.map((s) => wert(t.werte[s.key] ?? 0));
  const prozent = werte.length ? Math.round((werte.reduce((a, b) => a + b, 0) / werte.length) * 100) : 0;
  const fehlt: string[] = [];
  for (const s of standards) {
    if ((t.werte[s.key] ?? 0) > 0) continue;
    fehlt.push(s.key === 'content' ? '50 Content' : s.art === 'fokus' ? `1 Phase ${s.kurz}` : `Hälfte ${s.kurz}`);
  }
  const offen = t.verordnet ? t.leben.filter((x) => !x).length : KONTEN_L.length;
  if (offen) fehlt.push(offen === 1 ? '1 Leben-Aufgabe' : `${offen} Leben-Aufgaben`);
  const zaehlt = fehlt.length === 0;
  return { prozent, zaehlt, voll: zaehlt && prozent === 100, fehlt };
}

/**
 * Welcher Tag der Saison ist heute? Joker-Tage zählen nicht mit. Vor dem Start 0.
 * Ende: der Tag, an dem alle Tage ohne Joker erreicht sind. Jeder Joker im Zeitraum schiebt es um einen Tag.
 */
export function saisonTag(start: string, heute: string, joker: string[]): number {
  if (heute < start) return 0;
  const j = new Set(joker);
  if (j.has(heute)) return 0;
  let n = 0;
  for (let t = start; t <= heute; t = plusTage(t, 1)) if (!j.has(t)) n++;
  return n;
}
export function saisonEnde(start: string, joker: string[], tage = TAGE): string {
  const j = new Set(joker);
  let n = 0; let t = start;
  for (let i = 0; i < tage + joker.length + 1; i++, t = plusTage(t, 1)) {
    if (!j.has(t)) n++;
    if (n === tage) return t;
  }
  return t;
}
/** Die Kalendertage der Saison ohne Joker, in Reihenfolge. Feld i ist Tag i+1. */
export function saisonKalender(start: string, joker: string[], tage = TAGE): string[] {
  const j = new Set(joker);
  const aus: string[] = [];
  for (let t = start; aus.length < tage; t = plusTage(t, 1)) if (!j.has(t)) aus.push(t);
  return aus;
}

/** Darf an diesem Tag ein Joker gesetzt (oder zurückgenommen) werden? */
export function jokerErlaubt(tag: string, heute: string, minuteHeute: number, start: string, joker: string[], setzen: boolean, max = JOKER, tage = TAGE): string | null {
  if (!istTag(tag)) return 'Ungültiger Tag.';
  if (tag < start) return 'Vor dem Start gibt es keinen Joker.';
  if (tag < heute) return 'Für vergangene Tage gibt es keinen Joker.';
  if (tag === heute && minuteHeute >= JOKER_BIS_MIN) return 'Für heute geht ein Joker nur bis 10 Uhr.';
  if (tag > saisonEnde(start, joker, tage)) return 'Dieser Tag liegt nach dem Ende der Saison.';
  if (setzen) {
    if (joker.includes(tag)) return 'Dieser Tag ist schon ein Joker.';
    if (joker.length >= max) return max === 10 ? 'Alle zehn Joker sind vergeben.' : `Alle ${max} Joker sind vergeben.`;
  } else if (!joker.includes(tag)) return 'Dieser Tag ist kein Joker.';
  return null;
}

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export type Verordnung = Record<LKonto, string>;

/** Feste Aufgaben, falls Claude nicht antwortet. Klein genug für einen miesen Tag, wechseln nach dem Saisontag. */
const ERSATZ: Record<LKonto, string[]> = {
  koerper: ['30 Liegestütze in drei Sätzen', '10 Minuten zügig spazieren', '3 Minuten Plank in Sätzen', '40 Kniebeugen in zwei Sätzen', 'Eine Portion Gemüse zum Mittag'],
  sozial: ['10 Minuten mit deinen Liebsten, Handy in der Küche', 'Einem Menschen sagen, was du an ihm schätzt', 'Eine Sprachnachricht an einen Freund', '10 Minuten vorlesen oder zuhören, Handy weg', 'Einem Menschen danken, der dir geholfen hat'],
  mental: ['5 Minuten zyklisches Seufzen', '5 Minuten Stille ohne Handy', 'Drei gute Dinge aufschreiben', '10 Minuten Spaziergang ohne Kopfhörer', 'Vor dem Schlafen 5 Minuten Atem'],
  geld: ['Eine Abbuchung vom Konto prüfen', 'Die Wochentöpfe ansehen', 'Einen Bon festhalten', 'Ein Abo prüfen, das du kaum nutzt', 'Eine offene Rechnung prüfen'],
  zeit: ['Morgen den ersten Block im Kalender setzen', 'Eine Sache auf Irgendwann schieben', 'Den Schreibtisch für morgen leer machen', 'Eine Aufgabe abgeben oder streichen', 'Mails nach 18 Uhr zu lassen'],
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
