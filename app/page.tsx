'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Log, TabBar, TopBar, api, isPending, useToast, type Item } from './ui';

type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };

export default function Erfassen() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [toast, setToast] = useToast();
  const rec = useRef<Rec | null>(null);
  const base = useRef('');
  const area = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => { setItems(await api<Item[]>('/api/items?limit=30')); }, []);
  useEffect(() => { load().catch(() => setItems([])); }, [load]);
  // Solange Claude etwas einordnet, alle 3 Sekunden nachsehen.
  useEffect(() => {
    if (!items?.some(isPending)) return;
    const t = setTimeout(() => load().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, [items, load]);
  useEffect(() => { const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setCanSpeak(!!(W.SpeechRecognition || W.webkitSpeechRecognition)); }, []);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1400); return () => clearTimeout(t); }, [done]);

  async function save() {
    const t = text.trim(); if (!t || busy) return;
    rec.current?.stop();
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) });
      setText(''); setFreshId(r.id); setDone(true);
      await load();
    } catch (e) { setToast('Nicht gespeichert. ' + (e as Error).message, 'err'); }
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
    r.onerror = () => { setListening(false); setToast('Spracheingabe geht hier nicht. Nimm das Mikrofon der Tastatur.', 'err'); };
    rec.current = r; r.start(); setListening(true);
  }

  const today = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const hasText = !!text.trim();

  return (
    <main className="wrap">
      <TopBar title="Lage" />
      <header className="head">
        <span className="eyebrow">{today}</span>
        <h1 className="title">Lage<i>.</i></h1>
      </header>

      <section className="capture" aria-label="Festhalten">
        <textarea ref={area} value={text} onChange={(e) => { setText(e.target.value); if (done) setDone(false); }} placeholder="Was geht dir durch den Kopf?" aria-label="Gedanke, Zitat oder Link" autoFocus enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }} />
        <div className="row">
          <span className={'hint' + (listening ? ' live' : '')} aria-live="polite">
            {listening ? <><span className="rec" />Ich höre zu</> : null}
          </span>
          <span className="tools">
            {canSpeak ? (
              <button type="button" className={'btn mic' + (listening ? ' on' : '')} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'}>
                {listening ? Icon.stop : Icon.mic}
              </button>
            ) : null}
            <button type="button" className={'btn primary' + (done ? ' done' : '')} onClick={save} disabled={(!hasText && !done) || busy}>
              {done ? <>{Icon.check}Festgehalten</> : busy ? 'Speichert …' : 'Festhalten'}
            </button>
          </span>
        </div>
      </section>

      <section className="section" aria-label="Logbuch">
        <h2>Logbuch</h2>
        {items === null ? <div className="loading">Lädt …</div>
          : items.length === 0 ? <div className="empty"><b>Noch leer.</b>Schreib oder sprich oben den ersten Gedanken. Claude ordnet ihn ein und schlägt den nächsten Schritt vor.</div>
          : <Log items={items} freshId={freshId} />}
      </section>
      {toast}
      <TabBar />
    </main>
  );
}
