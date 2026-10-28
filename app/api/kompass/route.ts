import { NextResponse } from 'next/server';
import { kompassStand } from '@/lib/kompass';
import { mitNutzer } from '@/lib/sitzung';

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json(await kompassStand(uid));
}
