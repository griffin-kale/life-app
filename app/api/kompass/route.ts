import { NextResponse } from 'next/server';
import { kompassStand } from '@/lib/kompass';

export async function GET() { return NextResponse.json(await kompassStand()); }
