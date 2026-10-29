/**
 * Saison (Life 2.0, Phase 2, Peter 29.10.2026): zwölf Wochen, höchstens ein Ziel pro Bereich, je bis zu drei Hebel,
 * ein Wenn-dann-Plan pro Ziel. Reine Regeln ohne Datenbank, damit die Einheitstests sie direkt prüfen.
 * Datumswerte sind Kalendertage 'JJJJ-MM-TT' in Berlin, gerechnet wird in UTC ohne Uhrzeit.
 */

export const BEREICHE_S = ['geschaeft', 'zeit', 'koerper', 'mental', 'sozial', 'geld'] as const;
export type SBereich = (typeof BEREICHE_S)[number];
export const BEREICH_TITEL: Record<SBereich, string> = { geschaeft: 'Geschäft', zeit: 'Zeit', koerper: 'Körper', mental: 'Ruhe und Geist', sozial: 'Menschen', geld: 'Geld' };

/** Feste Vorschläge, damit jeder Bereich ohne Tippen geht. Eigene Worte gehen immer. */
export const ZIEL_IDEEN: Record<SBereich, string[]> = {
  geschaeft: [],
  zeit: ['Zwei Fokusblöcke pro Tag', 'Abends ab 18 Uhr ohne Mails'],
  koerper: ['Dreimal pro Woche Kraft', 'Jeden Tag 8000 Schritte'],
  mental: ['Jeden Tag fünf Minuten Ruhe', 'Vor 23 Uhr im Bett'],
  sozial: ['Einmal im Monat ein Abend mit Freunden', 'Jede Woche ein Anruf bei der Familie'],
  geld: ['Puffer für sechs Monate aufbauen', 'Jede Woche die Töpfe prüfen'],
};

export const HINDERNISSE = ['Der Tag wird zu voll', 'Etwas Dringendes kommt dazwischen', 'Ich bin müde oder krank', 'Keine Lust'] as const;
/** Dieselben Hindernisse als Nebensatz, damit der Wenn-dann-Satz richtiges Deutsch ist. */
const WENN_SATZ: Record<string, string> = {
  'Der Tag wird zu voll': 'der Tag zu voll wird',
  'Etwas Dringendes kommt dazwischen': 'etwas Dringendes dazwischenkommt',
  'Ich bin müde oder krank': 'ich müde oder krank bin',
  'Keine Lust': 'ich keine Lust habe',
};
export const HEBEL_ARTEN = ['kalender', 'ritual'] as const;
export type HebelArt = (typeof HEBEL_ARTEN)[number];
export const BEWERTUNGEN = ['kurs', 'anpassen', 'daneben'] as const;
export type Bewertung = (typeof BEWERTUNGEN)[number];

export const WOCHEN = 12;
const TAG_MS = 86_400_000;

const ms = (tag: string) => Date.parse(tag + 'T00:00:00Z');
const tagAus = (t: number) => new Date(t).toISOString().slice(0, 10);
export const istTag = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && tagAus(ms(x)) === x;
export const plusTage = (tag: string, n: number) => tagAus(ms(tag) + n * TAG_MS);
export const tageZwischen = (von: string, bis: string) => Math.round((ms(bis) - ms(von)) / TAG_MS);
/** 0 = Sonntag … 6 = Samstag, für einen Kalendertag ohne Zeitzone. */
export const wochentag = (tag: string) => new Date(ms(tag)).getUTCDay();

/** Der nächste Montag, heute eingeschlossen. Vorschlag für den Start einer Saison. */
export function naechsterMontag(heute: string): string {
  const wt = wochentag(heute);
  return plusTage(heute, wt === 1 ? 0 : (8 - wt) % 7);
}
/** Letzter Tag der Saison: der Sonntag der zwölften Woche. */
export const saisonEnde = (start: string) => plusTage(start, WOCHEN * 7 - 1);

/** Woche 1 bis 12 der Saison. 0 vor dem Start, 13 nach dem Ende. */
export function saisonWoche(start: string, heute: string): number {
  const d = tageZwischen(start, heute);
  if (d < 0) return 0;
  return Math.min(WOCHEN + 1, Math.floor(d / 7) + 1);
}

/** Name nach der Mitte der Saison: 2. November bis 24. Januar heißt Winter. */
export function saisonName(start: string): string {
  const m = new Date(ms(plusTage(start, 41))).getUTCMonth();
  return m === 11 || m <= 1 ? 'Winter' : m <= 4 ? 'Frühling' : m <= 7 ? 'Sommer' : 'Herbst';
}

export type HebelEingabe = { titel: string; art: HebelArt };
export type ZielEingabe = { bereich: SBereich; titel: string; zielwert: number | null; hebel: HebelEingabe[]; wenn: string; dann: string };
export type SaisonEingabe = { start: string; leitsatz: string; ziele: ZielEingabe[] };

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Prüft eine neue Saison aus dem Blatt. Was nicht passt, fällt raus oder wird gekürzt.
 * Fehler nur, wenn die Saison so nicht sinnvoll ist: kein Montag, zu weit weg, kein einziges Ziel.
 */
