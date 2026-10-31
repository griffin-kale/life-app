import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { begrenzt } from '@/lib/ratelimit';
import { challengeCookie, readChallenge } from '@/lib/session';
import { ERSTER_NUTZER, aktuelleSitzung, mitNutzer } from '@/lib/sitzung';
import { rp } from '@/lib/webauthn';
import { anmelden } from '@/lib/zweifaktor';
import { OHNE_CACHE, PIN_TEXT, pinPruefen, pinZaehlerNull, riegelAuf, riegelZu } from '@/lib/ablage';
import { pinOk } from '@/lib/ablage-pin';

/**
 * Riegel der Ablage öffnen. Drei Wege (Peter, 31.10.2026):
 * PIN (fürs iPhone, solange dort keine Passkeys gehen), Passkey, Passwort plus Code.
 * Passkey und Passwort plus Code gelten als frische Bestätigung und heben eine PIN-Sperre auf.
 * Falsche Angaben antworten mit 422, nie mit 401: 401 heißt in Life „Sitzung weg“ und führt zur Anmeldung.
 */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const s = (await aktuelleSitzung())!;
  const b = await req.json().catch(() => ({}));

  if (b.pin !== undefined) {
    const zuViel = begrenzt(req, 'pin'); if (zuViel) return zuViel;
    if (!pinOk(b.pin)) return NextResponse.json({ error: PIN_TEXT.falsch }, { status: 422, headers: OHNE_CACHE });
    const e = await pinPruefen(b.pin, uid);
    if (!e) return NextResponse.json({ error: 'Es gibt noch keine PIN.' }, { status: 409, headers: OHNE_CACHE });
    if (e.ergebnis === 'gesperrt') return NextResponse.json({ error: PIN_TEXT.gesperrt, gesperrt: true }, { status: 423, headers: OHNE_CACHE });
    if (e.ergebnis === 'falsch') return NextResponse.json({ error: PIN_TEXT.falsch }, { status: 422, headers: OHNE_CACHE });
    await riegelAuf(s.sid, uid, false);
    return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
  }

  if (b.passwort !== undefined) {
    const zuViel = begrenzt(req, 'code'); if (zuViel) return zuViel;
    // Passwort und Code gehören nur dem ersten Menschen im Haushalt
    if (uid !== ERSTER_NUTZER || typeof b.passwort !== 'string' || b.passwort.length > 200 || typeof b.code !== 'string' || !(await anmelden(b.passwort, b.code))) {
      return NextResponse.json({ error: 'Passwort oder Code stimmt nicht.' }, { status: 422, headers: OHNE_CACHE });
    }
    await riegelAuf(s.sid, uid, true);
    await pinZaehlerNull(uid);
    return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
  }

  const zuViel = begrenzt(req, 'anmelden'); if (zuViel) return zuViel;
  const { response } = b;
  const challenge = await readChallenge(req.cookies.get(challengeCookie())?.value, 'ablage');
  if (!challenge || typeof response?.id !== 'string') return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal.' }, { status: 400 });
  await ensureSchema();
  const [cred] = await sql`select id, public_key, counter, transports, user_id from credentials where id = ${response.id} and user_id = ${uid}`;
  if (!cred) return NextResponse.json({ error: 'Dieser Passkey gehört nicht zu dir.' }, { status: 403 });
  const { rpID, origin } = rp(req);
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: cred.id, publicKey: new Uint8Array(cred.public_key), counter: Number(cred.counter), transports: (cred.transports || '').split(',').filter(Boolean) as AuthenticatorTransportFuture[] },
    });
    if (!v.verified) throw new Error('nicht bestätigt');
    await sql`update credentials set counter = ${v.authenticationInfo.newCounter} where id = ${cred.id}`;
  } catch (e) {
    console.warn('[ablage] Passkey abgelehnt', (e as Error).name);
    return NextResponse.json({ error: 'Passkey hat nicht geklappt. Bitte nochmal.' }, { status: 403 });
  }
  await riegelAuf(s.sid, uid, true);
  await pinZaehlerNull(uid);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(challengeCookie());
  return res;
}

/** Schließen: beim Verlassen der Ablage, beim Sperren, wenn die App in den Hintergrund geht. */
export async function DELETE() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const s = await aktuelleSitzung();
  if (s && s.userId === uid) await riegelZu(s.sid);
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}
