'use client';
import Link from 'next/link';
import { Icon } from './ui';

/**
 * Karte auf Heute für die Rituale (0.27, Peter 29.10.2026): morgens „Tag planen“, abends „Tag abschließen“,
 * Montag bis Mittwoch die Wochenrunde. Ersetzt die Fragebögen auf Heute. Die Blätter liegen unter /morgen und /abschluss.
 */
export function RitualKarte({ art, wochenrunde }: { art: 'morgen' | 'abend' | null; wochenrunde: boolean }) {
  if (art === 'morgen') return (
    <Link href="/morgen" className="ws-banner rt-karte" aria-label="Morgen: Tag planen">
      <span><b>Guten Morgen</b><small>Zwei Minuten: wie erholt du bist, was von gestern übrig ist, die eine Sache.</small></span>
      <em className="rt-knopf">Tag planen</em>{Icon.chevronRight}
    </Link>
  );
  if (art === 'abend') return (
    <Link href="/abschluss" className="ws-banner rt-karte" aria-label="Abschluss: Tag abschließen">
      <span><b>Abschluss</b><small>Zwei Minuten: abhaken, Offenes verteilen, ein Wort zum Tag. Dann kann der Kopf zumachen.</small></span>
      <em className="rt-knopf">Tag abschließen</em>{Icon.chevronRight}
    </Link>
  );
  if (wochenrunde) return (
    <Link href="/wochenstart" className="ws-banner rt-karte" aria-label="Wochenrunde öffnen">
      <span><b>Wochenrunde</b><small>Zehn Minuten für die Woche: Rückblick, Hebel, Engpass, drei Dinge.</small></span>
      {Icon.chevronRight}
    </Link>
  );
  return null;
}
