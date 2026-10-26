/**
 * Standortbestimmung: drei Etappen à etwa zwölf Minuten. Jede Seite eine Frage, Peter antwortet per Antippen und in eigenen Worten.
 * Danach fasst Claude zusammen und macht Vorschläge. In den Stand kommt nur, was Peter übernimmt.
 * Rein, ohne Datenbank: Oberfläche und Server nutzen dieselben Listen, der Server prüft dagegen.
 */
import type { Antwort } from './fragen';

export const KONTEN = ['zeit', 'sozial', 'mental', 'koerper', 'geld'] as const;
export type Konto = (typeof KONTEN)[number];
export const BEREICHE = ['geschaeft', ...KONTEN] as const;
export type Bereich = (typeof BEREICHE)[number];
export const BEREICH_NAME: Record<Bereich, string> = { geschaeft: 'Geschäft', zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };

export type StandFrage =
  | { id: string; frage: string; typ: 'zahl'; konto: Konto; nachfrage: string; platzhalter: string }
  | { id: string; frage: string; typ: 'mehrfach'; optionen: string[]; max?: number; nachfrage?: string }
  | { id: string; frage: string; typ: 'text'; hilfe?: string; platzhalter: string };

export type Etappe = { nr: 1 | 2 | 3; titel: string; kurz: string; dauer: string; fragen: StandFrage[] };

const DIKTAT = 'Gern frei erzählt, das Mikrofon der Tastatur schreibt mit';

export const ETAPPEN: Etappe[] = [
  {
    nr: 1, titel: 'Wo du stehst', kurz: 'Pro Bereich eine Zahl und der Grund dahinter.', dauer: '12 Min.',
    fragen: [
      { id: 'zeit', konto: 'zeit', typ: 'zahl', frage: 'Wie sehr bestimmst du gerade selbst über deine Stunden?', nachfrage: 'Was müsste passieren, damit es zwei Punkte mehr sind?', platzhalter: DIKTAT },
      { id: 'sozial', konto: 'sozial', typ: 'zahl', frage: 'Wie verbunden fühlst du dich mit den Menschen, die dir wichtig sind?', nachfrage: 'Mit wem fehlt dir gerade echte Zeit?', platzhalter: DIKTAT },
      { id: 'mental', konto: 'mental', typ: 'zahl', frage: 'Wie klar ist dein Kopf gerade?', nachfrage: 'Was müsste passieren, damit es zwei Punkte mehr sind?', platzhalter: DIKTAT },
      { id: 'koerper', konto: 'koerper', typ: 'zahl', frage: 'Wie fit und erholt fühlst du dich?', nachfrage: 'Was hält dich gerade davon ab, dich besser zu fühlen?', platzhalter: DIKTAT },
      { id: 'geld', konto: 'geld', typ: 'zahl', frage: 'Wie entspannt bist du beim Thema Geld?', nachfrage: 'Was macht dir beim Geld gerade Sorgen, was gibt dir Ruhe?', platzhalter: DIKTAT },
    ],
  },
  {
    nr: 2, titel: 'Wohin', kurz: 'Werte, ein Jahr von heute und die nächsten zwölf Wochen.', dauer: '12 Min.',
    fragen: [
      { id: 'werte', typ: 'mehrfach', max: 3, frage: 'Welche drei Werte sollen deine Entscheidungen leiten?', nachfrage: 'Warum gerade diese drei?',
        optionen: ['Familie', 'Freiheit', 'Wirkung', 'Gesundheit', 'Wachstum', 'Verlässlichkeit', 'Mut', 'Gemeinschaft', 'Wertschätzung', 'Ruhe', 'Abenteuer', 'Sicherheit'] },
      { id: 'jahr', typ: 'text', frage: 'Es ist ein Jahr später und es lief richtig gut. Was ist anders?', hilfe: 'Privat und im Geschäft. Erzähl, was du siehst, wer dabei ist, wie sich ein normaler Dienstag anfühlt.', platzhalter: DIKTAT },
      { id: 'quartal', typ: 'text', frage: 'Was soll in den nächsten zwölf Wochen auf jeden Fall passieren?', hilfe: 'Nenn ruhig Zahlen. Drei Dinge reichen.', platzhalter: DIKTAT },
      { id: 'weglassen', typ: 'text', frage: 'Was lässt du in diesem Quartal bewusst liegen?', hilfe: 'Projekte, Ideen, Verpflichtungen. Was du hier nennst, parkt der Coach.', platzhalter: DIKTAT },
    ],
  },
  {
    nr: 3, titel: 'Was dich bremst', kurz: 'Der Coach leitet mit dir den Engpass her.', dauer: '12 Min.',
    fragen: [
      { id: 'messen', typ: 'text', frage: 'Woran merkst du, ob es im Geschäft läuft?', hilfe: 'Eine Zahl hilft: Umsatz im Monat, Gespräche, Aufträge, Nutzer.', platzhalter: DIKTAT },
      { id: 'weg', typ: 'text', frage: 'Erzähl den Weg vom ersten Kontakt bis zum bezahlten Auftrag. Wo stockt es?', hilfe: 'Von „jemand hört von uns“ bis „das Geld ist da“. Wo staut es sich, wo wartest du?', platzhalter: DIKTAT },
      { id: 'zeitfresser', typ: 'mehrfach', frage: 'Was frisst deine Zeit, ohne aufs Ziel einzuzahlen?', nachfrage: 'Ein Beispiel aus der letzten Woche',
        optionen: ['Mails', 'Termine ohne Ergebnis', 'Operatives', 'Abstimmung im Team', 'Neue Ideen', 'Bildschirm', 'Verwaltung und Buchhaltung'] },
      { id: 'zwei', typ: 'text', frage: 'Du dürftest nur noch zwei Stunden am Tag arbeiten. Was machst du in diesen zwei Stunden?', platzhalter: DIKTAT },
    ],
  },
];

