import { NextResponse, type NextRequest } from 'next/server';
import { proNutzer, setSetting } from '@/lib/db';
import { abbestellen, abonnieren, aboAnzahl, endpointOk, senden, vapid } from '@/lib/push';
import { begrenzt } from '@/lib/ratelimit';
import { PUSH_STANDARD, pushEinstellungen } from '@/lib/zeitplan';
import { mitNutzer } from '@/lib/sitzung';

const ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const [k, n, e] = await Promise.all([vapid(), aboAnzahl(uid), pushEinstellungen(uid)]);
  return NextResponse.json({ publicKey: k.publicKey, geraete: n, einstellungen: e });
}

/** Gerät anmelden oder eine Probe schicken. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  if (b.probe) return NextResponse.json({ gesendet: await senden({ title: 'Life', body: 'So sehen Mitteilungen von Life aus.', url: '/einstellungen', tag: 'probe' }, uid) });
  const a = b.abo;
  if (!a || typeof a.endpoint !== 'string' || !endpointOk(a.endpoint) || typeof a.keys?.p256dh !== 'string' || typeof a.keys?.auth !== 'string' || a.keys.p256dh.length > 200 || a.keys.auth.length > 100)
    return NextResponse.json({ error: 'Ungültige Anmeldung' }, { status: 400 });
  await abonnieren({ endpoint: a.endpoint, keys: { p256dh: a.keys.p256dh, auth: a.keys.auth } }, uid);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const alt = await pushEinstellungen(uid);
  const neu = { ...PUSH_STANDARD, ...alt };
  for (const k of ['morgen', 'abend', 'warnung', 'training', 'verpasst', 'nachmittag', 'wochenstart'] as const) if (typeof b[k] === 'boolean') neu[k] = b[k];
  for (const k of ['morgenZeit', 'abendZeit'] as const) if (typeof b[k] === 'string' && ZEIT.test(b[k])) neu[k] = b[k];
  await setSetting(proNutzer('push', uid), JSON.stringify(neu));
  return NextResponse.json(neu);
}

export async function DELETE(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  if (typeof b.endpoint === 'string') await abbestellen(b.endpoint, uid);
  return NextResponse.json({ ok: true });
}
