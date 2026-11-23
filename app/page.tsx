'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, isPending, taskTitle, useBreit, useToast, type Item, type Stand } from './ui';
import { Liste } from './liste';
import { FrageOffen } from './frage-offen';
import { RitualKarte } from './rituale';
import { CoachBlatt, CoachFeld, CoachInhalt, CoachLeiste, useCheckins, useCoachChat, type Spur } from './coach';
import { KalenderHeute, useKalender } from './kalender';
import { EineSache, Erledigt } from './eine-sache';
import { hhmm } from '@/lib/kalender-regeln';
import { bausteineAus, type Baustein } from '@/lib/heute-bausteine';
import { Tagesstreifen, useCockpit } from './cockpit';
import { SaisonHeute, Tagesring, useHunderter } from './hunderter';

/**
 * Heute nach MAYA (0.33, Richtung B, Peter 23.11.2026): Kopf mit Tagesring, Check-in nur wenn fällig, die eine Sache,
 * Saison heute, Als Nächstes, Liste. Fünf Blöcke statt zehn.
 * iPad: links alles, rechts Coach mit Als Nächstes. Mac ab 1280 px: zwei Spalten plus Coach. Die Seite scrollt nicht, jede Spalte für sich (Peter, 31.10.2026).
 */
const RECHTS: Baustein[] = ['streifen', 'kalender'];
const LINKS_MAC: Baustein[] = ['fragebogen', 'jetzt', 'streifen', 'kalender'];
const uhrBerlin = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const nachZeit = (a: Item, b: Item) => (a.zeit && b.zeit ? a.zeit.localeCompare(b.zeit) : a.zeit ? -1 : b.zeit ? 1 : (a.rang ?? 99) - (b.rang ?? 99));

export default function Heute() {
  const [st, setSt] = useState<Stand | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const ci = useCheckins();
  const chat = useCoachChat();
  const [coachModus, setCoachModus] = useState<'zu' | 'feld' | 'blatt'>('zu');
  const [wartet, setWartet] = useState<string | null>(null);
  const [coachFokus, setCoachFokus] = useState(0);
  const { k: kal } = useKalender();
  const vorschlag = kal?.heute?.bloecke.find((b) => b.art === 'vorschlag') ?? null;
  const [bausteine, setBausteine] = useState<Baustein[]>(() => bausteineAus(null));
  const breit = useBreit(768);
  const mac = useBreit(1280);
  useEffect(() => { api<{ bausteine: Baustein[] }>('/api/heute/bausteine').then((r) => setBausteine(bausteineAus(r.bausteine))).catch(() => {}); }, []);
  const { c: cockpit, laden: cockpitLaden } = useCockpit();
  const fehler = useCallback((m: string) => setToast(m, 'err'), [setToast]);
  const { h: challenge, tun: challengeTun } = useHunderter(fehler);
  // Uhrzeit erst im Browser setzen, damit Server und Browser dasselbe zeichnen
  const [minuten, setMinuten] = useState<number | null>(null);
  useEffect(() => {
    const setzen = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':'); setMinuten(Number(p[0]) * 60 + Number(p[1])); };
    setzen(); const t = setInterval(setzen, 60_000); return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => { setSt(await api<Stand>('/api/heute')); }, []);
  useEffect(() => { load().catch((e) => setToast((e as Error).message, 'err')); }, [load, setToast]);
  // Während Claude einordnet oder sortiert: nachsehen, bis es fertig ist.
  useEffect(() => {
    if (!st || !(st.laeuft || st.zuletzt.some(isPending))) return;
    const t = setTimeout(() => load().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [st, load]);

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
  // Zurück aus Morgen oder Abschluss: kurz bestätigen, der Coach schreibt im Hintergrund
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ritual');
    if (r !== 'morgen' && r !== 'abschluss') return;
    window.history.replaceState(null, '', '/');
    setToast(r === 'morgen' ? 'Der Tag steht. Der Coach meldet sich gleich.' : 'Der Tag ist zu. Gute Nacht.');
  }, [setToast]);
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
  const bloecke: Record<Baustein, React.ReactNode> = {
    fragebogen: (
<><RitualKarte art={ci.zeige === 'morgen' || ci.zeige === 'abend' ? ci.zeige : null} wochenrunde={!!ci.coach?.wochenstartOffen && !ci.zeige} /><FrageOffen /></>
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
    saison: <SaisonHeute h={challenge} tun={challengeTun} />,
    streifen: <Tagesstreifen c={cockpit} jetzt={minuten} />,
    liste: <Liste jetzt={jetzt} eins={eins} erledigtHeute={st?.erledigtHeute ?? []} zuletzt={st?.zuletzt ?? []} woche={items.filter((i) => i.stapel === 'woche').length} geparkt={items.filter((i) => i.stapel === 'geparkt').length} leaving={leaving} onToggle={toggle} onVor={(it) => act(() => patch(it.id, { eineSache: true }))} />,
    erledigt: <Erledigt items={st?.erledigtHeute ?? []} onToggle={toggle} onEnergie={(it, n) => act(() => patch(it.id, { energie: n }))} />,
    kalender: <KalenderHeute />,
  };
  const zeige = (liste: Baustein[]) => liste.map((b) => <Fragment key={b}>{bloecke[b]}</Fragment>);
  const coachSpalte = <aside className="hero coach coach-panel" aria-label="Coach">{coachInhalt}</aside>;

  return (
    <main className={'wrap breit' + (breit ? ' heute-desk' : '')}>
      <TopBar title="Heute" profil />
      <header className="head">
        <span className="eyebrow">{today}</span>
        <div className="titel-zeile"><h1 className="title">Heute<i>.</i></h1><Tagesring h={challenge} /></div>
      </header>

      {breit && mac ? (
        <div className="heute-spalten drei">
          <div className="spalte">{zeige(bausteine.filter((b) => LINKS_MAC.includes(b)))}</div>
          <div className="spalte">{zeige(bausteine.filter((b) => !LINKS_MAC.includes(b)))}</div>
          <div className="spalte spalte-rechts">{coachSpalte}</div>
        </div>
      ) : breit ? (
        <div className="heute-spalten">
          <div className="spalte">{zeige(bausteine.filter((b) => !RECHTS.includes(b)))}</div>
          <div className="spalte spalte-rechts">{coachSpalte}{zeige(bausteine.filter((b) => RECHTS.includes(b)))}</div>
        </div>
      ) : <>
        {zeige(bausteine)}
        <CoachLeiste stand={ci} onOeffnen={gedanke} />
        {coachModus === 'feld' ? <CoachFeld stand={ci} onSenden={senden} wartet={!!wartet} onGespraech={() => setCoachModus('blatt')} onZu={() => setCoachModus('zu')} onFehler={(m) => setToast(m, 'err')} /> : null}
        {coachModus === 'blatt' ? <CoachBlatt onZu={() => setCoachModus('zu')}>{coachInhalt}</CoachBlatt> : null}
      </>}

      {toast}
      <TabBar />
    </main>
  );
}
