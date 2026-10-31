import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';
import { OHNE_CACHE, ablageAnlegen, ablageKopf, ablageLeeren, ablageRiegel, passphraseNeu } from '@/lib/ablage';
import { blockOk, iterationenOk, salzOk } from '@/lib/ablage-regeln';

/** Ob es die Ablage gibt. Salz und eingepackte Schlüssel nur mit offenem Riegel, damit niemand ohne Face ID Passphrasen durchprobiert. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const kopf = await ablageKopf(uid);
  const zu = await ablageRiegel(uid);
  return NextResponse.json({ eingerichtet: !!kopf, offen: !zu, ...(kopf && !zu ? kopf : {}) }, { headers: OHNE_CACHE });
}

/** Einrichten: Der Browser schickt Salz, Wiederholungen und den zweimal eingepackten Inhaltsschlüssel. Passphrase und Schlüssel verlassen das Gerät nie. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  const b = await req.json().catch(() => ({}));
  if (!salzOk(b.salz) || !iterationenOk(b.iterationen) || !blockOk(b.pass_block) || !blockOk(b.wieder_block)) return NextResponse.json({ error: 'Ungültige Angaben' }, { status: 400, headers: OHNE_CACHE });
  if (!(await ablageAnlegen({ salz: b.salz, iterationen: b.iterationen, pass_block: b.pass_block, wieder_block: b.wieder_block }, uid))) return NextResponse.json({ error: 'Schon eingerichtet.' }, { status: 409, headers: OHNE_CACHE });
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}

/** Neue Passphrase: neues Salz und neu eingepackter Inhaltsschlüssel. */
export async function PUT(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  const b = await req.json().catch(() => ({}));
  if (!salzOk(b.salz) || !iterationenOk(b.iterationen) || !blockOk(b.pass_block)) return NextResponse.json({ error: 'Ungültige Angaben' }, { status: 400, headers: OHNE_CACHE });
  if (!(await passphraseNeu({ salz: b.salz, iterationen: b.iterationen, pass_block: b.pass_block }, uid))) return NextResponse.json({ error: 'Nicht eingerichtet' }, { status: 404, headers: OHNE_CACHE });
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}

/** Passphrase und Wiederherstellungsschlüssel verloren: alles löschen. Nur mit offenem Riegel und ausdrücklicher Bestätigung. */
export async function DELETE(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  if (req.nextUrl.searchParams.get('bestaetigt') !== 'alles-loeschen') return NextResponse.json({ error: 'Bestätigung fehlt' }, { status: 400, headers: OHNE_CACHE });
  await ablageLeeren(uid);
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}
