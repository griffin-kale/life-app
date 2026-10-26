import { NextResponse, type NextRequest } from 'next/server';
import { chatVerlauf, coachChat } from '@/lib/coach';
import { begrenzt } from '@/lib/ratelimit';

/** Gespräch mit dem Coach für heute. */
export async function GET() {
  return NextResponse.json({ verlauf: await chatVerlauf() });
}

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
  return NextResponse.json({ verlauf: await coachChat(text) });
}
