'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Log, TabBar, TaskRow, TimeChip, TopBar, api, fTime, isPending, useBreit, useToast, type Item, type Stand } from './ui';
import { Fragebogen } from './fragebogen';
import { Coach, useCheckins } from './coach';
import { FARBE, KONTEN, NAME, Ring, Tagespunkte, Weg } from './ringe';
import { GeldKurz, KoerperKurz, MenschenKurz, useKurz } from './kurz';
import { Schnellzugriff } from './schnell';
import { bausteineAus, type Baustein } from '@/lib/heute-bausteine';
import { EnergieChips, WennChip } from './wenn';

type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };

/** Auf iPad und Mac stehen diese Bausteine rechts, alles zum Tun links. */
const RECHTS: Baustein[] = ['coach', 'kompass', 'koerper', 'geld', 'menschen'];
type KompassKurz = { jetzt: { ringe: Record<string, number | null> }; gesamt: { level: number; naechstes: number; anteil: number }; tage: { tag: string; wert: number | null }[] };

const nachZeit = (a: Item, b: Item) => (a.zeit && b.zeit ? a.zeit.localeCompare(b.zeit) : a.zeit ? -1 : b.zeit ? 1 : (a.rang ?? 99) - (b.rang ?? 99));

export default function Heute() {
  const [st, setSt] = useState<Stand | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [toast, setToast] = useToast();
  const ci = useCheckins();
  const [kompass, setKompass] = useState<KompassKurz | null>(null);
  useEffect(() => { api<KompassKurz>('/api/kompass').then(setKompass).catch(() => {}); }, []);
  const ringe = kompass?.jetzt.ringe ?? null;
  const [bausteine, setBausteine] = useState<Baustein[]>(() => bausteineAus(null));
  const [feldOffen, setFeldOffen] = useState(false);
  const breit = useBreit(768);
  useEffect(() => { api<{ bausteine: Baustein[] }>('/api/heute/bausteine').then((r) => setBausteine(bausteineAus(r.bausteine))).catch(() => {}); }, []);
  const kurz = useKurz(bausteine);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('festhalten') !== '1') return;
    window.history.replaceState(null, '', '/');
    const t = setTimeout(() => { const f = document.querySelector<HTMLTextAreaElement>('section[aria-label="Festhalten"] textarea'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } else setFeldOffen(true); }, 300);
    return () => clearTimeout(t);
  }, []);
  const rec = useRef<Rec | null>(null);
  const base = useRef('');

  const load = useCallback(async () => { setSt(await api<Stand>('/api/heute')); }, []);
  useEffect(() => { load().catch((e) => setToast((e as Error).message, 'err')); }, [load, setToast]);
  // Während Claude einordnet oder sortiert: nachsehen, bis es fertig ist.
  useEffect(() => {
    if (!st || !(st.laeuft || st.zuletzt.some(isPending))) return;
    const t = setTimeout(() => load().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [st, load]);
  useEffect(() => { const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setCanSpeak(!!(W.SpeechRecognition || W.webkitSpeechRecognition)); }, []);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1400); return () => clearTimeout(t); }, [done]);

  function patch(id: string, body: Record<string, unknown>) {
    return api<Item & { verdraengt?: string | null }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  async function act(fn: () => Promise<unknown>) {
    try { await fn(); } catch (e) { setToast((e as Error).message, 'err'); } finally { await load().catch(() => {}); }
  }
  const pause = () => new Promise((r) => setTimeout(r, 320));

  function toggle(it: Item) {
    const fertig = it.status !== 'erledigt';
    if (fertig) setLeaving(it.id);
    act(async () => {
      await patch(it.id, { erledigt: fertig });
      if (fertig) { await pause(); setToast('Erledigt', 'ok', { label: 'Rückgängig', run: () => act(() => patch(it.id, { erledigt: false })) }); }
    }).finally(() => setLeaving(null));
  }
  function spaeter(it: Item) {
    setLeaving(it.id);
    act(async () => {
      await patch(it.id, { stapel: 'woche' });
      await pause();
      setToast('In die Woche geschoben', 'ok', { label: 'Rückgängig', run: () => act(() => patch(it.id, { stapel: 'jetzt' })) });
    }).finally(() => setLeaving(null));
  }
  function holen(it: Item) {
    act(async () => {
      const r = await patch(it.id, { stapel: 'jetzt' });
      setToast(r.verdraengt ? `„${r.verdraengt.slice(0, 40)}“ rückt in die Woche` : 'Nach Jetzt geholt');
    });
  }
  function zeit(it: Item, v: string) {
    setSt((s) => s && { ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, zeit: v || null } : x)) });
    act(() => patch(it.id, { zeit: v }));
  }
  function neuSortieren() {
    setSt((s) => s && { ...s, laeuft: true });
    act(() => api('/api/heute', { method: 'POST' }));
  }

  async function save() {
    const t = text.trim(); if (!t || busy) return;
    rec.current?.stop();
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) });
      setText(''); setFreshId(r.id); setDone(true); setFeldOffen(false);
      await load();
    } catch (e) { setToast('Nicht gespeichert. ' + (e as Error).message, 'err'); }
    finally { setBusy(false); }
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

  const heuteTag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const today = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const items = st?.items ?? [];
  const jetzt = items.filter((i) => i.stapel === 'jetzt').sort(nachZeit);
  const naechste = items.filter((i) => i.stapel === 'woche').sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99)).slice(0, 3);
  const neu = items.filter((i) => !i.stapel).length;

  // Gedanke aus dem Plus, ⌘N oder ?festhalten=1: Feld öffnen und hineinspringen
  function gedanke() {
    if (bausteine.includes('festhalten')) { const t = document.querySelector<HTMLTextAreaElement>('section[aria-label="Festhalten"] textarea'); t?.focus(); t?.scrollIntoView({ block: 'center' }); }
    else setFeldOffen(true);
  }
  const bloecke: Partial<Record<Baustein, React.ReactNode>> = {
    kompass: (
ringe ? (() => {
        const werte = KONTEN.map((x) => ringe[x]).filter((v): v is number => v !== null);
        const schnitt = werte.length ? Math.round((werte.reduce((a, b) => a + Math.min(1, b), 0) / werte.length) * 100) : null;
        return (
          <Link href="/kompass" className="group kompass-karte" aria-label={`Kompass: diese Woche ${schnitt ?? 0} Prozent`}>
            <span className="kk-kopf"><b>Diese Woche</b><span>{schnitt !== null ? <><em className="num">{schnitt} %</em> · </> : null}Kompass{Icon.chevronRight}</span></span>
            <span className="ringreihe">{KONTEN.map((x) => (
              <span key={x} className="ringzelle"><Ring wert={ringe[x]} farbe={FARBE[x]} groesse={50} dicke={6} label={`${NAME[x]}: ${ringe[x] === null ? 'noch keine Daten' : Math.round(Math.min(1, ringe[x]!) * 100) + ' Prozent'}`} /><b>{NAME[x]}</b></span>
            ))}</span>
            {kompass ? <Weg anteil={kompass.gesamt.anteil} level={kompass.gesamt.level} naechstes={kompass.gesamt.naechstes} /> : null}
          </Link>
        );
      })() : null
    ),
    fragebogen: (
ci.zeige ? (
        <section className="gsec" aria-label="Fragebogen">
          <Fragebogen key={ci.zeige} art={ci.zeige} aufgaben={ci.aufgaben} onFertig={() => { ci.fertig(); setToast('Danke. Der Coach meldet sich gleich.'); }} onFehler={(m) => setToast(m, 'err')} />
        </section>
      ) : null
    ),
    festhalten: (
<><section className="capture compact" aria-label="Festhalten">
        <textarea value={text} onChange={(e) => { setText(e.target.value); if (done) setDone(false); }} placeholder="Was geht dir durch den Kopf?" aria-label="Gedanke, Aufgabe, Zitat oder Link" autoFocus={feldOffen}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }} />
        <div className="row">
          <span className={'hint' + (listening ? ' live' : '')} aria-live="polite">{listening ? <><span className="rec" />Ich höre zu</> : null}</span>
          <span className="tools">
            {canSpeak ? (
              <button type="button" className={'btn mic' + (listening ? ' on' : '')} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'}>
                {listening ? Icon.stop : Icon.mic}
              </button>
            ) : null}
            <button type="button" className={'btn primary' + (done ? ' done' : '')} onClick={save} disabled={(!text.trim() && !done) || busy}>
              {done ? <>{Icon.check}Festgehalten</> : busy ? 'Speichert …' : 'Festhalten'}
            </button>
          </span>
        </div>
      </section></>
    ),
    jetzt: (
<><section className="gsec" aria-label="Jetzt dran">
        <h2 className="glabel">Jetzt dran</h2>
        {st === null ? <div className="loading">Lädt …</div>
          : jetzt.length ? (
            <ul className="tasks group">
              {jetzt.map((it, n) => (
                <TaskRow key={it.id} it={it} big={n === 0} onToggle={() => toggle(it)} leaving={leaving === it.id}>
                  <TimeChip value={it.zeit} onChange={(v) => zeit(it, v)} />
                  <button type="button" className="chipbtn" onClick={() => spaeter(it)}>Nicht heute</button>
                  <WennChip aufgabe={it.schritt || it.titel || it.text.slice(0, 80)} wert={it.wenn} onSetzen={(w) => act(() => patch(it.id, { wenn: w }))} />
                  {it.wenn ? <span className="wenn-satz">{it.wenn}</span> : null}
                </TaskRow>
              ))}
            </ul>
          )
          : st.laeuft ? <div className="group pad"><p className="note working">Claude sortiert deinen Tag …</p></div>
          : <div className="group pad"><p className="muted small">{items.length ? 'Für heute ist nichts gesetzt.' : 'Nichts offen. Halte oben fest, was ansteht. Claude sortiert es ein.'}</p></div>}
        {st?.fehler ? <p className="gnote bad">Sortieren hat nicht geklappt: {st.fehler}</p> : null}
        {st && items.length > 0 ? (
          <p className="gnote">
            {st.laeuft ? <span className="working">Claude sortiert …</span> : st.sortiertAm ? `Sortiert um ${fTime(st.sortiertAm)}` : 'Noch nicht sortiert'}
            {neu && !st.laeuft ? ` · ${neu} neu` : ''}
            {' · '}<button type="button" className="linkbtn" onClick={neuSortieren} disabled={st.laeuft}>Neu sortieren</button>
          </p>
        ) : null}
      </section></>
    ),
    naechste: (
naechste.length ? (
        <section className="gsec" aria-label="Als Nächstes">
          <h2 className="glabel">Als Nächstes</h2>
          <ul className="tasks group">
            {naechste.map((it) => (
              <TaskRow key={it.id} it={it} onToggle={() => toggle(it)} leaving={leaving === it.id}>
                <button type="button" className="chipbtn" onClick={() => holen(it)}>{Icon.up}Nach Jetzt</button>
              </TaskRow>
            ))}
          </ul>
          <p className="gnote"><Link href="/woche" className="linkbtn">Ganze Woche ansehen</Link></p>
        </section>
      ) : null
    ),
    erledigt: (
st?.erledigtHeute.length ? (
        <section className="gsec" aria-label="Heute erledigt">
          <h2 className="glabel">Heute erledigt · {st.erledigtHeute.length}</h2>
          <ul className="tasks group">{st.erledigtHeute.map((it) => <TaskRow key={it.id} it={it} onToggle={() => toggle(it)}><EnergieChips wert={it.energie} onSetzen={(n) => act(() => patch(it.id, { energie: n }))} /></TaskRow>)}</ul>
        </section>
      ) : null
    ),
    coach: <Coach stand={ci} />,
    schnell: <Schnellzugriff onGedanke={gedanke} />,
    koerper: kurz.koerper ? <KoerperKurz k={kurz.koerper} /> : null,
    geld: kurz.geld ? <GeldKurz g={kurz.geld} /> : null,
    menschen: kurz.menschen ? <MenschenKurz m={kurz.menschen} /> : null,
  };
  const zuletzt = st?.zuletzt.length ? (
        <section className="section" aria-label="Zuletzt festgehalten">
          <h2>Zuletzt festgehalten</h2>
          <Log items={st.zuletzt} freshId={freshId} />
          <p className="gnote flush"><Link href="/archiv" className="linkbtn">Alles im Logbuch</Link></p>
        </section>
      ) : null;
  const mitFeld = bausteine.includes('festhalten') || feldOffen;
  const reihe = bausteine.filter((b) => b !== 'woche' && (b !== 'festhalten' || mitFeld));
  if (feldOffen && !bausteine.includes('festhalten')) reihe.unshift('festhalten');

  return (
    <main className="wrap breit">
      <TopBar title="Heute" />
      {!bausteine.includes('festhalten') ? <button type="button" className="plus-btn" aria-label="Festhalten" aria-expanded={feldOffen} onClick={() => setFeldOffen((x) => !x)}>{feldOffen ? Icon.close : Icon.plus}</button> : null}
      <header className="head">
        <span className="eyebrow">{today}</span>
        <h1 className="title">Heute<i>.</i></h1>
        {st ? (st.engpass
          ? <p className="engpass"><b>Engpass</b><span>{st.engpass}</span></p>
          : <Link className="engpass leer" href="/einstellungen"><b>Engpass</b><span>festlegen</span>{Icon.chevronRight}</Link>) : null}
        {bausteine.includes('woche') && kompass?.tage ? <Tagespunkte tage={kompass.tage} heute={heuteTag} /> : null}
      </header>

      {breit ? (
        <div className="heute-spalten">
          <div className="spalte">{reihe.filter((b) => !RECHTS.includes(b)).map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}{zuletzt}</div>
          <div className="spalte">{reihe.filter((b) => RECHTS.includes(b)).map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}</div>
        </div>
      ) : <>{reihe.map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}{zuletzt}</>}


      {toast}
      <TabBar />
    </main>
  );
}
