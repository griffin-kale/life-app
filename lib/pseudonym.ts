/**
 * Pseudonymisierung vor jedem Aufruf von Claude.
 * Bekannte Namen von Personen, Firmen und Orten werden zu Platzhaltern wie [Person 1],
 * E-Mail-Adressen, Telefonnummern und IBANs zu [E-Mail 1], [Telefon 1], [IBAN 1].
 * Die Antwort von Claude bekommt die echten Namen zurück. Rein, ohne Datenbank, damit testbar.
 */

export type Art = 'Person' | 'Firma' | 'Ort';
export type Name = { name: string; art: Art };
export type Zuordnung = Map<string, string>; // Platzhalter -> Original

const ART: Record<string, Art> = { person: 'Person', firma: 'Firma', ort: 'Ort' };

/** Liest Zeilen wie „Carlotta“, „Firma: KGSt“, „Ort: Oldenburg“ oder „Carlotta: Fachbereiche“ (Teamliste). */
export function namenAus(text: string, standard: Art = 'Person'): Name[] {
  const out: Name[] = [];
  for (const raw of text.split('\n')) {
    const z = raw.replace(/^[-•*\s]+/, '').trim();
    if (!z) continue;
    const m = z.match(/^(person|firma|ort)\s*:\s*(.+)$/i);
    if (m) { out.push({ name: m[2].trim(), art: ART[m[1].toLowerCase()] }); continue; }
    // Teamliste: „Name: wofür“ – nur der Name zählt
    const name = z.split(':')[0].trim();
    if (name) out.push({ name, art: standard });
  }
  return out.filter((n) => n.name.length >= 2 && n.name.length <= 80);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MUSTER: { art: string; re: RegExp }[] = [
  { art: 'E-Mail', re: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu },
  { art: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g },
  { art: 'Telefon', re: /(?<![\p{L}\p{N}])(?:\+\d{1,3}[ /-]?|0)\d{2,5}[ /-]?\d{3,}(?:[ -]?\d{2,})*(?![\p{L}\p{N}])/gu },
];

/** Ersetzt Namen und Kennungen. Längere Namen zuerst, damit „Jonas Weber“ vor „Jonas“ greift. */
export function maskieren(text: string, namen: Name[], z: Zuordnung = new Map()): { text: string; zuordnung: Zuordnung } {
  const rueck = new Map<string, string>(); // Original (klein) -> Platzhalter
  for (const [p, o] of z) rueck.set(o.toLowerCase(), p);
  const zaehler = new Map<string, number>();
  for (const p of z.keys()) { const m = p.match(/^\[(.+) (\d+)\]$/); if (m) zaehler.set(m[1], Math.max(zaehler.get(m[1]) ?? 0, Number(m[2]))); }
  const platz = (art: string, original: string) => {
    const k = original.toLowerCase();
    const da = rueck.get(k); if (da) return da;
    const n = (zaehler.get(art) ?? 0) + 1; zaehler.set(art, n);
    const p = `[${art} ${n}]`; z.set(p, original); rueck.set(k, p);
    return p;
  };
  let t = text;
  for (const { art, re } of MUSTER) t = t.replace(re, (m) => platz(art, m));
  const sortiert = [...namen].sort((a, b) => b.name.length - a.name.length);
  for (const n of sortiert) {
    // Wortgrenzen auch für Umlaute; Genitiv-s und Bindestrich-Wörter bleiben erkennbar („Carlottas“, „KGSt-Angebot“)
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(n.name)}(?=s?(?![\\p{L}\\p{N}]))`, 'giu');
    t = t.replace(re, (m) => platz(n.art, m.length === n.name.length ? n.name : m));
  }
  return { text: t, zuordnung: z };
}

/** Setzt die Originale wieder ein, auch tief in Objekten und Listen aus der JSON-Antwort. */
export function zurueck<T>(wert: T, z: Zuordnung): T {
  if (!z.size) return wert;
  const re = /\[(Person|Firma|Ort|E-Mail|Telefon|IBAN) (\d+)\]/g;
  const fix = (s: string) => s.replace(re, (m) => z.get(m) ?? m);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(wert) as T;
}
