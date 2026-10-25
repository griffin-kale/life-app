'use client';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { GeldSeite, TEILE } from '../seite';

export default function GeldTeil({ params }: { params: Promise<{ teil: string }> }) {
  const { teil } = use(params);
  if (!(teil in TEILE)) notFound();
  return <GeldSeite teil={teil} />;
}
