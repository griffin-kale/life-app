'use client';
import { useState, type ReactNode } from 'react';
import { useBreit } from './ui';
import { EintragDetail } from './eintrag/detail';

/**
 * Liste links, Eintrag rechts. Ab 1100 px öffnet ein Tipp auf einen Eintrag ihn rechts im Inspektor,
 * statt die Seite zu wechseln. Schmaler bleibt alles wie auf dem iPhone.
 */
export function MitInspektor({ children, leer, back, onGeaendert }: { children: ReactNode; leer: ReactNode; back: { label: string; href: string }; onGeaendert?: () => void }) {
  const breit = useBreit(1100);
  const [sel, setSel] = useState<string | null>(null);
  // Gleicher Baum in beiden Breiten, damit Eingabefelder beim Umschalten nicht neu entstehen
  return (
    <div className={breit ? 'mit-inspektor' : 'mi-aus'}>
      <div className="mi-liste" onClickCapture={(e) => {
        if (!breit) return;
        const a = (e.target as HTMLElement).closest('a[href^="/eintrag/"]') as HTMLAnchorElement | null;
        if (!a || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        setSel(new URL(a.href).pathname.split('/')[2] ?? null);
      }}>{children}</div>
      {breit ? <aside className="mi-rechts" aria-label="Inspektor">
        {sel ? <>
          <button type="button" className="linkbtn mi-zu" onClick={() => setSel(null)}>Schließen</button>
          <EintragDetail key={sel} id={sel} back={back} eingebettet onGeaendert={onGeaendert} />
        </> : leer}
      </aside> : null}
    </div>
  );
}