export const etappe = (nr: number) => ETAPPEN.find((e) => e.nr === nr) ?? null;

/** Prüft Antworten gegen die Etappe. Unbekanntes fliegt raus, Texte werden gekürzt. Null, wenn eine Zahl fehlt. */
export function pruefeStandAntworten(nr: number, roh: unknown): Record<string, Antwort> | null {
  const e = etappe(nr); if (!e || !roh || typeof roh !== 'object') return null;
  const ein = roh as Record<string, Antwort>;
  const kurz = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  const out: Record<string, Antwort> = {};
  for (const f of e.fragen) {
    const a = ein[f.id] ?? {}; const o: Antwort = {};
    if (f.typ === 'zahl') { if (!Number.isInteger(a.wert) || a.wert! < 1 || a.wert! > 10) return null; o.wert = a.wert; }
    if (f.typ === 'mehrfach' && Array.isArray(a.auswahl)) o.auswahl = a.auswahl.filter((x) => f.optionen.includes(x)).slice(0, f.max ?? f.optionen.length);
    const t = kurz(a.text, 3000); if (t) o.text = t;
    const n = kurz(a.notiz, 1500); if (n) o.notiz = n;
    if (Object.keys(o).length) out[f.id] = o;
  }
  return out;
}

export type Vorschlag = { art: 'fokus' | 'werte' | 'jahr' | 'quartal' | 'weglassen' | 'engpass' | 'wochenziel'; text: string; bereich?: Bereich; herleitung?: string };
export type Auswertung = { zusammenfassung: string; vorschlaege: Vorschlag[] };

/** Welche Vorschläge in welcher Etappe erlaubt sind. */
export const ERLAUBT: Record<number, Vorschlag['art'][]> = { 1: ['fokus'], 2: ['werte', 'jahr', 'quartal', 'weglassen'], 3: ['engpass', 'wochenziel', 'quartal', 'weglassen'] };

/** Claude-Antwort ist unsichere Eingabe: nur bekannte Arten und Bereiche, Texte gekürzt, höchstens sechs Vorschläge. */
export function pruefeAuswertung(nr: number, roh: unknown): Auswertung {
  const r = (roh && typeof roh === 'object' ? roh : {}) as { zusammenfassung?: unknown; vorschlaege?: unknown };
  const zusammenfassung = typeof r.zusammenfassung === 'string' ? r.zusammenfassung.trim().slice(0, 600) : '';
  const erlaubt = ERLAUBT[nr] ?? [];
  const vorschlaege: Vorschlag[] = [];
  for (const v of Array.isArray(r.vorschlaege) ? r.vorschlaege : []) {
    if (!v || typeof v !== 'object') continue;
    const x = v as Record<string, unknown>;
    const art = x.art as Vorschlag['art'];
    const text = typeof x.text === 'string' ? x.text.trim().slice(0, 300) : '';
    if (!erlaubt.includes(art) || !text) continue;
    const bereich = BEREICHE.includes(x.bereich as Bereich) ? (x.bereich as Bereich) : undefined;
    if ((art === 'quartal' || art === 'fokus') && !bereich) continue;
    if (art === 'fokus' && bereich === 'geschaeft') continue;
    const herleitung = art === 'engpass' && typeof x.herleitung === 'string' ? x.herleitung.trim().slice(0, 500) : undefined;
    vorschlaege.push({ art, text, ...(bereich ? { bereich } : {}), ...(herleitung ? { herleitung } : {}) });
    if (vorschlaege.length >= 6) break;
  }
  return { zusammenfassung, vorschlaege };
}

