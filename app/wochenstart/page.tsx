'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TabBar, TopBar, api, useToast } from '../ui';
import { Blaetter, type BlaetterSteuerung } from '../blaetter';
import { FARBE, KONTEN, NAME, Ring } from '../ringe';

type Kurz = { id: string; titel: string; stapel: string | null };
type W = { montag: string; offen: boolean; rueckblick: { ringe: Record<string, number | null> | null; alleZu: boolean; erledigt: number; liegen: Kurz[] }; engpass: string; kandidaten: Kurz[]; geparkt: Kurz[]; fokus: string[] };
const PARK: [string, string][] = [['woche', 'In die Woche'], ['bleibt', 'Liegen lassen'], ['streichen', 'Streichen']];

/** Wochenstart in vier Schritten, eine Seite pro Schritt. Alles zum Antippen, eigene Worte gehen immer. */
export default function Wochenstart() {
  const [w, setW] = useState<W | null>(null);
  const [engpass, setEngpass] = useState<'passt' | 'neu' | null>(null);
  const [neu, setNeu] = useState('');
  const [fokus, setFokus] = useState<string[]>([]);
  const [park, setPark] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const blatt = useRef<BlaetterSteuerung>(null);
  const router = useRouter();
  useEffect(() => { api<W>('/api/wochenstart').then((x) => { setW(x); setFokus(x.fokus); }).catch((e) => setToast((e as Error).message, 'err')); }, [setToast]);

  const umschalten = (id: string) => setFokus((f) => (f.includes(id) ? f.filter((x) => x !== id) : f.length >= 3 ? f : [...f, id]));
  async function parken(id: string, wohin: string) {
    setPark((p) => ({ ...p, [id]: wohin }));
    if (wohin === 'bleibt') return;
    try { await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(wohin === 'woche' ? { stapel: 'woche' } : { status: 'archiv' }) }); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function abschliessen() {
    setBusy(true);
    try {
      if (engpass === 'neu' && neu.trim()) await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'engpass', text: neu }) });
      // Geparktes aus den drei Dingen kommt in die Woche
      for (const id of fokus) if (w?.geparkt.some((g) => g.id === id) && !park[id]) await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ stapel: 'woche' }) });
      await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'fokus', ids: fokus }) });
      await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'fertig' }) });
      api('/api/heute', { method: 'POST' }).catch(() => {});
      router.push('/woche?wochenstart=fertig');
    } catch (e) { setToast((e as Error).message, 'err'); setBusy(false); }
  }

  const r = w?.rueckblick;
  const seiten = w ? [
    <div key="r" className="ws-seite">
      <h2 className="ws-titel">Rückblick</h2>
      <p className="muted small">Letzte Woche: {r!.erledigt} erledigt{r!.alleZu ? ', alle fünf Ringe zu' : ''}.</p>
      {r!.ringe ? <div className="ringreihe">{KONTEN.map((x) => <span key={x} className="ringzelle"><Ring wert={r!.ringe![x]} farbe={FARBE[x]} groesse={48} dicke={6} label={`${NAME[x]} letzte Woche`} /><b>{NAME[x]}</b></span>)}</div> : null}
      {r!.liegen.length ? <><span className="fb-frage">Liegt schon länger</span><ul className="ws-liste">{r!.liegen.map((i) => <li key={i.id}>{i.titel}</li>)}</ul></> : <p className="muted small">Nichts liegt länger als eine Woche.</p>}
    </div>,
    <div key="e" className="ws-seite">
      <h2 className="ws-titel">Engpass</h2>
      <p className="ws-engpass">{w.engpass || 'Noch kein Engpass festgelegt.'}</p>
      <div className="fb-opts" role="radiogroup" aria-label="Engpass">
        <button type="button" role="radio" aria-checked={engpass === 'passt'} className="fb-chip" onClick={() => { setEngpass('passt'); setTimeout(() => blatt.current?.zu(2), 260); }}>Passt so</button>
        <button type="button" role="radio" aria-checked={engpass === 'neu'} className="fb-chip" onClick={() => setEngpass('neu')}>Neu setzen</button>
      </div>
      {engpass === 'neu' ? <textarea className="fb-text" rows={2} value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Der eine Engpass dieser Woche, gern diktiert" aria-label="Neuer Engpass" autoFocus /> : null}
    </div>,
    <div key="f" className="ws-seite">
      <h2 className="ws-titel">Drei Dinge der Woche</h2>
      <p className="muted small">{fokus.length} von 3 gewählt. Sie kommen in dieser Woche zuerst.</p>
      <div className="fb-opts stack" role="group" aria-label="Drei Dinge">
        {w.kandidaten.map((k) => <button key={k.id} type="button" aria-pressed={fokus.includes(k.id)} className="fb-chip left" disabled={!fokus.includes(k.id) && fokus.length >= 3} onClick={() => umschalten(k.id)}>{k.titel}{k.stapel === 'geparkt' ? ' · Parkplatz' : ''}</button>)}
      </div>
    </div>,
    <div key="p" className="ws-seite">
      <h2 className="ws-titel">Parkplatz</h2>
      {w.geparkt.length ? w.geparkt.map((g) => (
        <div key={g.id} className="fb-q">
          <span className="fb-frage">{g.titel}</span>
          <div className="fb-opts" role="radiogroup" aria-label={g.titel}>{PARK.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={park[g.id] === k} className="fb-chip" onClick={() => parken(g.id, k)}>{l}</button>)}</div>
        </div>
      )) : <p className="muted small">Der Parkplatz ist leer.</p>}
    </div>,
    <div key="x" className="ws-seite">
      <h2 className="ws-titel">Fertig</h2>
      <ul className="ws-liste">
        <li>Engpass: {engpass === 'neu' && neu.trim() ? neu.trim() : w.engpass || 'nicht festgelegt'}</li>
        <li>Drei Dinge: {fokus.length ? w.kandidaten.filter((k) => fokus.includes(k.id)).map((k) => k.titel).join(' · ') : 'keine gewählt'}</li>
        <li>Parkplatz: {Object.keys(park).length} von {w.geparkt.length} gesichtet</li>
      </ul>
      <button type="button" className="btn primary wide" onClick={abschliessen} disabled={busy}>{busy ? 'Speichert …' : 'Wochenstart abschließen'}</button>
    </div>,
  ] : [];

  return (
    <main className="wrap">
      <TopBar title="Wochenstart" back={{ label: 'Woche', href: '/woche' }} />
      <header className="head"><span className="eyebrow">{w ? `Woche ab ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(w.montag + 'T12:00:00Z'))}` : '…'}</span><h1 className="title">Wochenstart<i>.</i></h1></header>
      {w ? <div className="group pad"><Blaetter ref={blatt} seiten={seiten} label="Wochenstart" /></div> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