export function pruefeSaison(roh: unknown, heute: string): { ok: true; wert: SaisonEingabe } | { ok: false; fehler: string } {
  const b = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const start = b.start;
  if (!istTag(start) || wochentag(start) !== 1) return { ok: false, fehler: 'Eine Saison beginnt an einem Montag.' };
  const abstand = tageZwischen(heute, start);
  if (abstand < -14 || abstand > 56) return { ok: false, fehler: 'Der Start liegt zu weit weg. Wähle einen Montag in den nächsten acht Wochen.' };
  const gesehen = new Set<SBereich>();
  const ziele: ZielEingabe[] = [];
  for (const z of Array.isArray(b.ziele) ? b.ziele : []) {
    const o = (z && typeof z === 'object' ? z : {}) as Record<string, unknown>;
    const bereich = o.bereich as SBereich;
    const titel = text(o.titel, 80);
    if (!BEREICHE_S.includes(bereich) || gesehen.has(bereich) || titel.length < 3) continue;
    gesehen.add(bereich);
    const zw = Number(o.zielwert);
    const hebel: HebelEingabe[] = [];
    for (const h of Array.isArray(o.hebel) ? o.hebel : []) {
      const ho = (h && typeof h === 'object' ? h : {}) as Record<string, unknown>;
      const ht = text(ho.titel, 80);
      if (ht.length < 3 || hebel.some((x) => x.titel.toLowerCase() === ht.toLowerCase())) continue;
      hebel.push({ titel: ht, art: HEBEL_ARTEN.includes(ho.art as HebelArt) ? (ho.art as HebelArt) : 'kalender' });
      if (hebel.length === 3) break;
    }
    ziele.push({ bereich, titel, zielwert: Number.isInteger(zw) && zw > 0 && zw <= 100_000 ? zw : null, hebel, wenn: text(o.wenn, 120), dann: text(o.dann, 160) });
  }
  if (!ziele.length) return { ok: false, fehler: 'Wähle mindestens ein Ziel.' };
  ziele.sort((a, c) => BEREICHE_S.indexOf(a.bereich) - BEREICHE_S.indexOf(c.bereich));
  return { ok: true, wert: { start, leitsatz: text(b.leitsatz, 160), ziele } };
}

/** Der Wenn-dann-Satz für Karte und Coach. Leer, solange eine Hälfte fehlt. */
export function wennDannSatz(wenn: string, dann: string): string {
  if (!wenn.trim() || !dann.trim()) return '';
  const w = WENN_SATZ[wenn.trim()] ?? wenn.trim().replace(/^wenn\s+/i, '');
  const d = dann.trim().replace(/\.$/, '').replace(/^dann\s+/i, '');
  return `Wenn ${w.charAt(0).toLowerCase()}${w.slice(1)}, dann ${d.charAt(0).toLowerCase()}${d.slice(1)}.`;
}

export type Vorschlag = { bereich: SBereich | null; text: string };
/**
 * Vorschläge für das Blatt: die zwölf Wochen aus „Dein Stand“ (mit Bereich) und die bisherige Zielliste (ohne Bereich).
 * Doppelte fallen raus, die Stand-Ziele gewinnen.
 */
export function vorschlaegeAus(quartal: { bereich: string; text: string }[], alteListe: string[]): Vorschlag[] {
  const aus: Vorschlag[] = [];
  const da = new Set<string>();
  for (const q of quartal) {
    const t = text(q.text, 80); const k = t.toLowerCase();
    if (t.length < 3 || da.has(k)) continue;
    da.add(k); aus.push({ bereich: BEREICHE_S.includes(q.bereich as SBereich) ? (q.bereich as SBereich) : null, text: t });
  }
  for (const z of alteListe) {
    const t = text(z, 80); const k = t.toLowerCase();
    if (t.length < 3 || da.has(k)) continue;
    da.add(k); aus.push({ bereich: null, text: t });
  }
  return aus;
}

/** Prüft Claudes Hebel-Vorschläge gegen die angefragten Ziele. Höchstens drei Hebel und ein Dann-Satz pro Ziel. */
export function pruefeHebelVorschlaege(roh: unknown, bereiche: SBereich[]): Record<string, { hebel: string[]; dann: string }> {
  const aus: Record<string, { hebel: string[]; dann: string }> = {};
  const liste = (roh && typeof roh === 'object' && Array.isArray((roh as { ziele?: unknown }).ziele)) ? (roh as { ziele: unknown[] }).ziele : [];
  for (const z of liste) {
    const o = (z && typeof z === 'object' ? z : {}) as Record<string, unknown>;
    const b = o.bereich as SBereich;
    if (!bereiche.includes(b) || aus[b]) continue;
    const hebel = (Array.isArray(o.hebel) ? o.hebel : []).map((h) => text(h, 80)).filter((h) => h.length >= 3).slice(0, 3);
    aus[b] = { hebel, dann: text(o.dann, 160) };
  }
  return aus;
}

/** Fortschritt eines Ziels: mit Zielwert der Stand, sonst null (dann zählen die Hebel). */
export function zielAnteil(stand: number, zielwert: number | null): number | null {
  if (!zielwert) return null;
  return Math.max(0, Math.min(1, stand / zielwert));
}

/** Liegt der Stand im Plan? Verglichen mit dem Anteil der verstrichenen Saison. */
export function imPlan(stand: number, zielwert: number | null, woche: number): 'voraus' | 'im Plan' | 'dahinter' | null {
  const a = zielAnteil(stand, zielwert);
  if (a === null || woche < 1) return null;
  const soll = Math.min(1, woche / WOCHEN);
  return a >= soll + 0.1 ? 'voraus' : a >= soll - 0.15 ? 'im Plan' : 'dahinter';
}
