'use client';
/** Ein Ring wie bei Apple Fitness: füllt sich im Uhrzeigersinn, ab 100 % geschlossen. */
export function Ring({ wert, farbe, groesse = 64, dicke = 7, label }: { wert: number | null; farbe: string; groesse?: number; dicke?: number; label?: string }) {
  const r = (groesse - dicke) / 2; const u = 2 * Math.PI * r; const v = wert === null ? 0 : Math.min(1, wert);
  return (
    <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} role="img" aria-label={label ?? (wert === null ? 'noch keine Daten' : `${Math.round(v * 100)} Prozent`)} className="ring">
      <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={farbe} strokeOpacity={0.18} strokeWidth={dicke} />
      {wert !== null && v > 0 ? <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={farbe} strokeWidth={dicke} strokeLinecap="round" strokeDasharray={`${u * v} ${u}`} transform={`rotate(-90 ${groesse / 2} ${groesse / 2})`} /> : null}
    </svg>
  );
}

export const FARBE: Record<string, string> = { zeit: 'var(--k-zeit)', sozial: 'var(--k-sozial)', mental: 'var(--k-mental)', koerper: 'var(--k-koerper)', geld: 'var(--k-geld)' };
export const NAME: Record<string, string> = { zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };
export const KONTEN = ['zeit', 'sozial', 'mental', 'koerper', 'geld'] as const;
