'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Entry, TabBar, api, useToast, type Item } from './ui';

type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };

export default function Erfassen() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [toast, setToast] = useToast();
  const rec = useRef<Rec | null>(null);
  const base = useRef('');
  const area = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => { setItems(await api<Item[]>('/api/items?limit=20')); }, []);
  useEffect(() => { load().catch(() => setItems([])); }, [load]);
  // Solange etwas eingeordnet wird, alle 3 Sekunden nachsehen (höchstens 2 Minuten).
  useEffect(() => {
    if (!items?.some((i) => i.status === 'neu' && !i.fehler)) return;
    const t = setTimeout(() => load().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, [items, load]);
  useEffect(() => { setCanSpeak(typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)); }, []);

  async function save() {
    const t = text.trim(); if (!t || busy) return;
    rec.current?.stop();
    setBusy(true);
    try { await api('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) }); setText(''); setToast('Festgehalten'); await load(); }
    catch (e) { setToast('Nicht gespeichert: ' + (e as Error).message); }
    finally { setBusy(false); area.current?.focus(); }
  }

  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = true;
    base.current = text ? text.replace(/\s*$/, ' ') : '';
    r.onresult = (e) => {
      let finalT = ''; let interim = '';
      for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) finalT += res[0].transcript; else interim += res[0].transcript; }
      setText(base.current + finalT + interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setToast('Spracheingabe hier nicht verfügbar. Nimm das Mikrofon der Tastatur.'); };
    rec.current = r; r.start(); setListening(true);
  }

  return (
    <main className="wrap">
      <header className="head">
        <span className="eyebrow">{new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
        <h1 className="title">Lage<i>.</i></h1>
      </header>

      <section className="capture" aria-label="Festhalten">
        <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} placeholder="Gedanke, Zitat oder Link …" aria-label="Gedanke, Zitat oder Link" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }} />
        <div className="row">
          <span className="hint">{listening ? 'Ich höre zu …' : 'Sprechen: Mikrofon oder Tastatur-Diktat'}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            {canSpeak ? <button type="button" className={'btn mic' + (listening ? ' on' : '')} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button> : null}
            <button type="button" className="btn primary" onClick={save} disabled={!text.trim() || busy}>{busy ? 'Speichert …' : 'Festhalten'}</button>
          </span>
        </div>
      </section>

      <section className="section" aria-label="Logbuch">
        <h2>Logbuch <small>Claude ordnet jeden Eintrag ein</small></h2>
        {items === null ? <div className="empty">Lädt …</div> : items.length === 0 ? <div className="empty">Noch nichts festgehalten. Der erste Gedanke gehört oben ins Feld.</div> : (
          <ul className="log">{items.map((it) => <Entry key={it.id} it={it} />)}</ul>
        )}
      </section>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <TabBar />
    </main>
  );
}
