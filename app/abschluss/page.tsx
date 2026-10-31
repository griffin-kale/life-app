'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TabBar, TaskRow, TopBar, api, taskTitle, useToast, type Item, type Stand } from '../ui';
import { Blaetter, type BlaetterSteuerung } from '../blaetter';
import { BOEGEN, type Frage } from '@/lib/fragen';

const fragen = BOEGEN.abend.fragen;
const TAG = (fragen.find((f) => f.id === 'tag') as Extract<Frage, { typ: 'skala' }>).werte;
const KRAFT = (fragen.find((f) => f.id === 'kraft') as Extract<Frage, { typ: 'mehrfach' }>).optionen;
const WOHIN: [string, string][] = [['jetzt', 'Morgen früh'], ['woche', 'Diese Woche'], ['geparkt', 'Parken']];

/**
 * Abschluss (0.27, Peter 29.10.2026): drei Schritte, zwei Minuten. Abhaken, Offenes verteilen, ein Wort zum Tag.
 * Speichert als Abend-Check-in: Tag, Kraft, Plan für morgen (das erste „Morgen früh“), drei gute Dinge.
 */
export default function Abschluss() {
  const [st, setSt] = useState<Stand | null>(null);
  const [wohin, setWohin] = useState<Record<string, string>>({});
  const [tag, setTag] = useState<number | null>(null);
  const [kraft, setKraft] = useState<string[]>([]);
  const [gut, setGut] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const blatt = useRef<BlaetterSteuerung>(null);
  const router = useRouter();
  const laden = () => api<Stand>('/api/heute').then(setSt).catch((e) => setToast((e as Error).message, 'err'));
  useEffect(() => { laden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const offen = (st?.items ?? []).filter((i) => i.stapel === 'jetzt' && i.status !== 'erledigt').sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
  async function abhaken(it: Item) {
    try { await api(`/api/items/${it.id}`, { method: 'PATCH', body: JSON.stringify({ erledigt: it.status !== 'erledigt' }) }); await laden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function fertig() {
    if (tag === null) { setToast('Tipp an, wie der Tag war.', 'err'); return; }
    setBusy(true);
    try {
      for (const [id, s] of Object.entries(wohin)) if (s !== 'jetzt') await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ stapel: s }) });
      const morgen = offen.find((i) => (wohin[i.id] ?? 'jetzt') === 'jetzt');
      const antworten: Record<string, unknown> = { tag: { wert: tag } };
      if (kraft.length) antworten.kraft = { auswahl: kraft };
      if (morgen) antworten.plan = { aufgabe: taskTitle(morgen), zeit: 'gleich morgens' };
      if (gut.trim()) antworten.gut = { text: gut };
      await api('/api/checkin', { method: 'POST', body: JSON.stringify({ art: 'abend', antworten }) });
      router.push('/?ritual=abschluss');
    } catch (e) { setToast((e as Error).message, 'err'); setBusy(false); }
  }

  const erledigt = st?.erledigtHeute ?? [];
  const seiten = st ? [
    <div key="k" className="ws-seite">
      <h2 className="ws-titel">Was heute geklappt hat</h2>
      <p className="muted small">{erledigt.length ? `${erledigt.length} ${erledigt.length === 1 ? 'Sache' : 'Sachen'} erledigt.` : 'Noch nichts abgehakt.'} Hak ab, was du geschafft hast.</p>
      {offen.length || erledigt.length ? <ul className="tasks group">{[...offen, ...erledigt].map((it) => <TaskRow key={it.id} it={it} onToggle={() => abhaken(it)} />)}</ul> : null}
    </div>,
    <div key="w" className="ws-seite">
      <h2 className="ws-titel">Wo du morgen weitermachst</h2>
      {offen.length ? offen.map((it) => (
        <div key={it.id} className="fb-q">
          <span className="fb-frage">{taskTitle(it)}</span>
          <div className="fb-opts" role="radiogroup" aria-label={taskTitle(it)}>
            {WOHIN.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={(wohin[it.id] ?? 'jetzt') === k} className="fb-chip" onClick={() => setWohin({ ...wohin, [it.id]: k })}>{l}</button>)}
          </div>
        </div>
      )) : <p className="muted small">Alles von heute ist erledigt.</p>}
      <p className="muted small">Du legst fest, wo du morgen anfängst. Dann kann der Kopf heute zumachen.</p>
    </div>,
    <div key="t" className="ws-seite">
      <h2 className="ws-titel">Wie war der Tag?</h2>
      <div className="fb-opts" role="radiogroup" aria-label="Wie war der Tag?">
        {TAG.map((v) => <button key={v.wert} type="button" role="radio" aria-checked={tag === v.wert} className="fb-chip" onClick={() => setTag(v.wert)}>{v.label}</button>)}
      </div>
      <span className="fb-frage">Was hat Kraft gekostet?</span>
      <div className="fb-opts" role="group" aria-label="Was hat Kraft gekostet?">
        {KRAFT.map((o) => <button key={o} type="button" aria-pressed={kraft.includes(o)} className="fb-chip" onClick={() => setKraft(kraft.includes(o) ? kraft.filter((x) => x !== o) : [...kraft, o])}>{o}</button>)}
      </div>
      <span className="fb-frage">Drei gute Dinge von heute</span>
      <textarea className="fb-text" rows={3} value={gut} onChange={(e) => setGut(e.target.value)} placeholder="Etwas dazu sagen, gern diktiert, eins pro Zeile" aria-label="Drei gute Dinge von heute" maxLength={1500} />
      <button type="button" className="btn primary wide" onClick={fertig} disabled={busy}>{busy ? 'Speichert …' : 'Tag abschließen'}</button>
    </div>,
  ] : [];

  return (
    <main className="wrap">
      <TopBar title="Abschluss" back={{ label: 'Heute', href: '/' }} />
      <header className="head"><span className="eyebrow">Zwei Minuten, dann ist der Tag zu</span><h1 className="title">Abschluss<i>.</i></h1></header>
      {st ? <div className="group pad"><Blaetter ref={blatt} seiten={seiten} label="Abschluss" /></div> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
