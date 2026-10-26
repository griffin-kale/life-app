import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Passwörter mit scrypt (N=2^15, r=8, p=1), Format: scrypt$N$r$p$salt$hash (base64). */
const N = 2 ** 15, R = 8, P = 1, LEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export function hashPasswort(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw.normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), h.toString('base64')].join('$');
}

export function pruefePasswort(pw: string, gespeichert: string | null): boolean {
  // Ohne gespeichertes Passwort trotzdem rechnen, damit die Antwortzeit nichts verrät
  const teile = (gespeichert ?? '').split('$');
  const ok = teile.length === 6 && teile[0] === 'scrypt';
  const salt = ok ? Buffer.from(teile[4], 'base64') : randomBytes(16);
  const soll = ok ? Buffer.from(teile[5], 'base64') : randomBytes(LEN);
  const n = ok ? Number(teile[1]) : N, r = ok ? Number(teile[2]) : R, p = ok ? Number(teile[3]) : P;
  const ist = scryptSync(pw.normalize('NFKC'), salt, soll.length, { N: n, r, p, maxmem: MAXMEM });
  return timingSafeEqual(ist, soll) && ok;
}

/**
 * Verschlüsselt kleine Geheimnisse (TOTP-Schlüssel, WHOOP-Tokens, Push-Schlüssel) für die Datenbank mit AES-256-GCM.
 * Jeder Zweck hat einen eigenen Schlüssel. v1: Schlüssel aus SESSION_SECRET (bis 0.15), v2: aus ENCRYPTION_KEY (ab 0.16).
 * Welcher Schlüssel gilt, entscheiden `zuschliessen` und `aufschliessen` unten.
 */
export type Fassung = 'v1' | 'v2';
function schluessel(geheim: string, zweck: string, v: Fassung): Buffer {
  return createHash('sha256').update(`life-${zweck}-${v}:` + geheim).digest();
}
export function verschluesseln(text: string, geheim: string, zweck = 'totp', v: Fassung = 'v1'): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluessel(geheim, zweck, v), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [v, iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
export function fassung(box: string): Fassung | null {
  const v = box.split('.')[0];
  return v === 'v1' || v === 'v2' ? v : null;
}
export function entschluesseln(box: string, geheim: string, zweck = 'totp'): string {
  const [, iv, tag, enc] = box.split('.');
  const v = fassung(box);
  if (!v) throw new Error('Unbekanntes Format');
  const d = createDecipheriv('aes-256-gcm', schluessel(geheim, zweck, v), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

/**
 * Schlüssel für gespeicherte Geheimnisse (Einmal-Code, WHOOP, Push).
 * Ab 0.16 eigener ENCRYPTION_KEY, damit ein Wechsel von SESSION_SECRET nur Sitzungen beendet und nichts unlesbar macht.
 * Ohne ENCRYPTION_KEY läuft alles weiter wie bisher mit SESSION_SECRET (v1). Mit ENCRYPTION_KEY wird neu als v2 geschrieben,
 * und `umschluesseln` in lib/tresor.ts hebt beim Start alles Alte einmal an.
 */
function alt(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return s;
}

export function neuerSchluessel(): string | null {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) return null;
  if (k.length < 32) throw new Error('ENCRYPTION_KEY ist kürzer als 32 Zeichen');
  if (k === process.env.SESSION_SECRET) throw new Error('ENCRYPTION_KEY muss sich von SESSION_SECRET unterscheiden');
  return k;
}

export function zuschliessen(text: string, zweck: string): string {
  const k = neuerSchluessel();
  return k ? verschluesseln(text, k, zweck, 'v2') : verschluesseln(text, alt(), zweck, 'v1');
}

export function aufschliessen(box: string, zweck: string): string {
  if (fassung(box) === 'v2') {
    const k = neuerSchluessel();
    if (!k) throw new Error('ENCRYPTION_KEY fehlt, gespeicherte Geheimnisse sind damit verschlüsselt');
    return entschluesseln(box, k, zweck);
  }
  return entschluesseln(box, alt(), zweck);
}

/** Braucht diese Box ein Umschlüsseln auf v2? */
export const veraltet = (box: string) => !!neuerSchluessel() && fassung(box) === 'v1';
