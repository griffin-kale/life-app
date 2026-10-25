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

/** Verschlüsselt kleine Geheimnisse (TOTP-Schlüssel, WHOOP-Tokens, Push-Schlüssel) für die Datenbank mit AES-256-GCM. Jeder Zweck hat einen eigenen Schlüssel. */
function schluessel(geheim: string, zweck: string): Buffer {
  return createHash('sha256').update(`life-${zweck}-v1:` + geheim).digest();
}
export function verschluesseln(text: string, geheim: string, zweck = 'totp'): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluessel(geheim, zweck), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
export function entschluesseln(box: string, geheim: string, zweck = 'totp'): string {
  const [v, iv, tag, enc] = box.split('.');
  if (v !== 'v1') throw new Error('Unbekanntes Format');
  const d = createDecipheriv('aes-256-gcm', schluessel(geheim, zweck), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}
