'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';
import { Blaetter, type BlaetterSteuerung } from '../blaetter';
import { FARBE, KONTEN, NAME, Ring } from '../ringe';
import { BOEGEN, type Antwort } from '@/lib/fragen';
import { BEREICH_TITEL, ZIEL_IDEEN, type Bewertung, type SBereich } from '@/lib/saison-regeln';
import type { SaisonStand } from '@/lib/saison';

type Kurz = { id: string; titel: string; stapel: string | null };
type W = {
  montag: string; offen: boolean; rueckblick: { ringe: Record<string, number | null> | null; alleZu: boolean; erledigt: number; liegen: Kurz[] }; engpass: string; kandidaten: Kurz[]; geparkt: Kurz[]; fokus: string[]; wochenziel: string;
  fokusWoche: { bloecke: number; minuten: number }; geld: string; geldWarnungen: string[]; who5Faellig: boolean; who5Erledigt: boolean;
};
const BEW: [Bewertung, string][] = [['kurs', 'auf Kurs'], ['anpassen', 'anpassen'], ['daneben', 'daneben']];
const WOCHE_BOGEN = BOEGEN.woche.fragen;
const PARK: [string, string][] = [['woche', 'In die Woche'], ['bleibt', 'Liegen lassen'], ['streichen', 'Streichen']];

/**
 * Wochenrunde (0.27, ersetzt Wochenstart und Wochenbogen): Rückblick, Hebel der Saison, Engpass, drei Dinge, Geld-Check,
 * alle zwei Wochen „Wie geht es dir?“ mit WHO-5, Parkplatz. Eine Seite pro Schritt, alles zum Antippen.
 */
