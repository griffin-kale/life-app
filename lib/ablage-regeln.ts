/**
 * Regeln für die Ablage (0.30, Peter 31.10.2026): ein verborgener, Ende-zu-Ende verschlüsselter Bereich.
 * Ein zufälliger Inhaltsschlüssel verschlüsselt alle Blöcke. Er liegt zweimal eingepackt auf dem Server:
 * mit der Passphrase (PBKDF2-SHA-256) und mit dem Wiederherstellungsschlüssel. Alles passiert im Browser.
 * Der Server prüft nur die Form. Rein, ohne Datenbank, damit testbar.
 */
export const ITERATIONEN = 600_000; // OWASP-Empfehlung für PBKDF2-HMAC-SHA-256
export const PASSPHRASE_MIN = 12;
export const BLOCK_MAX = 96_000; // Base64-Zeichen, etwa 70 KB Klartext
export const EINTRAEGE_MAX = 2000;
export const LEERLAUF_MIN = 2;

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Ein verschlüsselter Block: Base64 aus 12 Byte IV, Geheimtext und 16 Byte Prüfsumme. */
export function blockOk(b: unknown): b is string {
  return typeof b === 'string' && b.length >= 40 && b.length <= BLOCK_MAX && b.length % 4 === 0 && B64.test(b);
}
/** Salz: genau 16 Byte als Base64. */
export function salzOk(s: unknown): s is string {
  return typeof s === 'string' && s.length === 24 && B64.test(s);
}
export function iterationenOk(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= ITERATIONEN && (n as number) <= 5_000_000;
}
/** Eine Passphrase taugt, wenn sie lang genug ist und nicht nur aus wenigen Zeichen besteht. */
export function passphraseOk(p: string): boolean {
  return p.length >= PASSPHRASE_MIN && new Set(p).size >= 5;
}

/** Wiederherstellungsschlüssel: 32 Zufallsbytes als Crockford-Base32 in Vierergruppen, zum Ausdrucken. */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function wiederText(roh: Uint8Array): string {
  let bits = 0, wert = 0, aus = '';
  for (const b of roh) { wert = (wert << 8) | b; bits += 8; while (bits >= 5) { aus += ALPHA[(wert >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) aus += ALPHA[(wert << (5 - bits)) & 31];
  return aus.match(/.{1,4}/g)!.join('-');
}
/** Liest einen getippten Schlüssel zurück. Verwechselbare Zeichen (O, I, L) gelten als 0 und 1. null, wenn er nicht passt. */
export function wiederAusText(t: string): Uint8Array | null {
  const s = t.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 52 || [...s].some((c) => !ALPHA.includes(c))) return null;
  const aus: number[] = []; let bits = 0, wert = 0;
  for (const c of s) { wert = ((wert << 5) | ALPHA.indexOf(c)) & 0xffff; bits += 5; if (bits >= 8) { aus.push((wert >>> (bits - 8)) & 255); bits -= 8; } }
  return aus.length === 32 ? Uint8Array.from(aus) : null;
}
