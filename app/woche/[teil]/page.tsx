'use client';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { TEILE, WocheSeite } from '../seite';

export default function WocheTeil({ params }: { params: Promise<{ teil: string }> }) {
  const { teil } = use(params);
  if (!(teil in TEILE)) notFound();
  return <WocheSeite teil={teil} />;
}