export default function Wochenstart() {
  const [w, setW] = useState<W | null>(null);
  const [engpass, setEngpass] = useState<'passt' | 'neu' | null>(null);
  const [neu, setNeu] = useState('');
  const [fokus, setFokus] = useState<string[]>([]);
  const [park, setPark] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ziel, setZiel] = useState('');
  const [eigen, setEigen] = useState('');
  const [toast, setToast] = useToast();
  const [saison, setSaison] = useState<SaisonStand | null>(null);
  const [bewertet, setBewertet] = useState<Record<number, Bewertung>>({});
  const [neuerHebel, setNeuerHebel] = useState<Record<number, string>>({});
  const [neuesZiel, setNeuesZiel] = useState<Record<string, string>>({});
  const [wie, setWie] = useState<Record<string, Antwort>>({});
  const saisonLaden = () => api<{ saison: SaisonStand | null }>('/api/saison').then((r) => setSaison(r.saison)).catch(() => {});
  useEffect(() => { saisonLaden(); }, []);
  const blatt = useRef<BlaetterSteuerung>(null);
  const router = useRouter();
  useEffect(() => { api<W>('/api/wochenstart').then((x) => { setW(x); setFokus(x.fokus); setZiel(x.wochenziel); }).catch((e) => setToast((e as Error).message, 'err')); }, [setToast]);

  const umschalten = (id: string) => setFokus((f) => (f.includes(id) ? f.filter((x) => x !== id) : f.length >= 3 ? f : [...f, id]));
  async function parken(id: string, wohin: string) {
    setPark((p) => ({ ...p, [id]: wohin }));
    if (wohin === 'bleibt') return;
    try { await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(wohin === 'woche' ? { stapel: 'woche' } : { status: 'archiv' }) }); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function eigenesDazu() {
    const t = eigen.trim(); if (!t || !w) return;
    try {
      const r = await api<{ id: string }>('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) });
      setW({ ...w, kandidaten: [{ id: r.id, titel: t.slice(0, 80), stapel: null }, ...w.kandidaten] });
      setFokus((f) => (f.length >= 3 ? f : [...f, r.id])); setEigen('');
    } catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function bewerten(id: number, b: Bewertung) {
    setBewertet((x) => ({ ...x, [id]: b }));
    try { await api(`/api/saison/hebel/${id}`, { method: 'PATCH', body: JSON.stringify({ bewertung: b }) }); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function hebelDazu(zielId: number) {
    const t = (neuerHebel[zielId] ?? '').trim(); if (t.length < 3) return;
    try { await api(`/api/saison/ziele/${zielId}`, { method: 'POST', body: JSON.stringify({ titel: t }) }); setNeuerHebel({ ...neuerHebel, [zielId]: '' }); saisonLaden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function hebelWeg(id: number) {
    try { await api(`/api/saison/hebel/${id}`, { method: 'DELETE' }); saisonLaden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function zielDazu(bereich: SBereich, titel: string) {
    if (titel.trim().length < 3) return;
    try { await api('/api/saison/ziele', { method: 'POST', body: JSON.stringify({ bereich, titel }) }); setNeuesZiel({ ...neuesZiel, [bereich]: '' }); saisonLaden(); setToast('Ziel ergänzt'); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  const wieVollstaendig = WOCHE_BOGEN.every((f) => f.typ !== 'skala' || !f.pflicht || wie[f.id]?.wert !== undefined);
  async function abschliessen() {
    setBusy(true);
    try {
      if (w?.who5Faellig && !w.who5Erledigt && wieVollstaendig) await api('/api/checkin', { method: 'POST', body: JSON.stringify({ art: 'woche', antworten: wie }) });
      if (engpass === 'neu' && neu.trim()) await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'engpass', text: neu }) });
      // Geparktes aus den drei Dingen kommt in die Woche
      for (const id of fokus) if (w?.geparkt.some((g) => g.id === id) && !park[id]) await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ stapel: 'woche' }) });
      await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'fokus', ids: fokus }) });
      if (ziel.trim() && ziel.trim() !== w?.wochenziel) await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'wochenziel', text: ziel }) });
      await api('/api/wochenstart', { method: 'POST', body: JSON.stringify({ aktion: 'fertig' }) });
      api('/api/heute', { method: 'POST' }).catch(() => {});
      router.push('/woche?wochenrunde=fertig');
    } catch (e) { setToast((e as Error).message, 'err'); setBusy(false); }
  }

  const r = w?.rueckblick;
  const seiten = w ? [
    <div key="r" className="ws-seite">
      <h2 className="ws-titel">Rückblick</h2>
      <p className="muted small">Letzte Woche: {r!.erledigt} erledigt{w.fokusWoche.bloecke ? `, ${w.fokusWoche.bloecke} Fokusblöcke mit ${w.fokusWoche.minuten} Minuten` : ''}{r!.alleZu ? ', alle fünf Ringe zu' : ''}.</p>
      {saison && saison.woche >= 1 ? <p className="muted small">Saison {saison.name}, Woche {saison.woche} von 12.</p> : null}
      {r!.ringe ? <div className="ringreihe">{KONTEN.map((x) => <span key={x} className="ringzelle"><Ring wert={r!.ringe![x]} farbe={FARBE[x]} groesse={48} dicke={6} label={`${NAME[x]} letzte Woche`} /><b>{NAME[x]}</b></span>)}</div> : null}
      {r!.liegen.length ? <><span className="fb-frage">Liegt schon länger</span><ul className="ws-liste">{r!.liegen.map((i) => <li key={i.id}>{i.titel}</li>)}</ul></> : <p className="muted small">Nichts liegt länger als eine Woche.</p>}
    </div>,
    ...(saison ? [<div key="h" className="ws-seite">
      <h2 className="ws-titel">Wie liefen die Hebel?</h2>
      <p className="muted small">Je Hebel ein Tipp für diese Woche. Die Zielkarten zeigen die Farbe.</p>
      {saison.ziele.map((z) => (
        <div key={z.id} className="fb-q sz-blatt-bereich">
          <span className="fb-frage">{z.titel}</span>
          {z.hebel.map((h) => (
            <div key={h.id} className="wr-hebel">
              <div className="wr-hkopf"><span>{h.titel}</span><button type="button" className="chipbtn" aria-label={`Hebel entfernen: ${h.titel}`} onClick={() => hebelWeg(h.id)}>{Icon.close}</button></div>
              <div className="fb-opts" role="radiogroup" aria-label={h.titel}>
                {BEW.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={(bewertet[h.id] ?? null) === k} className="fb-chip" onClick={() => bewerten(h.id, k)}>{l}</button>)}
              </div>
            </div>
          ))}
          {z.hebel.length < 3 ? (
            <div className="geld-neu">
              <input value={neuerHebel[z.id] ?? ''} onChange={(e) => setNeuerHebel({ ...neuerHebel, [z.id]: e.target.value })} placeholder="Etwas dazu sagen: neuer Hebel" aria-label={`Neuer Hebel für ${z.titel}`} maxLength={80} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hebelDazu(z.id); } }} />
              <button type="button" className="chipbtn" disabled={(neuerHebel[z.id] ?? '').trim().length < 3} onClick={() => hebelDazu(z.id)}>Dazu</button>
            </div>
          ) : null}
        </div>
      ))}
      {saison.leer.length ? (
        <details className="wr-leer">
          <summary>Ein Ziel ergänzen ({saison.leer.map((b) => BEREICH_TITEL[b]).join(', ')})</summary>
          {saison.leer.map((b) => (
            <div key={b} className="fb-q">
              <span className="fb-frage">{BEREICH_TITEL[b]}</span>
              <div className="fb-opts">{ZIEL_IDEEN[b].map((t) => <button key={t} type="button" className="fb-chip" onClick={() => zielDazu(b, t)}>{t}</button>)}</div>
              <div className="geld-neu">
                <input value={neuesZiel[b] ?? ''} onChange={(e) => setNeuesZiel({ ...neuesZiel, [b]: e.target.value })} placeholder="Etwas dazu sagen: eigenes Ziel" aria-label={`Neues Ziel ${BEREICH_TITEL[b]}`} maxLength={80} />
                <button type="button" className="chipbtn" disabled={(neuesZiel[b] ?? '').trim().length < 3} onClick={() => zielDazu(b, neuesZiel[b] ?? '')}>Nehmen</button>
              </div>
            </div>
          ))}
        </details>
      ) : null}
    </div>] : []),
    <div key="e" className="ws-seite">
      <h2 className="ws-titel">Engpass</h2>
      <p className="ws-engpass">{w.engpass || 'Noch kein Engpass festgelegt.'}</p>
      {!w.engpass ? <p className="muted small">Du weißt nicht, was dich gerade bremst? <Link href="/stand/3" className="linkbtn">Leite ihn mit dem Coach her</Link>, das dauert zwölf Minuten.</p> : null}
      <div className="fb-opts" role="radiogroup" aria-label="Engpass">
        <button type="button" role="radio" aria-checked={engpass === 'passt'} className="fb-chip" onClick={() => { setEngpass('passt'); setTimeout(() => blatt.current?.weiter(), 260); }}>Passt so</button>
        <button type="button" role="radio" aria-checked={engpass === 'neu'} className="fb-chip" onClick={() => setEngpass('neu')}>Neu setzen</button>
      </div>
      {engpass === 'neu' ? <textarea className="fb-text" rows={2} value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Der eine Engpass dieser Woche, gern diktiert" aria-label="Neuer Engpass" autoFocus /> : null}
    </div>,
    <div key="f" className="ws-seite">
      <h2 className="ws-titel">Drei Dinge der Woche</h2>
      <span className="fb-frage">Wochenziel</span>
      <textarea className="fb-text" rows={2} value={ziel} onChange={(e) => setZiel(e.target.value)} placeholder="Was bis Freitag geschafft sein soll, in einem Satz" aria-label="Wochenziel" />
      <span className="fb-frage">Drei Dinge, die darauf einzahlen</span>
      <p className="muted small">{fokus.length} von 3 gewählt. Sie kommen in dieser Woche zuerst.</p>
      {w.kandidaten.length ? (
        <div className="fb-opts stack" role="group" aria-label="Drei Dinge">
          {w.kandidaten.map((k) => <button key={k.id} type="button" aria-pressed={fokus.includes(k.id)} className="fb-chip left" disabled={!fokus.includes(k.id) && fokus.length >= 3} onClick={() => umschalten(k.id)}>{k.titel}{k.stapel === 'geparkt' ? ' · Parkplatz' : !k.stapel ? ' · neu' : ''}</button>)}
        </div>
      ) : <p className="muted small">Gerade liegen keine offenen Aufgaben in Life. Schreib die drei Dinge selbst dazu.</p>}
      <div className="geld-neu">
        <input value={eigen} onChange={(e) => setEigen(e.target.value)} placeholder="Eigenes Ding, gern diktiert" aria-label="Eigenes Ding der Woche" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); eigenesDazu(); } }} />
        <button type="button" className="geld-plus" aria-label="Dazunehmen" disabled={!eigen.trim() || fokus.length >= 3} onClick={eigenesDazu}>{Icon.plus}</button>
      </div>
    </div>,
    <div key="g" className="ws-seite">
      <h2 className="ws-titel">Geld-Check</h2>
      <p className="ws-engpass">{w.geld || 'Noch keine Wochentöpfe. Mit Töpfen siehst du hier, wo du stehst.'}</p>
      {w.geldWarnungen.length ? <ul className="ws-liste">{w.geldWarnungen.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      <Link href="/geld" className="linkbtn">Töpfe ansehen</Link>
    </div>,
    ...(w.who5Faellig && !w.who5Erledigt ? [<div key="w" className="ws-seite">
      <h2 className="ws-titel">Wie geht es dir?</h2>
      <p className="muted small">Alle zwei Wochen, etwa zwei Minuten. Die ersten fünf Fragen sind der WHO-5 und beziehen sich auf die letzten zwei Wochen. Darf leer bleiben.</p>
      {WOCHE_BOGEN.map((f) => (
        <div key={f.id} className="fb-q">
          <span className="fb-frage">{f.frage}</span>
          <div className="fb-opts" role="radiogroup" aria-label={f.frage}>
            {f.typ === 'skala' ? f.werte.map((v) => <button key={v.wert} type="button" role="radio" aria-checked={wie[f.id]?.wert === v.wert} className="fb-chip" onClick={() => setWie({ ...wie, [f.id]: { wert: v.wert } })}>{v.label}</button>)
              : f.typ === 'mehrfach' ? f.optionen.map((o) => <button key={o} type="button" role="radio" aria-checked={wie[f.id]?.auswahl?.[0] === o} className="fb-chip" onClick={() => setWie({ ...wie, [f.id]: { auswahl: [o] } })}>{o}</button>) : null}
          </div>
        </div>
      ))}
    </div>] : []),
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
        <li>Wochenziel: {ziel.trim() || 'nicht festgelegt'}</li>
        <li>Drei Dinge: {fokus.length ? w.kandidaten.filter((k) => fokus.includes(k.id)).map((k) => k.titel).join(' · ') : 'keine gewählt'}</li>
        <li>Parkplatz: {Object.keys(park).length} von {w.geparkt.length} gesichtet</li>
        {saison ? <li>Hebel bewertet: {Object.keys(bewertet).length} von {saison.ziele.reduce((n, z) => n + z.hebel.length, 0)}</li> : null}
        {w.who5Faellig && !w.who5Erledigt ? <li>Wie geht es dir: {wieVollstaendig ? 'beantwortet' : 'übersprungen'}</li> : null}
      </ul>
      <button type="button" className="btn primary wide" onClick={abschliessen} disabled={busy}>{busy ? 'Speichert …' : 'Wochenrunde abschließen'}</button>
    </div>,
  ] : [];

  return (
    <main className="wrap">
      <TopBar title="Wochenrunde" back={{ label: 'Plan', href: '/woche' }} />
      <header className="head"><span className="eyebrow">{w ? `Woche ab ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(w.montag + 'T12:00:00Z'))}` : '…'}</span><h1 className="title">Wochenrunde<i>.</i></h1></header>
      {w ? <div className="group pad"><Blaetter ref={blatt} seiten={seiten} label="Wochenrunde" /></div> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
