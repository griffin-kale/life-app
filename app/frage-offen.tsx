'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from './ui';

/** Neutraler Hinweis (0.31, Peter 31.10.2026): eine Zeile ohne Inhalt, wenn abends noch eine Frage offen ist. */
export function FrageOffen() {
  const [offen, setOffen] = useState(false);
  useEffect(() => { api<{ offen: boolean }>('/api/ablage/zeichen').then((r) => setOffen(r.offen)).catch(() => {}); }, []);
  if (!offen) return null;
  return <Link href="/ablage" className="frage-offen">Eine Frage ist noch offen</Link>;
}
