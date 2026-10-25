import { getSetting, setSetting, sql, ensureSchema } from './db';
import { hashPasswort, pruefePasswort, verschluesseln, entschluesseln } from './passwort-core';
import { neuerSchluessel, otpauthUrl, pruefeCode } from './totp-core';

/**
 * Anmeldung mit Passwort und Einmal-Code als zweiter Weg neben dem Passkey.
 * Gespeichert in settings: pw_hash (scrypt), totp_enc (AES-GCM, Schlüssel aus SESSION_SECRET),
 * totp_last (zuletzt benutzter Zeitschritt), pw_pending (Einrichtung, 10 Minuten gültig).
 */

const GUELTIG_MS = 10 * 60_000;

function geheim(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return s;
}

export function passwortOk(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 16 && pw.length <= 200;
}

export async function aktiv(): Promise<boolean> {
  const [h, e] = await Promise.all([getSetting('pw_hash'), getSetting('totp_enc')]);
  return !!h && !!e;
}

/** Schritt 1: Passwort merken (noch nicht aktiv) und neuen Schlüssel für die Code-App erzeugen. */
export async function starten(passwort: string): Promise<{ secret: string; otpauth: string }> {
  const secret = neuerSchluessel();
  const pending = { hash: hashPasswort(passwort), enc: verschluesseln(secret, geheim()), exp: Date.now() + GUELTIG_MS };
  await setSetting('pw_pending', JSON.stringify(pending));
  return { secret, otpauth: otpauthUrl(secret, 'Peter', 'Life') };
}

/** Schritt 2: Erst wenn der erste Code stimmt, wird die Anmeldung aktiv. */
export async function abschliessen(code: string): Promise<'ok' | 'abgelaufen' | 'falsch'> {
  const raw = await getSetting('pw_pending');
  if (!raw) return 'abgelaufen';
  let p: { hash: string; enc: string; exp: number };
  try { p = JSON.parse(raw); } catch { return 'abgelaufen'; }
  if (!p.exp || Date.now() > p.exp) { await setSetting('pw_pending', ''); return 'abgelaufen'; }
  const r = pruefeCode(entschluesseln(p.enc, geheim()), code, -1);
  if (!r.ok) return 'falsch';
  await sql.begin(async (tx) => {
    for (const [k, v] of [['pw_hash', p.hash], ['totp_enc', p.enc], ['totp_last', String(r.step)], ['pw_pending', '']]) {
      await tx`insert into settings (key, value) values (${k}, ${v}) on conflict (key) do update set value = excluded.value`;
    }
  });
  return 'ok';
}

/** Prüft Passwort und Code. Rechnet immer beides, damit Antwortzeit und Meldung nichts verraten. */
export async function anmelden(passwort: string, code: string): Promise<boolean> {
  const [hash, enc, last] = await Promise.all([getSetting('pw_hash'), getSetting('totp_enc'), getSetting('totp_last')]);
  const pwOk = pruefePasswort(passwort, hash || null);
  if (!enc) return false;
  let secret: string;
  try { secret = entschluesseln(enc, geheim()); } catch { return false; }
  const r = pruefeCode(secret, code, Number(last) || -1);
  if (!pwOk || !r.ok) return false;
  // Jeder Code gilt einmal, auch bei zwei gleichzeitigen Anfragen
  await ensureSchema();
  const rows = await sql`update settings set value = ${String(r.step)} where key = 'totp_last' and value::bigint < ${r.step} returning key`;
  return rows.length === 1;
}

export async function ausschalten(): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from settings where key in ('pw_hash', 'totp_enc', 'totp_last', 'pw_pending')`;
  });
}
