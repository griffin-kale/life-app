import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, sameSecret, validSession } from '@/lib/session';

/** Einrichten darf, wer den Einrichtungscode kennt oder schon angemeldet ist. /api/auth/ ist offen, deshalb prüfen wir hier selbst. */
export async function darfEinrichten(req: NextRequest, token: unknown): Promise<boolean> {
  if (await validSession(req.cookies.get(SESSION_COOKIE)?.value)) return true;
  return sameSecret(typeof token === 'string' ? token : '', process.env.SETUP_TOKEN);
}
