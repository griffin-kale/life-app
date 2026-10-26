'use client';
import { useEffect, useRef, useState } from 'react';

/** Bon zuschneiden, bevor er an Claude geht (Phase 3, Peter 26.10.2026). Oben stehen meist Adresse und Filiale,
 *  unten Kartennummer und Beleg-ID. Du ziehst die Kanten auf Posten und Summe, nur dieser Streifen verlässt den Browser. */
export function BonZuschnitt({ datei, onFertig, onAbbrechen }: { datei: File; onFertig: (bild: string) => void; onAbbrechen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [oben, setOben] = useState(0.18);
  const [unten, setUnten] = useState(0.82);
  const flaeche = useRef<HTMLDivElement>(null);
  const zieht = useRef<'oben' | 'unten' | null>(null);
  useEffect(() => { const u = URL.createObjectURL(datei); setUrl(u); return () => URL.revokeObjectURL(u); }, [datei]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbbrechen(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onAbbrechen]);

  const anteil = (y: number) => { const r = flaeche.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (y - r.top) / r.height)); };
  function bewegen(e: React.PointerEvent) {
    if (!zieht.current) return;
    const a = anteil(e.clientY);
    if (zieht.current === 'oben') setOben(Math.min(a, unten - 0.08)); else setUnten(Math.max(a, oben + 0.08));
  }
  const taste = (kante: 'oben' | 'unten') => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowUp' ? -0.02 : e.key === 'ArrowDown' ? 0.02 : 0; if (!d) return;
    e.preventDefault();
    if (kante === 'oben') setOben((o) => Math.max(0, Math.min(unten - 0.08, o + d))); else setUnten((u) => Math.min(1, Math.max(oben + 0.08, u + d)));
  };

  async function senden() {
    if (!url) return;
    const img = new Image(); img.src = url; await img.decode();
    const y = Math.round(img.height * oben); const h = Math.max(1, Math.round(img.height * (unten - oben)));
    const s = Math.min(1, 1400 / Math.max(img.width, h));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(h * s);
    c.getContext('2d')!.drawImage(img, 0, y, img.width, h, 0, 0, c.width, c.height);
    onFertig(c.toDataURL('image/jpeg', 0.82)); // neu gespeichert, ohne Ortsdaten
  }

  return <>
    <button type="button" className="blatt-scrim" aria-label="Abbrechen" onClick={onAbbrechen} />
    <div className="blatt bon-blatt" role="dialog" aria-modal="true" aria-label="Bon zuschneiden">
      <span className="blatt-griff" aria-hidden="true" />
      <h2 className="blatt-titel">Auf Posten und Summe ziehen</h2>
      <div ref={flaeche} className="bon-flaeche" onPointerMove={bewegen} onPointerUp={() => { zieht.current = null; }} onPointerCancel={() => { zieht.current = null; }}>
        {url ? <img src={url} alt="Foto des Bons" draggable={false} /> : null}
        <span className="bon-schatten" style={{ top: 0, height: `${oben * 100}%` }} aria-hidden="true" />
        <span className="bon-schatten" style={{ top: `${unten * 100}%`, bottom: 0 }} aria-hidden="true" />
        <button type="button" className="bon-kante" style={{ top: `${oben * 100}%` }} aria-label="Obere Kante, mit Pfeiltasten verschieben"
          onPointerDown={(e) => { zieht.current = 'oben'; (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); }} onKeyDown={taste('oben')} />
        <button type="button" className="bon-kante" style={{ top: `${unten * 100}%` }} aria-label="Untere Kante, mit Pfeiltasten verschieben"
          onPointerDown={(e) => { zieht.current = 'unten'; (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); }} onKeyDown={taste('unten')} />
      </div>
      <p className="gnote flush">Nur der helle Streifen geht an Claude.</p>
      <div className="row-btns">
        <button type="button" className="btn primary" onClick={senden} disabled={!url}>Ausschnitt senden</button>
        <button type="button" className="linkbtn" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </div>
  </>;
}
