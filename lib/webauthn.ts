import type { NextRequest } from 'next/server';

/**
 * Domain und Herkunft für Passkeys. Ein Passkey gilt nur für genau diese Domain.
 * Im Betrieb kommt beides fest aus PUBLIC_ORIGIN (z. B. https://life.gneuss.xyz), damit ein
 * gefälschter Host-Header nichts verändern kann. Ohne PUBLIC_ORIGIN (lokal, Tests) zählt die Anfrage.
 */
export function rp(req: NextRequest): { rpID: string; origin: string } {
  const fixed = process.env.PUBLIC_ORIGIN;
  if (fixed) { const u = new URL(fixed); return { rpID: u.hostname, origin: u.origin }; }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') ?? (rpID === 'localhost' ? 'http' : 'https');
  return { rpID, origin: `${proto}://${host}` };
}
