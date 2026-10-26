'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TaskRow, TimeChip, TopBar, api, fTime, isPending, useBreit, useToast, type Item, type Stand } from './ui';
import { Fragebogen } from './fragebogen';
import { CoachBlatt, CoachInhalt, CoachLeiste, Empfohlen, useCheckins, useCoachChat, type Spur } from './coach';
import { KalenderHeute, useKalender } from './kalender';
import { Tagespunkte, Wochenringe } from './ringe';
import { useSprache } from './sprache';
import { hhmm } from '@/lib/kalender-regeln';
import { GeldKurz, KoerperKurz, MenschenKurz, useKurz } from './kurz';
import { Schnellzugriff } from './schnell';
import { bausteineAus, type Baustein } from '@/lib/heute-bausteine';
import { EnergieChips, WennChip } from './wenn';

/** Auf iPad und Mac stehen diese Bausteine rechts unter dem Coach, alles zum Tun links. */
const RECHTS: Baustein[] = ['empfohlen', 'kalender', 'koerper', 'geld', 'menschen'];
const uhrBerlin = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
type KompassKurz = { jetzt: { ringe: Record<string, number | null> }; gesamt: { level: number; naechstes: number; anteil: number }; tage: { tag: string; wert: number | null }[] };

const nachZeit = (a: Item, b: Item) => (a.zeit && b.zeit ? a.zeit.localeCompare(b.zeit) : a.zeit ? -1 : b.zeit ? 1 : (a.rang ?? 99) - (b.rang ?? 99));

