'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';
import { useFokusMusik } from '../fokus-musik';
import {
  BEWERTUNG, BEWERTUNG_NAME, LAENGEN, MUSIK, MUSIK_NAME, TEST_TAGE, phase, uhr, type Bewertung, type Musik, type TestStand,
} from '@/lib/fokus-regeln';
import type { Block } from '@/lib/fokus';

type Antwort = { block: Block | null; heute: { bloecke: number; minuten: number }; test: TestStand | null; naechste: Musik | null };
type ItemKurz = { id: string; titel: string | null; schritt: string | null; text: string; status: string };

/**
 * Fokus (0.27, Peter 31.10.2026): ein Block mit fester Pause, Musik oder Stille, danach ein Tipp, wie es lief.
 * Die Zeit kommt aus der Startzeit auf dem Server, deshalb stimmt der Timer auch nach dem Schließen der App.
 */
export default function Fokus() {
  const [d, setD] = useState<Antwort | null>(null);
  const [item, setItem] = useState<ItemKurz | null>(null);
  const [laenge, setLaenge] = useState(0);
  const [musik, setMusik] = useState<Musik>('klassik');
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [bewerten, setBewerten] = useState(false);
  const [bewertung, setBewertung] = useState<Bewertung | null>(null);
  const [erledigt, setErledigt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const m = useFokusMusik();

  const laden = useCallback(() => api<Antwort>('/api/fokus').then((x) => { setD(x); return x; }), []);
  useEffect(() => {
    laden().catch((e) => setToast((e as Error).message, 'err'));
    const id = new URLSearchParams(window.location.search).get('item');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) api<ItemKurz>(`/api/items/${id}`).then(setItem).catch(() => {});
  }, [laden, setToast]);
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 1000); return () => clearInterval(t); }, []);

  const b = d?.block ?? null;
  const ph = b ? phase(Date.parse(b.start), b.minuten, b.pause, jetzt) : null;
  // In der Pause schweigt die Musik, am Ende fragt Life, wie es lief
  useEffect(() => { if (ph?.phase === 'pause' && m.spielt) m.stop(); }, [ph?.phase, m]);
  useEffect(() => { if (b && ph?.phase === 'fertig' && !bewerten) { m.stop(); setBewerten(true); } }, [b, ph?.phase, bewerten, m]);

  const imTest = !!d?.naechste;
  async function starten(basis: Antwort | null = d) {
    const d = basis; if (!d) return;
    const [minuten, pause] = LAENGEN[laenge];
    const gewaehlt: Musik = imTest ? d.naechste! : musik;
    m.spielen(gewaehlt); // noch im Tippen, sonst blockt das iPhone den Ton
    setBusy(true);
    try {
      const r = await api<{ block: Block }>('/api/fokus', { method: 'POST', body: JSON.stringify({ aktion: 'start', itemId: item?.id ?? null, minuten, pause, musik: imTest ? 'test' : musik }) });
      if (r.block.musik !== gewaehlt) m.spielen(r.block.musik);
      setD({ ...d, block: r.block }); setBewerten(false); setBewertung(null); setErledigt(false);
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
      if (erledigt) setItem(null);
      const x = await laden();
      setToast(bewertung ? `Festgehalten: ${BEWERTUNG_NAME[bewertung]}` : 'Block beendet');
      if (nochEiner && !erledigt) await starten(x);
    } catch (e) { setToast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  }
  async function test(aktion: 'test-start' | 'test-ende') {
    try { await api('/api/fokus', { method: 'POST', body: JSON.stringify({ aktion }) }); await laden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }

  const titel = b?.titel || (item ? (item.schritt || item.titel || item.text).slice(0, 120) : '');
  const umfang = 2 * Math.PI * 84;
  return (
    <main className="wrap">
      <TopBar title="Fokus" back={{ label: 'Heute', href: '/' }} />
      <header className="head">
        <span className="eyebrow">{d ? `Heute ${d.heute.bloecke} ${d.heute.bloecke === 1 ? 'Block' : 'Blöcke'} · ${d.heute.minuten} Min.` : '…'}</span>
        <h1 className="title fk-titel">{titel || 'Fokus'}<i>.</i></h1>
      </header>

      {!d ? <p className="loading">Lädt …</p> : b && bewerten ? (
        <section className="group pad fk-bewerten" aria-label="Wie gut ging es">
          <h2 className="ws-titel">Wie gut ging es?</h2>
          <div className="fb-opts" role="radiogroup" aria-label="Wie gut ging es">
            {BEWERTUNG.map((x) => <button key={x} type="button" role="radio" aria-checked={bewertung === x} className="fb-chip" onClick={() => setBewertung(x)}>{BEWERTUNG_NAME[x]}</button>)}
          </div>
          {b.itemId ? <button type="button" aria-pressed={erledigt} className="fb-chip left" onClick={() => setErledigt(!erledigt)}>{erledigt ? '✓ ' : ''}Aufgabe ist erledigt</button> : null}
          <p className="muted small">{b.test ? `Teil deines Musiktests: ${MUSIK_NAME[b.musik]}.` : `Musik: ${MUSIK_NAME[b.musik]}.`} Die Bewertung bleibt in Life.</p>
          <div className="fk-knoepfe">
            <button type="button" className="btn primary" disabled={busy} onClick={() => abschliessen(false)}>Fertig</button>
            <button type="button" className="btn" disabled={busy || erledigt} onClick={() => abschliessen(true)}>Noch ein Block</button>
          </div>
        </section>
      ) : b && ph ? (
        <section className="fk-karte" aria-label="Fokusblock">
          <div className="fk-ring" role="timer" aria-live="off" aria-label={`${ph.phase === 'pause' ? 'Pause' : 'Fokus'}: noch ${uhr(ph.restSek)}`}>
            <svg viewBox="0 0 190 190" aria-hidden="true">
              <circle cx="95" cy="95" r="84" className="fk-spur" />
              <circle cx="95" cy="95" r="84" className={'fk-wert' + (ph.phase === 'pause' ? ' pause' : '')} strokeDasharray={umfang} strokeDashoffset={umfang * ph.anteil} />
            </svg>
            <div><b>{uhr(ph.restSek)}</b><small>{ph.phase === 'pause' ? 'Pause, steh kurz auf' : `noch, dann ${b.pause} Min. Pause`}</small></div>
          </div>
          {ph.phase === 'fokus' ? (
            <div className="fk-musik">
              <button type="button" className="fk-play" onClick={() => (m.spielt ? m.stop() : m.spielen(b.musik))} aria-label={m.spielt ? 'Musik anhalten' : 'Musik abspielen'} disabled={b.musik === 'stille'}>{m.spielt ? Icon.pause : Icon.play}</button>
              <div><b>{MUSIK_NAME[b.musik]}</b><small>{m.titel ?? (b.musik === 'stille' ? 'Ohne Ton' : b.musik === 'rauschen' ? 'Braunes Rauschen' : 'Tippen zum Abspielen')}{b.test ? ' · Musiktest' : ''}</small></div>
              {m.titel ? <button type="button" className="chipbtn" onClick={m.naechstes}>Nächstes</button> : null}
            </div>
          ) : null}
          {b.musik !== 'stille' && ph.phase === 'fokus' ? (
            <label className="fk-laut">Lautstärke<input type="range" min={0} max={1} step={0.05} value={m.lautstaerke} onChange={(e) => m.setLautstaerke(Number(e.target.value))} aria-label="Lautstärke" /></label>
          ) : null}
          <button type="button" className="btn wide fk-ende" onClick={() => { m.stop(); setBewerten(true); }}>Block beenden</button>
        </section>
      ) : (
        <section className="group pad fk-start" aria-label="Fokus starten">
          {!item ? <p className="muted small">Ohne Aufgabe gestartet. Aus der Liste auf Heute startest du einen Block für eine bestimmte Aufgabe.</p> : null}
          <span className="fb-frage">Wie lange?</span>
          <div className="fb-opts" role="radiogroup" aria-label="Länge">
            {LAENGEN.map(([f, p], i) => <button key={f} type="button" role="radio" aria-checked={laenge === i} className="fb-chip" onClick={() => setLaenge(i)}>{f} + {p}</button>)}
          </div>
          <span className="fb-frage">Musik</span>
          {imTest ? <p className="muted small">Dein Musiktest wählt: <b>{MUSIK_NAME[d.naechste!]}</b>. So bleibt der Vergleich fair.</p> : (
            <div className="fb-opts" role="radiogroup" aria-label="Musik">
              {MUSIK.map((x) => <button key={x} type="button" role="radio" aria-checked={musik === x} className="fb-chip" onClick={() => setMusik(x)}>{MUSIK_NAME[x]}</button>)}
            </div>
          )}
          <button type="button" className="btn primary wide" onClick={() => starten()} disabled={busy}>{Icon.play}Fokus starten</button>
        </section>
      )}

      <section className="gsec" aria-label="Musiktest">
        <h2 className="glabel">Musiktest</h2>
        {d?.test ? (
          <div className="group pad fk-test">
            <span className="ck-name">Tag {d.test.tag} von {TEST_TAGE}{d.test.fertig ? ' · fertig' : ''}</span>
            <div className="fk-balken" role="img" aria-label={d.test.zeilen.map((z) => `${MUSIK_NAME[z.musik]}: ${z.anteil === null ? 'noch zu wenig' : Math.round(z.anteil * 100) + ' Prozent im Fluss'}`).join(', ')}>
              {d.test.zeilen.map((z) => (
                <div key={z.musik} className="fk-zeile">
                  <span>{MUSIK_NAME[z.musik]}</span>
                  <span className="fk-spur-h"><i style={{ width: `${Math.round((z.anteil ?? 0) * 100)}%` }} /></span>
                  <small>{z.anteil === null ? `${z.bloecke} von 3` : `${Math.round(z.anteil * 100)} %`}</small>
                </div>
              ))}
            </div>
            <p className="muted small">{d.test.satz} Gezählt wird der Anteil der Blöcke „im Fluss“.</p>
            <button type="button" className="linkbtn" onClick={() => test('test-ende')}>{d.test.fertig ? 'Test abschließen' : 'Test abbrechen'}</button>
          </div>
        ) : (
          <div className="group pad fk-test">
            <p className="muted small">Vierzehn Tage lang wechselt Life zwischen Klassik, Fokus-Welle und Stille. Nach jedem Block tippst du, wie es lief. Danach weißt du, was bei dir trägt.</p>
            <button type="button" className="btn" onClick={() => test('test-start')}>Musiktest starten</button>
          </div>
        )}
        <p className="sz-leer">Musik: zehn freie Aufnahmen von Musopen (CC0). <Link href="/musik/QUELLEN.md" className="linkbtn">Quellen</Link></p>
      </section>
      {toast}
      <TabBar />
    </main>
  );
}
