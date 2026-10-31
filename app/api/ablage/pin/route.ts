import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { aktuelleSitzung, mitNutzer } from '@/lib/sitzung';
import { OHNE_CACHE, bestaetigtUm, pinSetzen, pinStand } from '@/lib/ablage';
import { frischBestaetigt, pinOk } from '@/lib/ablage-pin';
import { aktiv } from '@/lib/zweifaktor';
import { ERSTER_NUTZER } from '@/lib/db';

/** PIN-Stand: gesetzt, gesperrt, und ob die letzte Bestätigung frisch genug zum Ändern ist. Nie die PIN selbst. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const s = (await aktuelleSitzung())!;
  // code: ob Passwort plus Code als Weg bereitsteht (nur der erste Mensch hat ihn)
  const code = uid === ERSTER_NUTZER && await aktiv().catch(() => false);
  return NextResponse.json({ ...(await pinStand(uid)), frisch: frischBestaetigt(await bestaetigtUm(s.sid)), code }, { headers: OHNE_CACHE });
}

/** PIN anlegen oder ändern: nur mit gültiger Sitzung und frischer Bestätigung (Passkey oder Passwort plus Code, höchstens 5 Minuten alt). */
export async function PUT(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const s = (await aktuelleSitzung())!;
  const b = await req.json().catch(() => ({}));
  if (!pinOk(b.pin)) return NextResponse.json({ error: 'Die PIN hat genau 6 Ziffern.' }, { status: 400, headers: OHNE_CACHE });
  if (!frischBestaetigt(await bestaetigtUm(s.sid))) return NextResponse.json({ error: 'Bestätige zuerst mit Passwort und Code oder Passkey.' }, { status: 403, headers: OHNE_CACHE });
  await pinSetzen(b.pin, uid);
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}
