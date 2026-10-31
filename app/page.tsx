'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, isPending, useBreit, useToast, type Item, type Stand } from './ui';
import { Liste } from './liste';
import { Fragebogen } from './fragebogen';
import { CoachBlatt, CoachFeld, CoachInhalt, CoachLeiste, Empfohlen, useCheckins, useCoachChat, type Spur } from './coach';
import { KalenderHeute, useKalender } from './kalender';
import { MiniRinge } from './ringe';
import { Danach, EineSache, Erledigt } from './eine-sache';
import { useSprache } from './sprache';
import { hhmm } from '@/lib/kalender-regeln';
import { GeldKurz, KoerperKurz, MenschenKurz, useKurz } from './kurz';
import { Schnellzugriff } from './schnell';
import { bausteineAus, type Baustein } from '@/lib/heute-bausteine';
import { CockpitKacheln, KontenHeute, Tagesstreifen, useCockpit } from './cockpit';

/** Auf iPad und Mac stehen diese Bausteine rechts unter dem Coach, alles zum Tun links. */
const RECHTS: Baustein[] = ['streifen', 'konten', 'empfohlen', 'kalender', 'koerper', 'geld', 'menschen'];
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
  const [coachModus, setCoachModus] = useState<'zu' | 'feld' | 'blatt'>('zu');
  const [wartet, setWartet] = useState<string | null>(null);
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
  const { c: cockpit, laden: cockpitLaden } = useCockpit();
  // Uhrzeit erst im Browser setzen, damit Server und Browser dasselbe zeichnen
  const [minuten, setMinuten] = useState<number | null>(null);
  useEffect(() => {
    const setzen = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':'); setMinuten(Number(p[0]) * 60 + Number(p[1])); };
    setzen(); const t = setInterval(setzen, 60_000); return () => clearInterval(t);
  }, []);
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
    try { await fn(); } catch (e) { setToast((e as Error).message, 'err'); } finally { await Promise.all([load().catch(() => {}), cockpitLaden().catch(() => {})]); }
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
  function spaeter(it: Item, warEins = false) {
    setLeaving(it.id);
    act(async () => {
      await patch(it.id, { stapel: 'woche' });
      await pause();
      setToast('In die Woche geschoben', 'ok', { label: 'Rückgängig', run: () => act(() => patch(it.id, warEins ? { stapel: 'jetzt', eineSache: true } : { stapel: 'jetzt' })) });
    }).finally(() => setLeaving(null));
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
  /** Ein Feld für alles: festhalten, dann nachsehen, ob Claude den Text als Frage an den Coach erkennt. */
  async function senden(t: string) {
    try {
      const r = await api<{ id: string }>('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) });
      setWartet(r.id); load().catch(() => {}); return true;
    } catch (e) { setToast('Nicht gespeichert. ' + (e as Error).message, 'err'); return false; }
  }
  useEffect(() => {
    if (!wartet) return;
    let n = 0; let aus = false;
    const runde = async () => {
      if (aus) return;
      n++;
      const it = await api<Item>(`/api/items/${wartet}`).catch(() => null);
      const fertig = !!it && (it.status !== 'neu' || !!it.fehler);
      if (fertig || n > 16) {
        await Promise.all([load().catch(() => {}), chat.neuLaden().catch(() => {})]);
        setWartet(null);
        if (it?.an_coach) setCoachModus((m) => (m === 'zu' ? m : 'blatt'));
        else setCoachModus((m) => { if (m === 'feld') { setToast('Festgehalten'); return 'zu'; } return m; });
        return;
      }
      setTimeout(runde, 1200);
    };
    const t = setTimeout(runde, 900);
    return () => { aus = true; clearTimeout(t); };
  }, [wartet, load, chat.neuLaden, setToast]);
  async function save() {
    const t = text.trim(); if (!t || busy) return;
    sprache.stop(); setBusy(true);
    try { if (await festhalten(t)) { setText(''); setDone(true); } } finally { setBusy(false); }
  }

  const today = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const items = st?.items ?? [];
  const jetzt = items.filter((i) => i.stapel === 'jetzt').sort(nachZeit);

  // Gedanke aus Schnellzugriff, Taste N oder ?festhalten=1: Coach mit Feld öffnen
  // Auf dem Mac steht das Feld schon rechts, dort springt der Fokus hinein
  const gedanke = useCallback(() => { if (!breit) setCoachModus('feld'); setCoachFokus((n) => n + 1); }, [breit]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('festhalten') !== '1') return;
    window.history.replaceState(null, '', '/');
    const t = setTimeout(gedanke, 300);
    return () => clearTimeout(t);
  }, [gedanke]);
  useEffect(() => { window.addEventListener('life-festhalten', gedanke); return () => window.removeEventListener('life-festhalten', gedanke); }, [gedanke]);
  // „Coach“ im Schnellmenü der Mitte öffnet das Gespräch ohne Tastatur
  useEffect(() => { const f = () => setCoachModus('blatt'); window.addEventListener('life-coach', f); return () => window.removeEventListener('life-coach', f); }, []);
  const spuren: Spur[] = [...(st?.zuletzt ?? [])].reverse()
    .map((it) => ({ id: it.id, text: it.roh || it.text, zeit: uhrBerlin(it.created_at), titel: it.titel, laeuft: isPending(it) }));
  const coachInhalt = <CoachInhalt stand={ci} chat={chat} spuren={spuren} onSenden={senden} wartet={!!wartet} fokus={coachFokus > 0 && coachModus !== 'feld'} key={coachFokus} kompakt onFehler={(m) => setToast(m, 'err')} />;

  // Der Engpass steht als eine Zeile über der einen Sache, ohne Erklärung (Peter, 26.10.2026)
  const zielscheibe = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
  const engpassZeile = st?.engpass
    ? <Link href="/einstellungen" className="engpass-zeile" aria-label={`Engpass: ${st.engpass}`}>{zielscheibe}<span>{st.engpass}</span></Link>
    : st ? <Link href="/einstellungen" className="engpass-zeile leer">{zielscheibe}<span>Engpass festlegen</span>{Icon.chevronRight}</Link> : null;
  const eins = [...jetzt].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99))[0] ?? null;
  const danach = jetzt.filter((x) => x !== eins);
  const bloecke: Partial<Record<Baustein, React.ReactNode>> = {
    cockpit: <CockpitKacheln c={cockpit} />,
    streifen: <Tagesstreifen c={cockpit} jetzt={minuten} />,
    konten: <KontenHeute c={cockpit} />,
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
      <div className="eins-bereich">
        {engpassZeile}
        {st === null ? <div className="loading">Lädt …</div>
          : eins ? <EineSache key={eins.id} it={eins} frei={vorschlag && !eins.zeit ? { von: hhmm(vorschlag.von), bis: hhmm(vorschlag.bis) } : null} leaving={leaving === eins.id}
              onErledigt={() => toggle(eins)} onZeit={(v) => zeit(eins, v)} onSpaeter={() => spaeter(eins, true)} onWenn={(w) => act(() => patch(eins.id, { wenn: w }))}
              sortiert={{ laeuft: st.laeuft, am: st.sortiertAm }} onNeuSortieren={neuSortieren} />
          : st.laeuft ? <p className="note working">Claude sucht die eine Sache …</p>
          : <section className="eine-sache leer" aria-label="Die eine Sache"><p className="muted">{items.length ? 'Für heute ist nichts gesetzt.' : 'Nichts offen.'}</p>{items.length ? <button type="button" className="linkbtn" onClick={neuSortieren}>Neu sortieren</button> : null}</section>}
        {st?.fehler ? <p className="gnote bad">Sortieren hat nicht geklappt: {st.fehler}</p> : null}
      </div>
    ),
    naechste: <Danach items={danach} leaving={leaving} onToggle={toggle} onVor={(it) => act(() => patch(it.id, { eineSache: true }))} />,
    liste: <Liste jetzt={jetzt} eins={eins} erledigtHeute={st?.erledigtHeute ?? []} zuletzt={st?.zuletzt ?? []} woche={items.filter((i) => i.stapel === 'woche').length} geparkt={items.filter((i) => i.stapel === 'geparkt').length} leaving={leaving} onToggle={toggle} />,
    erledigt: <Erledigt items={st?.erledigtHeute ?? []} onToggle={toggle} onEnergie={(it, n) => act(() => patch(it.id, { energie: n }))} />,
    schnell: <Schnellzugriff onGedanke={gedanke} />,
    empfohlen: <Empfohlen stand={ci} />,
    kalender: <KalenderHeute />,
    koerper: kurz.koerper ? <KoerperKurz k={kurz.koerper} /> : null,
    geld: kurz.geld ? <GeldKurz g={kurz.geld} /> : null,
    menschen: kurz.menschen ? <MenschenKurz m={kurz.menschen} /> : null,
  };
  const reihe = bausteine.filter((b) => b !== 'kompass');

  return (
    <main className="wrap breit">
      <TopBar title="Heute" />
      <header className="head">
        <span className="eyebrow">{today}</span>
        <div className="titel-zeile"><h1 className="title">Heute<i>.</i></h1>{bausteine.includes('kompass') && ringe && kompass ? <MiniRinge ringe={ringe} level={kompass.gesamt.level} /> : null}</div>
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
        {coachModus === 'feld' ? <CoachFeld stand={ci} onSenden={senden} wartet={!!wartet} onGespraech={() => setCoachModus('blatt')} onZu={() => setCoachModus('zu')} onFehler={(m) => setToast(m, 'err')} /> : null}
        {coachModus === 'blatt' ? <CoachBlatt onZu={() => setCoachModus('zu')}>{coachInhalt}</CoachBlatt> : null}
      </>}

      {toast}
      <TabBar />
    </main>
  );
}
