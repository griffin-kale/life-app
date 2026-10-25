import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Einmal-Codes nach RFC 6238 (TOTP, SHA-1, 30 Sekunden, 6 Stellen), ohne Abhängigkeiten.
 * Kompatibel mit 1Password, Apple Passwörter und jeder Authenticator-App.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SEKUNDEN = 30;

export function base32Encode(buf: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Ungültiges Zeichen im Schlüssel');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function neuerSchluessel(): string {
  return base32Encode(randomBytes(20)); // 160 Bit, wie von RFC 4226 empfohlen
}

export function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const schritt = (zeitMs: number) => Math.floor(zeitMs / 1000 / STEP_SEKUNDEN);

export function totp(secretB32: string, zeitMs = Date.now(), digits = 6): string {
  return hotp(base32Decode(secretB32), schritt(zeitMs), digits);
}

/**
 * Prüft einen Code. Erlaubt einen Schritt Abweichung der Uhr (±30 s).
 * Ein Code gilt nur einmal: Schritte bis einschließlich `zuletzt` werden abgelehnt.
 */
export function pruefeCode(secretB32: string, code: string, zuletzt: number, zeitMs = Date.now()): { ok: boolean; step: number } {
  const c = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return { ok: false, step: zuletzt };
  const key = base32Decode(secretB32);
  const jetzt = schritt(zeitMs);
  let treffer = -1;
  for (const s of [jetzt - 1, jetzt, jetzt + 1]) {
    const erwartet = Buffer.from(hotp(key, s));
    // Alle drei immer prüfen, damit die Laufzeit nichts verrät
    if (timingSafeEqual(erwartet, Buffer.from(c)) && s > zuletzt) treffer = s;
  }
  return treffer >= 0 ? { ok: true, step: treffer } : { ok: false, step: zuletzt };
}

export function otpauthUrl(secretB32: string, konto: string, aussteller: string): string {
  const label = encodeURIComponent(`${aussteller}:${konto}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(aussteller)}&algorithm=SHA1&digits=6&period=${STEP_SEKUNDEN}`;
}
