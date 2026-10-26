'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Nach unten ziehen lädt neu (Peter, 26.10.2026). Safari kann das selbst, die App auf dem Home-Bildschirm nicht.
 * Darum nur dort aktiv. Greift nur ganz oben auf der Seite und nie in offenen Blättern oder Dialogen.
 */
const SCHWELLE = 70;

function eingeklemmt(ziel: EventTarget | null): boolean {
  let el = ziel instanceof Element ? ziel : null;
  while (el && el !== document.body) {
    if (el.closest('[aria-modal="true"], dialog[open], textarea, input, select')) return true;
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

export function Ziehen() {
  const [weg, setWeg] = useState(0);
  const [laedt, setLaedt] = useState(false);
  const start = useRef<number | null>(null);
  const wegRef = useRef(0);

  useEffect(() => {
    const app = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!app) return;
    const setze = (n: number) => { wegRef.current = n; setWeg(n); };
    const an = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || document.querySelector('[aria-modal="true"]') || eingeklemmt(e.target)) { start.current = null; return; }
      start.current = e.touches[0].clientY;
    };
    const zug = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { setze(0); return; }
      setze(Math.min(110, dy * 0.5));
    };
    const los = () => {
      if (start.current === null) return;
      start.current = null;
      if (wegRef.current >= SCHWELLE) { setLaedt(true); setze(SCHWELLE); window.location.reload(); }
      else setze(0);
    };
    window.addEventListener('touchstart', an, { passive: true });
    window.addEventListener('touchmove', zug, { passive: true });
    window.addEventListener('touchend', los);
    window.addEventListener('touchcancel', los);
    return () => {
      window.removeEventListener('touchstart', an);
      window.removeEventListener('touchmove', zug);
      window.removeEventListener('touchend', los);
      window.removeEventListener('touchcancel', los);
    };
  }, []);

  if (!weg && !laedt) return null;
  const bereit = weg >= SCHWELLE;
  return (
    <div className={`ziehen${bereit ? ' bereit' : ''}${laedt ? ' laedt' : ''}`} style={{ transform: `translate(-50%, ${weg - 44}px)` }} role="status" aria-live="polite">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${laedt ? 0 : weg * 3}deg)` }}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" />
      </svg>
      <span className="sr-only">{laedt ? 'Lädt neu' : bereit ? 'Loslassen zum Neuladen' : 'Zum Neuladen ziehen'}</span>
    </div>
  );
}
