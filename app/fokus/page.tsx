'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, api, taskTitle, useToast, type Item, type Stand } from '../ui';
import { useFokusMusik } from '../fokus-musik';
import { useCockpit } from '../cockpit';
import {
  BEWERTUNG, BEWERTUNG_NAME, LAENGEN, MUSIK, MUSIK_NAME, TEST_TAGE, phase, uhr, type Bewertung, type Musik, type TestStand,
} from '@/lib/fokus-regeln';
import type { Block } from '@/lib/fokus';

type Antwort = { block: Block | null; heute: { bloecke: number; minuten: number }; test: TestStand | null; naechste: Musik | null; jetzt: number };
type PipFenster = Window & { document: Document };
type DocPip = { requestWindow: (o: { width: number; height: number }) => Promise<PipFenster> };

const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const minutenBerlin = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
const dauer = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ''}` : `${min} Min.`);

/**
 * Deep Work (0.27, Peter 31.10.2026, Variante A): ein Bildschirm mit Timer, der einen Sache, der nächsten Aufgabe,
 * dem nächsten Termin und der Musik. Ablenkende Gedanken parkst du, ohne den Modus zu verlassen.
 * iPhone: Vollbild vom Home-Bildschirm, Bildschirm bleibt an, Sperrbildschirm zeigt Aufgabe und Restzeit, solange Ton läuft.
 * Mac: Vollbild (Taste F) und, wo der Browser es kann, ein schwebendes Mini-Fenster.
 * Die Zeit kommt aus der Startzeit auf dem Server und dessen Uhr, deshalb stimmt der Timer auch nach dem Schließen der App.
 */
export default function DeepWork() {
  const router = useRouter();
  const [d, setD] = useState<Antwort | null>(null);
  const [st, setSt] = useState<Stand | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [laenge, setLaenge] = useState(0);
  const [musik, setMusik] = useState<Musik>('klassik');
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [versatz, setVersatz] = useState(0);
  const [bewerten, setBewerten] = useState(false);
  const [bewertung, setBewertung] = useState<Bewertung | null>(null);
  const [erledigt, setErledigt] = useState(false);
  const [parken, setParken] = useState(false);
  const [gedanke, setGedanke] = useState('');
  const [testOffen, setTestOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pip, setPip] = useState<PipFenster | null>(null);
  const [pipGeht, setPipGeht] = useState(false);
  const [toast, setToast] = useToast();
  const m = useFokusMusik();
  const { c } = useCockpit();
  const wach = useRef<{ release: () => Promise<void> } | null>(null);

  const laden = useCallback(() => api<Antwort>('/api/fokus').then((x) => { setD(x); setVersatz(x.jetzt - Date.now()); return x; }), []);
  const heuteLaden = useCallback(() => api<Stand>('/api/heute').then(setSt).catch(() => {}), []);
  useEffect(() => {
    laden().catch((e) => setToast((e as Error).message, 'err'));
    heuteLaden();
    const id = new URLSearchParams(window.location.search).get('item');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setItemId(id);
    setPipGeht('documentPictureInPicture' in window);
  }, [laden, heuteLaden, setToast]);
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 1000); return () => clearInterval(t); }, []);

  const b = d?.block ?? null;
  const ph = b ? phase(Date.parse(b.start), b.minuten, b.pause, jetzt + versatz) : null;
  const jetztListe = (st?.items ?? []).filter((i) => i.stapel === 'jetzt' && i.status !== 'erledigt').sort((x, y) => (x.rang ?? 99) - (y.rang ?? 99));
  const aktuellId = b?.itemId ?? itemId ?? jetztListe[0]?.id ?? null;
  const aktuell: Item | null = (st?.items ?? []).find((i) => i.id === aktuellId) ?? null;
  const sache = b?.titel || (aktuell ? taskTitle(aktuell) : '');
  const naechste = jetztListe.find((i) => i.id !== aktuellId) ?? null;
  const ab = minutenBerlin();
  const termin = c?.streifen.find((s) => s.quelle === 'kalender' && s.von >= ab) ?? null;
  const imTest = !!d?.naechste;

  // In der Pause schweigt die Musik, am Ende fragt Life, wie es lief
  useEffect(() => { if (ph?.phase === 'pause' && m.spielt) m.stop(); }, [ph?.phase, m]);
  useEffect(() => { if (b && ph?.phase === 'fertig' && !bewerten) { m.stop(); setBewerten(true); } }, [b, ph?.phase, bewerten, m]);

  // Bildschirm bleibt an, solange ein Block läuft (iPhone ab iOS 18.4, Mac in allen Browsern mit Wake Lock)
  useEffect(() => {
    const an = !!b && ph?.phase !== 'fertig';
    const holen = async () => {
      if (!an || wach.current || document.visibilityState !== 'visible') return;
      try { wach.current = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* nicht erlaubt */ }
    };
    if (an) holen(); else { wach.current?.release().catch(() => {}); wach.current = null; }
    const sicht = () => { wach.current = null; holen(); };
    document.addEventListener('visibilitychange', sicht);
    return () => document.removeEventListener('visibilitychange', sicht);
  }, [b, ph?.phase]);

  // Sperrbildschirm: Aufgabe und Restzeit als Titel, solange Musik oder Rauschen läuft
  const restMin = ph ? Math.ceil(ph.restSek / 60) : 0;
  useEffect(() => {
    if (!('mediaSession' in navigator) || !b || !m.spielt) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `${sache || 'Deep Work'} · noch ${restMin} Min.`, artist: `Life · Deep Work · ${MUSIK_NAME[m.art]}`, album: m.titel ?? '' });
      navigator.mediaSession.setActionHandler('pause', () => m.stop());
      navigator.mediaSession.setActionHandler('play', () => m.spielen(m.art));
      navigator.mediaSession.setActionHandler('nexttrack', () => m.naechstes());
    } catch { /* ältere Browser */ }
  }, [b, m, sache, restMin]);

  async function starten(basis: Antwort | null = d) {
    const dd = basis; if (!dd) return;
    const [minuten, pause] = LAENGEN[laenge];
    const gewaehlt: Musik = dd.naechste ?? musik;
    m.spielen(gewaehlt); // noch im Tippen, sonst blockt das iPhone den Ton
    setBusy(true);
    try {
      const r = await api<{ block: Block; jetzt: number }>('/api/fokus', { method: 'POST', body: JSON.stringify({ aktion: 'start', itemId: aktuellId, minuten, pause, musik: dd.naechste ? 'test' : musik }) });
      if (r.block.musik !== gewaehlt) m.spielen(r.block.musik);
      setVersatz(r.jetzt - Date.now());
      setD({ ...dd, block: r.block }); setBewerten(false); setBewertung(null); setErledigt(false);
      laden().catch(() => {});
    } catch (e) { m.stop(); setToast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  }
  async function abschliessen(nochEiner: boolean) {
    if (!b) return;
    setBusy(true);
    try {
      await api('/api/fokus', { method: 'POST', body: JSON.stringify({ aktion: 'ende', id: b.id, bewertung }) });
      if (erledigt && b.itemId) await api(`/api/items/${b.itemId}`, { method: 'PATCH', body: JSON.stringify({ erledigt: true }) });
      setBewerten(false); setBewertung(null);
      if (erledigt) setItemId(null);
      await heuteLaden();
      const x = await laden();
      setToast(bewertung ? `Festgehalten: ${BEWERTUNG_NAME[bewertung]}` : 'Block beendet');
      if (nochEiner) await starten(x);
    } catch (e) { setToast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  }
  function blockBeenden(fertig: boolean) { m.stop(); setErledigt(fertig); setBewerten(true); }
  async function gedankeParken() {
    const t = gedanke.trim(); if (!t) return;
    try { await api('/api/items', { method: 'POST', body: JSON.stringify({ text: t }) }); setGedanke(''); setParken(false); setToast('Geparkt. Claude ordnet es ein.'); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function test(aktion: 'test-start' | 'test-ende') {
    try { await api('/api/fokus', { method: 'POST', body: JSON.stringify({ aktion }) }); await laden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  const vollbild = useCallback(() => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  }, []);
  async function miniFenster() {
    if (pip) { pip.close(); return; }
    try {
      const w = await (window as unknown as { documentPictureInPicture: DocPip }).documentPictureInPicture.requestWindow({ width: 340, height: 150 });
      // Stile mitnehmen, damit das Fenster aussieht wie Life
      for (const s of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) w.document.head.appendChild(s.cloneNode(true));
      w.document.documentElement.dataset.theme = 'dark';
      w.document.body.className = 'dw-pip-body';
      w.addEventListener('pagehide', () => setPip(null));
      setPip(w);
    } catch { setToast('Das Mini-Fenster geht in diesem Browser nicht.', 'err'); }
  }
  // Mac: F schaltet Vollbild, N parkt einen Gedanken, Escape schließt das Parken
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { if (e.key === 'Escape') setParken(false); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); vollbild(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); setParken(true); }
    };
    window.addEventListener('keydown', f, true);
    return () => window.removeEventListener('keydown', f, true);
  }, [vollbild]);

  const umfang = 2 * Math.PI * 88;
  const ring = (gross: boolean) => (
    <div className={'dw-ring' + (gross ? '' : ' klein')} role="timer" aria-live="off" aria-label={ph ? `${ph.phase === 'pause' ? 'Pause' : 'Fokus'}: noch ${uhr(ph.restSek)}` : 'Bereit'}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="88" className="dw-spur" />
        {ph ? <circle cx="100" cy="100" r="88" className={'dw-wert' + (ph.phase === 'pause' ? ' pause' : '')} strokeDasharray={umfang} strokeDashoffset={umfang * ph.anteil} /> : null}
      </svg>
      <div>
        <b>{ph ? uhr(ph.restSek) : `${LAENGEN[laenge][0]}:00`}</b>
        <small>{!ph ? `dann ${LAENGEN[laenge][1]} Min. Pause` : ph.phase === 'pause' ? 'Pause, steh kurz auf' : `dann ${b!.pause} Min. Pause`}</small>
      </div>
    </div>
  );

  const musikChips = (
    <div className="dw-musik" role="radiogroup" aria-label="Musik">
      {MUSIK.map((x) => {
        const an = b ? m.art === x || (!m.spielt && b.musik === x && x === 'stille') : (imTest ? d!.naechste === x : musik === x);
        return <button key={x} type="button" role="radio" aria-checked={an} disabled={imTest && !b} onClick={() => { if (b) m.spielen(x); else setMusik(x); }}>{MUSIK_NAME[x]}</button>;
      })}
    </div>
  );

  return (
    <main className="dw" aria-label="Deep Work">
      <div className="dw-inhalt">
        <div className="dw-kopf">
          <b>Deep Work</b>
          <span>{b ? `${MUSIK_NAME[m.spielt ? m.art : b.musik]}${b.test ? ' · Musiktest' : ''}` : d ? `Heute ${d.heute.bloecke} ${d.heute.bloecke === 1 ? 'Block' : 'Blöcke'} · ${d.heute.minuten} Min.` : '…'}</span>
          <span className="dw-werkzeug">
            <button type="button" className="dw-icon nur-gross" onClick={vollbild} aria-label="Vollbild (F)">⛶</button>
            {pipGeht ? <button type="button" className="dw-icon nur-gross" onClick={miniFenster} aria-label={pip ? 'Mini-Fenster schließen' : 'Mini-Fenster'}>▣</button> : null}
            <button type="button" className="dw-icon" onClick={() => { m.stop(); router.push('/'); }} aria-label="Deep Work verlassen">{Icon.close}</button>
          </span>
        </div>

        {!d ? <p className="dw-leise">Lädt …</p> : bewerten && b ? (
          <section className="dw-bewerten" aria-label="Wie gut ging es">
            <h2 className="dw-sache">Wie gut ging es?</h2>
            <div className="dw-wahl" role="radiogroup" aria-label="Wie gut ging es">
              {BEWERTUNG.map((x) => <button key={x} type="button" role="radio" aria-checked={bewertung === x} onClick={() => setBewertung(x)}>{BEWERTUNG_NAME[x]}</button>)}
            </div>
            {b.itemId ? <button type="button" className="dw-zeile knopf" aria-pressed={erledigt} onClick={() => setErledigt(!erledigt)}><span className={'dw-box' + (erledigt ? ' an' : '')} aria-hidden="true">{erledigt ? Icon.check : null}</span><span className="grow">Aufgabe ist erledigt</span></button> : null}
            <p className="dw-leise">{b.test ? `Teil deines Musiktests: ${MUSIK_NAME[b.musik]}.` : `Musik: ${MUSIK_NAME[b.musik]}.`} Die Bewertung bleibt in Life.</p>
            <div className="dw-unten">
              <button type="button" disabled={busy || erledigt} onClick={() => abschliessen(true)}>Noch ein Block</button>
              <button type="button" className="hell" disabled={busy} onClick={() => abschliessen(false)}>Fertig</button>
            </div>
          </section>
        ) : (
          <>
            {ring(true)}
            <h1 className="dw-sache">{sache || 'Ohne Aufgabe'}</h1>
            {!b ? (
              <div className="dw-wahl" role="radiogroup" aria-label="Länge">
                {LAENGEN.map(([f, p], i) => <button key={f} type="button" role="radio" aria-checked={laenge === i} onClick={() => setLaenge(i)}>{f} + {p}</button>)}
              </div>
            ) : null}
            {naechste ? <div className="dw-zeile"><span className="grow">{taskTitle(naechste)}</span><small>danach</small></div> : null}
            {termin ? <div className="dw-zeile"><span className="grow">{hhmm(termin.von)} {termin.titel}</span><small>in {dauer(termin.von - ab)}</small></div> : null}
            {musikChips}
            {imTest && !b ? <p className="dw-leise">Dein Musiktest wählt: {MUSIK_NAME[d.naechste!]}. So bleibt der Vergleich fair.</p> : null}
            {b && ph?.phase === 'fokus' && m.titel ? <p className="dw-leise dw-titel">{m.titel} · <button type="button" className="dw-link" onClick={m.naechstes}>Nächstes</button></p> : null}
            {b && ph?.phase === 'fokus' && b.musik !== 'stille' && !m.spielt ? <p className="dw-leise"><button type="button" className="dw-link" onClick={() => m.spielen(b.musik)}>Musik fortsetzen</button></p> : null}
            <div className="dw-unten">
              <button type="button" onClick={() => setParken(true)}>Gedanke parken</button>
              {b ? <button type="button" className="hell" onClick={() => blockBeenden(!!b.itemId)}>{b.itemId ? 'Erledigt' : 'Block beenden'}</button>
                : <button type="button" className="hell" onClick={() => starten()} disabled={busy}>{Icon.play}Starten</button>}
            </div>
            {b ? <button type="button" className="dw-link dw-ende" onClick={() => blockBeenden(false)}>Block beenden, Aufgabe bleibt offen</button> : null}
            {!b ? (
              <div className="dw-test">
                <button type="button" className="dw-link" aria-expanded={testOffen} onClick={() => setTestOffen(!testOffen)}>{d.test ? `Musiktest · Tag ${d.test.tag} von ${TEST_TAGE}` : 'Musiktest'}</button>
                {testOffen ? (
                  <div className="dw-testinhalt">
                    {d.test ? (
                      <>
                        {d.test.zeilen.map((z) => (
                          <div key={z.musik} className="fk-zeile"><span>{MUSIK_NAME[z.musik]}</span><span className="fk-spur-h"><i style={{ width: `${Math.round((z.anteil ?? 0) * 100)}%` }} /></span><small>{z.anteil === null ? `${z.bloecke} von 3` : `${Math.round(z.anteil * 100)} %`}</small></div>
                        ))}
                        <p className="dw-leise">{d.test.satz}</p>
                        <button type="button" className="dw-link" onClick={() => test('test-ende')}>{d.test.fertig ? 'Test abschließen' : 'Test abbrechen'}</button>
                      </>
                    ) : (
                      <>
                        <p className="dw-leise">Vierzehn Tage lang wechselt Life zwischen Klassik, Fokus-Welle und Stille. Nach jedem Block tippst du, wie es lief. Danach weißt du, was bei dir trägt.</p>
                        <button type="button" className="dw-link" onClick={() => test('test-start')}>Musiktest starten</button>
                      </>
                    )}
                    <p className="dw-leise">Musik: zehn freie Aufnahmen von Musopen (CC0). <Link href="/musik/QUELLEN.md" className="dw-link">Quellen</Link></p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {parken ? (
        <div className="dw-parken" role="dialog" aria-modal="true" aria-label="Gedanke parken">
          <textarea value={gedanke} onChange={(e) => setGedanke(e.target.value)} placeholder="Was dir gerade dazwischenkommt. Life hebt es auf, du bleibst dran." aria-label="Gedanke" maxLength={4000} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); gedankeParken(); } }} />
          <div className="dw-unten">
            <button type="button" onClick={() => setParken(false)}>Abbrechen</button>
            <button type="button" className="hell" disabled={!gedanke.trim()} onClick={gedankeParken}>Parken</button>
          </div>
        </div>
      ) : null}

      {pip ? createPortal(
        <div className="dw dw-mini">
          <div className="dw-mini-reihe">
            <b>{ph ? uhr(ph.restSek) : `${LAENGEN[laenge][0]}:00`}</b>
            <span><span className="dw-mini-sache">{sache || 'Deep Work'}</span><small>{termin ? `${hhmm(termin.von)} ${termin.titel}` : ph?.phase === 'pause' ? 'Pause' : MUSIK_NAME[b ? m.art : musik]}</small></span>
          </div>
          <div className="dw-unten">
            {b ? <button type="button" onClick={() => (m.spielt ? m.stop() : m.spielen(b.musik))}>{m.spielt ? 'Pause' : 'Musik'}</button> : null}
            <button type="button" onClick={() => { window.focus(); setParken(true); }}>Parken</button>
            {b ? <button type="button" className="hell" onClick={() => { window.focus(); blockBeenden(!!b.itemId); }}>Erledigt</button> : <button type="button" className="hell" onClick={() => starten()}>Starten</button>}
          </div>
        </div>, pip.document.body) : null}
      {toast}
    </main>
  );
}
