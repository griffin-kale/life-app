import { NextResponse } from 'next/server';
import { getSetting, proNutzer } from '@/lib/db';
import { engpassAus, offene } from '@/lib/priorisieren';
import { standLesen, wochenziel } from '@/lib/stand';
import { ETAPPEN, naechsteEtappe } from '@/lib/standort';
import { aufgabe } from '@/lib/tag';
import { mitNutzer } from '@/lib/sitzung';

/** Dein Stand: Baseline, Richtung, Engpass, Woche und das Wichtigste für heute. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const [stand, wz, kontext, items] = await Promise.all([standLesen(uid), wochenziel(uid), getSetting(proNutzer('kontext', uid)), offene(uid).catch(() => [])]);
  const heute = items.find((i) => i.stapel === 'jetzt');
  return NextResponse.json({
    stand, wochenziel: wz, engpass: engpassAus(kontext),
    heute: heute ? aufgabe(heute) : '',
    naechste: naechsteEtappe(stand),
    etappen: ETAPPEN.map((e) => ({ nr: e.nr, titel: e.titel, kurz: e.kurz, dauer: e.dauer, erledigt: stand.etappen?.[String(e.nr) as '1'] ?? null })),
  });
}
