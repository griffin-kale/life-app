import { NextResponse } from 'next/server';
import { cockpit } from '@/lib/cockpit';
import { mitNutzer } from '@/lib/sitzung';

/** Cockpit auf Heute: drei Werte, Tagesstreifen und je Konto eine Zeile, in einem Abruf. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json(await cockpit(uid));
}
