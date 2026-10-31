'use client';
import { use } from 'react';
import { EintragDetail } from '../detail';

const BACK: Record<string, { label: string; href: string }> = { archiv: { label: 'Logbuch', href: '/archiv' }, woche: { label: 'Plan', href: '/woche' } };

export default function Eintrag({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ von?: string }> }) {
  const { id } = use(params);
  const { von } = use(searchParams);
  return <EintragDetail id={id} back={BACK[von ?? ''] ?? { label: 'Heute', href: '/' }} />;
}
