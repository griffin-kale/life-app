import { NextResponse } from 'next/server';
import { kompassStand } from '@/lib/kompass';
import { ohneSitzung } from '@/lib/sitzung';

export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  return NextResponse.json(await kompassStand());
}