export type Stand = {
  baseline?: { tag: string; werte: Partial<Record<Konto, number>>; gruende: Partial<Record<Konto, string>> };
  verlauf?: { tag: string; werte: Partial<Record<Konto, number>> }[];
  fokus?: { bereich: Konto; text: string };
  werte?: string; jahr?: string; weglassen?: string; herleitung?: string;
  quartal?: { bereich: Bereich; text: string; seit: string }[];
  etappen?: Partial<Record<'1' | '2' | '3', string>>;
};

export function standAus(roh: string): Stand {
  try { const s = JSON.parse(roh || '{}'); return s && typeof s === 'object' ? s : {}; } catch { return {}; }
}

/** Baseline aus den Zahlen der ersten Etappe. Die alte Baseline wandert in den Verlauf, damit Life später vergleichen kann. */
export function baselineSetzen(s: Stand, antworten: Record<string, Antwort>, tag: string): Stand {
  const werte: Partial<Record<Konto, number>> = {}; const gruende: Partial<Record<Konto, string>> = {};
  for (const k of KONTEN) {
    const a = antworten[k]; if (!a) continue;
    if (a.wert !== undefined) werte[k] = a.wert;
    const g = [a.text, a.notiz].filter(Boolean).join(' ').slice(0, 300); if (g) gruende[k] = g;
  }
  const verlauf = [...(s.verlauf ?? [])];
  if (s.baseline && s.baseline.tag !== tag) verlauf.push({ tag: s.baseline.tag, werte: s.baseline.werte });
  return { ...s, baseline: { tag, werte, gruende }, verlauf: verlauf.slice(-8) };
}

/** Übernimmt einen Vorschlag in den Stand. Engpass und Wochenziel liegen woanders und gibt die Funktion zurück. */
export function uebernehmen(s: Stand, v: Vorschlag, tag: string): Stand {
  if (v.art === 'fokus' && v.bereich && v.bereich !== 'geschaeft') return { ...s, fokus: { bereich: v.bereich, text: v.text } };
  if (v.art === 'werte') return { ...s, werte: v.text };
  if (v.art === 'jahr') return { ...s, jahr: v.text };
  if (v.art === 'weglassen') return { ...s, weglassen: v.text };
  if (v.art === 'engpass') return { ...s, herleitung: v.herleitung ?? s.herleitung };
  if (v.art === 'quartal' && v.bereich) {
    // Ein Ziel pro Bereich: ein neues ersetzt das alte
    const q = (s.quartal ?? []).filter((x) => x.bereich !== v.bereich);
    return { ...s, quartal: [...q, { bereich: v.bereich, text: v.text, seit: tag }].slice(-6) };
  }
  return s;
}

/** Zeilen für Coach und Sortierlauf. Kein Datum: nur „seit n Wochen“. */
export function standZeilen(s: Stand, heute: string, wochenziel = ''): string[] {
  const wochen = (tag: string) => Math.max(0, Math.round((Date.parse(heute) - Date.parse(tag)) / (7 * 864e5)));
  const b = s.baseline;
  return [
    b ? `Selbsteinschätzung von Peter (1 bis 10, vor ${wochen(b.tag)} Wochen): ` + KONTEN.filter((k) => b.werte[k] !== undefined).map((k) => `${BEREICH_NAME[k]} ${b.werte[k]}${b.gruende[k] ? ` (${b.gruende[k]})` : ''}`).join('; ') : '',
    s.fokus ? `Persönlicher Fokus: ${BEREICH_NAME[s.fokus.bereich]}. ${s.fokus.text}` : '',
    s.werte ? `Werte: ${s.werte}` : '',
    s.jahr ? `Bild in einem Jahr: ${s.jahr}` : '',
    s.quartal?.length ? 'Ziele für die zwölf Wochen:\n' + s.quartal.map((q) => `- ${BEREICH_NAME[q.bereich]}: ${q.text}`).join('\n') : '',
    s.weglassen ? `Bewusst liegen lassen in diesem Quartal: ${s.weglassen}` : '',
    s.herleitung ? `Herleitung des Engpasses: ${s.herleitung}` : '',
    wochenziel ? `Wochenziel: ${wochenziel}` : '',
  ].filter(Boolean);
}

/** Welche Etappe als Nächstes dran ist, oder null, wenn alle drei erledigt sind. */
export function naechsteEtappe(s: Stand): 1 | 2 | 3 | null {
  for (const n of [1, 2, 3] as const) if (!s.etappen?.[String(n) as '1']) return n;
  return null;
}
