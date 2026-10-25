import type { NextRequest } from 'next/server';

/** Domain und Herkunft aus der Anfrage. Ein Passkey gilt nur für genau diese Domain. */
export function rp(req: NextRequest): { rpID: string; origin: string } {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') ?? (rpID === 'localhost' ? 'http' : 'https');
  return { rpID, origin: `${proto}://${host}` };
}