export default function Heute() {
  const [st, setSt] = useState<Stand | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const ci = useCheckins();
  const chat = useCoachChat();
  const [coachOffen, setCoachOffen] = useState(false);
  const [coachFokus, setCoachFokus] = useState(0);
  const { k: kal } = useKalender();
  const vorschlag = kal?.heute?.bloecke.find((b) => b.art === 'vorschlag') ?? null;
  const [kompass, setKompass] = useState<KompassKurz | null>(null);
  useEffect(() => { api<KompassKurz>('/api/kompass').then(setKompass).catch(() => {}); }, []);
  const ringe = kompass?.jetzt.ringe ?? null;
  const [bausteine, setBausteine] = useState<Baustein[]>(() => bausteineAus(null));
  const breit = useBreit(768);
  useEffect(() => { api<{ bausteine: Baustein[] }>('/api/heute/bausteine').then((r) => setBausteine(bausteineAus(r.bausteine))).catch(() => {}); }, []);
  const kurz = useKurz(bausteine);
  const sprache = useSprache(text, setText, (m) => setToast(m, 'err'));

  const load = useCallback(async () => { setSt(await api<Stand>('/api/heute')); }, []);
  useEffect(() => { load().catch((e) => setToast((e as Error).message, 'err')); }, [load, setToast]);
  // Während Claude einordnet oder sortiert: nachsehen, bis es fertig ist.
  useEffect(() => {
    if (!st || !(st.laeuft || st.zuletzt.some(isPending))) return;
    const t = setTimeout(() => load().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [st, load]);
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

  /** Hält einen Gedanken fest. Claude ordnet ihn im Hintergrund ein. */
  async function festhalten(t: string) {
    try {
      const r = await api<{ id: string }>('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) });
      await load(); return !!r.id;
    } catch (e) { setToast('Nicht gespeichert. ' + (e as Error).message, 'err'); return false; }
  }
  async function save() {
    const t = text.trim(); if (!t || busy) return;
    sprache.stop(); setBusy(true);
    try { if (await festhalten(t)) { setText(''); setDone(true); } } finally { setBusy(false); }
  }

  const heuteTag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const today = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const items = st?.items ?? [];
  const jetzt = items.filter((i) => i.stapel === 'jetzt').sort(nachZeit);
  const naechste = items.filter((i) => i.stapel === 'woche').sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99)).slice(0, 3);
  const neu = items.filter((i) => !i.stapel).length;

  // Gedanke aus Schnellzugriff, Taste N oder ?festhalten=1: Coach mit Feld öffnen
  const gedanke = useCallback(() => { setCoachOffen(true); setCoachFokus((n) => n + 1); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('festhalten') !== '1') return;
    window.history.replaceState(null, '', '/');
    const t = setTimeout(gedanke, 300);
    return () => clearTimeout(t);
  }, [gedanke]);
  useEffect(() => { window.addEventListener('life-festhalten', gedanke); return () => window.removeEventListener('life-festhalten', gedanke); }, [gedanke]);
  const spuren: Spur[] = [...(st?.zuletzt ?? [])].reverse()
    .map((it) => ({ id: it.id, text: it.roh || it.text, zeit: uhrBerlin(it.created_at), titel: it.titel, laeuft: isPending(it) }));
  const coachInhalt = <CoachInhalt stand={ci} chat={chat} spuren={spuren} onFesthalten={festhalten} fokus={coachFokus > 0} key={coachFokus} kompakt onFehler={(m) => setToast(m, 'err')} />;

  const bloecke: Partial<Record<Baustein, React.ReactNode>> = {
    kompass: kompass && ringe ? <Wochenringe ringe={ringe} level={kompass.gesamt.level} naechstes={kompass.gesamt.naechstes} anteil={kompass.gesamt.anteil} /> : null,
    fragebogen: (
ci.zeige ? (
        <section className="gsec" aria-label="Fragebogen">
          <Fragebogen key={ci.zeige} art={ci.zeige} aufgaben={ci.aufgaben} onFertig={() => { ci.fertig(); setToast('Danke. Der Coach meldet sich gleich.'); }} onFehler={(m) => setToast(m, 'err')} />
        </section>
      ) : null
    ),
    festhalten: (
<><section className="capture compact" aria-label="Festhalten">
        <textarea value={text} onChange={(e) => { setText(e.target.value); if (done) setDone(false); }} placeholder="Was geht dir durch den Kopf?" aria-label="Gedanke, Aufgabe, Zitat oder Link"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }} />
        <div className="row">
          <span className={'hint' + (sprache.hoert ? ' live' : '')} aria-live="polite">{sprache.hoert ? <><span className="rec" />Ich höre zu</> : null}</span>
          <span className="tools">
            {sprache.geht ? (
              <button type="button" className={'btn mic' + (sprache.hoert ? ' on' : '')} onClick={sprache.umschalten} aria-pressed={sprache.hoert} aria-label={sprache.hoert ? 'Aufnahme beenden' : 'Sprechen'}>
                {sprache.hoert ? Icon.stop : Icon.mic}
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
                  {n === 0 && vorschlag && !it.zeit ? <button type="button" className="chipbtn frei" aria-label={`Im Kalender frei von ${hhmm(vorschlag.von)} bis ${hhmm(vorschlag.bis)}, als Uhrzeit setzen`} onClick={() => zeit(it, hhmm(vorschlag.von))}>{hhmm(vorschlag.von)}–{hhmm(vorschlag.bis)} frei</button> : null}
                  <TimeChip value={it.zeit} onChange={(v) => zeit(it, v)} />
                  <button type="button" className="chipbtn" onClick={() => spaeter(it)}>Nicht heute</button>
                  <WennChip aufgabe={it.schritt || it.titel || it.text.slice(0, 80)} wert={it.wenn} onSetzen={(w) => act(() => patch(it.id, { wenn: w }))} />
                  {it.wenn ? <span className="wenn-satz">{it.wenn}</span> : null}
                </TaskRow>
              ))}
            </ul>
          )
          : st.laeuft ? <div className="group pad"><p className="note working">Claude sortiert deinen Tag …</p></div>
          : <div className="group pad"><p className="muted small">{items.length ? 'Für heute ist nichts gesetzt.' : 'Nichts offen. Halte unten fest, was ansteht. Claude sortiert es ein.'}</p></div>}
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
    schnell: <Schnellzugriff onGedanke={gedanke} />,
    empfohlen: <Empfohlen stand={ci} />,
    kalender: <KalenderHeute />,
    koerper: kurz.koerper ? <KoerperKurz k={kurz.koerper} /> : null,
    geld: kurz.geld ? <GeldKurz g={kurz.geld} /> : null,
    menschen: kurz.menschen ? <MenschenKurz m={kurz.menschen} /> : null,
  };
  const reihe = bausteine.filter((b) => b !== 'woche');

  return (
    <main className="wrap breit">
      <TopBar title="Heute" />
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
          <div className="spalte">{reihe.filter((b) => !RECHTS.includes(b)).map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}</div>
          <div className="spalte">
            <aside className="hero coach coach-panel" aria-label="Coach">{coachInhalt}</aside>
            {reihe.filter((b) => RECHTS.includes(b)).map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}
          </div>
        </div>
      ) : <>
        {reihe.map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>)}
        <CoachLeiste stand={ci} onOeffnen={gedanke} />
        {coachOffen ? <CoachBlatt onZu={() => setCoachOffen(false)}>{coachInhalt}</CoachBlatt> : null}
      </>}

      {toast}
      <TabBar />
    </main>
  );
}
