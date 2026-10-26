'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

/**
 * Seiten zum Blättern: eine Seite pro Frage oder Schritt, die Fläche bleibt stehen.
 * Wischen nutzt das native Einrasten des Browsers (scroll-snap), dadurch folgt die Seite dem Finger
 * und lässt sich jederzeit umkehren. Knöpfe und Punkte gehen dieselben Wege.
 */
export type BlaetterSteuerung = { weiter: () => void; zu: (i: number) => void };

export const Blaetter = forwardRef<BlaetterSteuerung, { seiten: ReactNode[]; label: string; fuss?: (i: number, n: number) => ReactNode; onSeite?: (i: number) => void }>(
  function Blaetter({ seiten, label, fuss, onSeite }, ref) {
    const bahn = useRef<HTMLDivElement>(null);
    const [i, setI] = useState(0);
    const n = seiten.length;
    const zu = useCallback((ziel: number) => {
      const el = bahn.current; if (!el) return;
      const k = Math.max(0, Math.min(n - 1, ziel));
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: k * el.clientWidth, behavior: ruhig ? 'auto' : 'smooth' });
    }, [n]);
    useImperativeHandle(ref, () => ({ weiter: () => zu(i + 1), zu }), [i, zu]);
    // Aktuelle Seite aus der Scrollposition, damit Wischen und Knöpfe dasselbe zeigen
    useEffect(() => {
      const el = bahn.current; if (!el) return;
      const f = () => { const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); setI((alt) => (alt === k ? alt : k)); };
      el.addEventListener('scroll', f, { passive: true });
      return () => el.removeEventListener('scroll', f);
    }, []);
    useEffect(() => { onSeite?.(i); }, [i, onSeite]);

    return (
      <div className="blaetter" role="group" aria-roledescription="Seiten" aria-label={label}>
        <div className="bl-bahn" ref={bahn}>
          {seiten.map((s, k) => (
            <section key={k} className="bl-seite" aria-roledescription="Seite" aria-label={`${k + 1} von ${n}`}>{s}</section>
          ))}
        </div>
        <div className="bl-leiste">
          <button type="button" className="chipbtn" onClick={() => zu(i - 1)} disabled={i === 0}>Zurück</button>
          <span className="bl-punkte" aria-hidden="true">{seiten.map((_, k) => <i key={k} className={k === i ? 'an' : ''} />)}</span>
          <span className="bl-zahl">{i + 1} von {n}</span>
          {fuss ? fuss(i, n) : i < n - 1 ? <button type="button" className="chipbtn" onClick={() => zu(i + 1)}>Weiter</button> : <span className="bl-platz" />}
        </div>
      </div>
    );
  },
);
