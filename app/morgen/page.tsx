'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TabBar, TopBar, api, taskTitle, useToast, type Item, type Stand } from '../ui';
import { Blaetter, type BlaetterSteuerung } from '../blaetter';
import { BOEGEN } from '@/lib/fragen';

const ERHOLUNG = (BOEGEN.morgen.fragen[0] as Extract<(typeof BOEGEN.morgen.fragen)[number], { typ: 'skala' }>).werte;
const WOHIN: [string, string][] = [['jetzt', 'Heute'], ['woche', 'Diese Woche'], ['geparkt', 'Parken']];

/**
 * Morgen (0.27, Peter 29.10.2026): drei Schritte, zwei Minuten. Wie erholt du bist, was von gestern übrig ist, die eine Sache.
 * Speichert als Morgen-Check-in, damit Coach und Kompass weiter dieselben Antworten bekommen.
 */
export default function Morgen() {
  const [st, setSt] = useState<Stand | null>(null);
  const [erholung, setErholung] = useState<number | null>(null);
  const [wohin, setWohin] = useState<Record<string, string>>({});
  const [eins, setEins] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const blatt = useRef<BlaetterSteuerung>(null);
  const router = useRouter();
  useEffect(() => { api<Stand>('/api/heute').then(setSt).catch((e) => setToast((e as Error).message, 'err')); }, [setToast]);

  const jetzt = (st?.items ?? []).filter((i) => i.stapel === 'jetzt' && i.status !== 'erledigt').sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
  const erste = jetzt[0] ?? null;
  const heuteBleibt = jetzt.filter((i) => (wohin[i.id] ?? 'jetzt') === 'jetzt');

  async function fertig() {
    if (erholung === null) { setToast('Tipp zuerst an, wie erholt du bist.', 'err'); blatt.current?.zu(0); return; }
    setBusy(true);
    try {
      for (const [id, s] of Object.entries(wohin)) if (s !== 'jetzt') await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ stapel: s }) });
      if (eins && eins !== erste?.id && heuteBleibt.some((i) => i.id === eins)) await api(`/api/items/${eins}`, { method: 'PATCH', body: JSON.stringify({ eineSache: true }) });
      await api('/api/checkin', { method: 'POST', body: JSON.stringify({ art: 'morgen', antworten: { erholung: { wert: erholung } } }) });
      router.push('/?ritual=morgen');
    } catch (e) { setToast((e as Error).message, 'err'); setBusy(false); }
  }

  const zeile = (it: Item) => (
    <div key={it.id} className="fb-q">
      <span className="fb-frage">{taskTitle(it)}</span>
      <div className="fb-opts" role="radiogroup" aria-label={taskTitle(it)}>
        {WOHIN.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={(wohin[it.id] ?? 'jetzt') === k} className="fb-chip" onClick={() => setWohin({ ...wohin, [it.id]: k })}>{l}</button>)}
      </div>
    </div>
  );
  const seiten = st ? [
    <div key="e" className="ws-seite">
      <h2 className="ws-titel">Wie erholt fühlst du dich?</h2>
      <div className="fb-opts" role="radiogroup" aria-label="Wie erholt fühlst du dich?">
        {ERHOLUNG.map((v) => <button key={v.wert} type="button" role="radio" aria-checked={erholung === v.wert} className="fb-chip" onClick={() => { setErholung(v.wert); setTimeout(() => blatt.current?.weiter(), 260); }}>{v.label}</button>)}
      </div>
    </div>,
    <div key="g" className="ws-seite">
      <h2 className="ws-titel">Was von gestern übrig ist</h2>
      {jetzt.length ? <>{jetzt.map(zeile)}<p className="muted small">Was nicht heute sein muss, wandert in die Woche oder auf den Parkplatz.</p></> : <p className="muted small">Nichts liegt übrig. Ein freier Start.</p>}
    </div>,
    <div key="s" className="ws-seite">
      <h2 className="ws-titel">Die eine Sache</h2>
      {heuteBleibt.length ? (
        <>
          <p className="muted small">Durch welche Sache wird heute alles andere leichter?</p>
          <div className="fb-opts stack" role="radiogroup" aria-label="Die eine Sache">
            {heuteBleibt.map((it) => <button key={it.id} type="button" role="radio" aria-checked={(eins ?? erste?.id) === it.id} className="fb-chip left" onClick={() => setEins(it.id)}>{taskTitle(it)}</button>)}
          </div>
        </>
      ) : <p className="muted small">Heute ist nichts gesetzt. Halt fest, was dir durch den Kopf geht, Claude sortiert es ein.</p>}
      <button type="button" className="btn primary wide" onClick={fertig} disabled={busy}>{busy ? 'Speichert …' : 'Tag starten'}</button>
    </div>,
  ] : [];

  return (
    <main className="wrap">
      <TopBar title="Morgen" back={{ label: 'Heute', href: '/' }} />
      <header className="head"><span className="eyebrow">Zwei Minuten für den Tag</span><h1 className="title">Guten Morgen<i>.</i></h1></header>
      {st ? <div className="group pad"><Blaetter ref={blatt} seiten={seiten} label="Morgen" /></div> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
