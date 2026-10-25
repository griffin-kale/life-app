'use client';
import { useCallback, useEffect, useState } from 'react';
import { Icon, STAPEL, TabBar, TaskRow, TopBar, api, fTime, useToast, type Item, type Stand } from '../ui';
import { Fragebogen } from '../fragebogen';
import { useCheckins } from '../coach';
import { ZeitKaufen } from '../zeit-kaufen';
import { UeberKarte } from '../ueberkarte';
import { MitInspektor } from '../inspektor';

const REIHE = ['jetzt', 'woche', 'delegieren', 'geparkt', 'streichen'] as const;

function kw(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

export const TEILE: Record<string, string> = { ziele: 'Ziele', energie: 'Energie-Bilanz', 'zeit-kaufen': 'Zeit kaufen', parkplatz: 'Parkplatz' };

/** Woche: oben der Wochenbogen und vier Karten, darunter die Stapel. Ziele, Energie, Zeit kaufen und Parkplatz haben eigene Seiten. */
export function WocheSeite({ teil }: { teil?: string }) {
  const [st, setSt] = useState<Stand | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const ci = useCheckins(true);
  const load = useCallback(async () => { setSt(await api<Stand>('/api/heute')); }, []);
  useEffect(() => { load().catch((e) => setToast((e as Error).message, 'err')); }, [load, setToast]);
  useEffect(() => {
    if (!st?.laeuft) return;
    const t = setTimeout(() => load().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [st, load]);

  const patch = (id: string, body: Record<string, unknown>) => api<Item & { verdraengt?: string | null }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  async function act(id: string | null, fn: () => Promise<unknown>) {
    if (id) setLeaving(id);
    try { await fn(); } catch (e) { setToast((e as Error).message, 'err'); }
    finally { if (id) await new Promise((r) => setTimeout(r, 300)); setLeaving(null); await load().catch(() => {}); }
  }
  const toggle = (it: Item) => act(it.id, async () => {
    await patch(it.id, { erledigt: true });
    setToast('Erledigt', 'ok', { label: 'Rückgängig', run: () => act(null, () => patch(it.id, { erledigt: false })) });
  });
  const verschieben = (it: Item, stapel: string) => act(it.id, async () => {
    const r = await patch(it.id, { stapel });
    const von = it.stapel ?? 'woche';
    setToast(r.verdraengt ? `„${r.verdraengt.slice(0, 40)}“ rückt in die Woche` : `${STAPEL[stapel]}`, 'ok', { label: 'Rückgängig', run: () => act(null, () => patch(it.id, { stapel: von })) });
  });
  const streichen = (it: Item) => act(it.id, async () => {
    await patch(it.id, { status: 'archiv' });
    setToast('Gestrichen', 'ok', { label: 'Rückgängig', run: () => act(null, () => patch(it.id, { status: 'sortiert' })) });
  });

  const [zk, setZk] = useState<number | null>(null);
  useEffect(() => { api<{ status: string }[]>('/api/zeit-kaufen').then((l) => setZk(l.filter((x) => x.status === 'idee').length)).catch(() => {}); }, []);
  const items = st?.items ?? [];
  const nach = (s: string) => items.filter((i) => i.stapel === s).sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
  const neu = items.filter((i) => !i.stapel);

  const liste = (<>
      {st === null ? <div className="loading">Lädt …</div> : null}
      {!teil && st && !items.length ? <div className="empty"><b>Alles erledigt.</b>Was du festhältst und zu tun ist, sortiert Claude hier ein.</div> : null}

      {REIHE.map((s) => {
        const liste = nach(s);
        if (!liste.length) return null;
        if (teil ? !(teil === 'parkplatz' && s === 'geparkt') : s === 'geparkt') return null;
        return (
          <section key={s} className="gsec">
            <h2 className="glabel">{STAPEL[s]} · {liste.length}</h2>
            <ul className="tasks group">
              {liste.map((it) => (
                <TaskRow key={it.id} it={it} from="woche" onToggle={s === 'streichen' ? undefined : () => toggle(it)} leaving={leaving === it.id}>
                  {s === 'streichen' ? <>
                    <button type="button" className="chipbtn danger" onClick={() => streichen(it)}>Streichen</button>
                    <button type="button" className="chipbtn" onClick={() => verschieben(it, 'woche')}>Behalten</button>
                  </> : (
                    <label className="chipbtn">
                      <span>Verschieben</span>{Icon.updown}
                      <select aria-label="Verschieben nach" value="" onChange={(e) => e.target.value && verschieben(it, e.target.value)}>
                        <option value="" disabled>Verschieben nach …</option>
                        {REIHE.filter((x) => x !== s).map((x) => <option key={x} value={x}>{STAPEL[x]}</option>)}
                      </select>
                    </label>
                  )}
                </TaskRow>
              ))}
            </ul>
            {s === 'geparkt' ? <p className="gnote">Der Parkplatz für Ideen ohne Bezug zum Engpass. Entscheide montags in der Wochenrunde, was davon in die Woche kommt.</p> : null}
            {s === 'streichen' ? <p className="gnote">Claude schlägt vor, das zu streichen. Gestrichenes liegt im Logbuch unter Archiviert.</p> : null}
          </section>
        );
      })}

  </>);

  return (
    <main className={'wrap' + (teil ? '' : ' breit')}>
      <TopBar title={teil ? TEILE[teil] : 'Woche'} back={teil ? { label: 'Woche', href: '/woche' } : undefined} />
      <header className="head">
        <span className="eyebrow">KW {kw()}{st && !teil ? ` · ${st.erledigtWoche} erledigt` : ''}</span>
        <h1 className="title">{teil ? TEILE[teil] : 'Woche'}<i>.</i></h1>
        {st?.engpass && !teil ? <p className="engpass"><b>Engpass</b><span>{st.engpass}</span></p> : null}
      </header>
      {teil ? null : ci.zeige === 'woche' ? (
        <section className="gsec" aria-label="Wochenbogen">
          <Fragebogen art="woche" onFertig={() => { ci.fertig(); setToast('Wochenbogen gespeichert'); }} onFehler={(m) => setToast(m, 'err')} />
        </section>
      ) : ci.who5 !== null ? <p className="gnote">Wohlbefinden (WHO-5) diese Woche: {ci.who5} von 100{ci.who5 < 51 ? '. Unter 51 lohnt ein genauerer Blick, gern auch mit ärztlichem Rat.' : ''}</p> : null}

      {!teil && st ? (
        <section className="ueber" aria-label="Bereiche">
          <UeberKarte c={{ href: '/woche/ziele', titel: 'Ziele', farbe: 'var(--k-zeit)', zahl: `${st.ziele.reduce((a, z) => a + z.offen, 0)} offen`, sub: `${st.ziele.reduce((a, z) => a + z.erledigt, 0)} erledigt in ${st.ziele.length} ${st.ziele.length === 1 ? 'Ziel' : 'Zielen'}` }} />
          <UeberKarte c={{ href: '/woche/energie', titel: 'Energie', farbe: 'var(--k-koerper)', zahl: st.kraft ? `${st.kraft.gab.length} : ${st.kraft.kostete.length}` : '–', sub: 'gab Kraft zu kostete Kraft' }} />
          <UeberKarte c={{ href: '/woche/zeit-kaufen', titel: 'Zeit kaufen', farbe: 'var(--k-geld)', zahl: zk === null ? '–' : `${zk} ${zk === 1 ? 'Idee' : 'Ideen'}`, sub: 'Was du abgeben könntest', aktion: { href: '/woche/zeit-kaufen', text: '+ Idee' } }} />
          <UeberKarte c={{ href: '/woche/parkplatz', titel: 'Parkplatz', farbe: 'var(--k-mental)', zahl: `${nach('geparkt').length}`, sub: 'Ideen ohne Bezug zum Engpass' }} />
        </section>
      ) : null}

      {teil === 'ziele' && st?.ziele.length ? (
        <section className="gsec">
          <h2 className="glabel">Ziele</h2>
          <div className="group">
            {st.ziele.map((z) => (
              <div key={z.ziel} className="cell static"><span className="lbl">{z.ziel}</span><span className="val"><span>{z.offen} offen · {z.erledigt} erledigt</span></span></div>
            ))}
          </div>
        </section>
      ) : null}

      {teil ? liste : <MitInspektor back={{ label: 'Woche', href: '/woche' }} onGeaendert={() => load().catch(() => {})} leer={<div className="empty"><b>Wähl links eine Aufgabe.</b>Hier stehen dann Schritt, Ziel, Hebel, Frist und Einordnung.</div>}>{liste}</MitInspektor>}
      {teil === 'energie' && st?.kraft && !(st.kraft.gab.length || st.kraft.kostete.length) ? <div className="empty"><b>Noch keine Bilanz.</b>Tipp nach dem Abhaken auf „gab Kraft“ oder „kostete Kraft“, dann füllt sich die Woche.</div> : null}
      {teil === 'energie' && st?.kraft && (st.kraft.gab.length || st.kraft.kostete.length) ? (
        <section className="gsec" aria-label="Energie-Bilanz">
          <h2 className="glabel">Energie-Bilanz der Woche</h2>
          <div className="group pad">
            <div className="energieband" role="img" aria-label={`${st.kraft.gab.length} gaben Kraft, ${st.kraft.kostete.length} kosteten Kraft`}>
              <i style={{ flex: st.kraft.gab.length, background: 'var(--ok)' }} /><i style={{ flex: st.kraft.kostete.length, background: 'var(--bad)' }} />
            </div>
            <div className="energie-legende"><span style={{ '--c': 'var(--ok)' } as React.CSSProperties}>gab Kraft {st.kraft.gab.length}</span><span style={{ '--c': 'var(--bad)' } as React.CSSProperties}>kostete Kraft {st.kraft.kostete.length}</span></div>
            {st.kraft.gab.length ? <div className="fb-q"><span className="fb-frage okc">Gab dir Kraft</span>{st.kraft.gab.map((t) => <span key={t} className="small">{t}</span>)}</div> : null}
            {st.kraft.kostete.length ? <div className="fb-q"><span className="fb-frage warn">Kostete Kraft</span>{st.kraft.kostete.map((t) => <span key={t} className="small">{t}</span>)}</div> : null}
          </div>
          <p className="gnote">Aus deinen Tipps nach dem Abhaken. Was oft Kraft kostet, ist ein Kandidat zum Delegieren oder für „Zeit kaufen“.</p>
        </section>
      ) : null}

      {teil === 'zeit-kaufen' ? <ZeitKaufen onToast={(t, k) => setToast(t, k)} /> : null}

      {!teil && neu.length ? (
        <section className="gsec">
          <h2 className="glabel">Noch nicht einsortiert · {neu.length}</h2>
          <ul className="tasks group">{neu.map((it) => <TaskRow key={it.id} it={it} from="woche" onToggle={() => toggle(it)} leaving={leaving === it.id} />)}</ul>
        </section>
      ) : null}

      {!teil && st && items.length ? (
        <p className="gnote flush">
          {st.laeuft ? <span className="working">Claude sortiert …</span> : st.sortiertAm ? `Sortiert um ${fTime(st.sortiertAm)}` : 'Noch nicht sortiert'}
          {' · '}<button type="button" className="linkbtn" disabled={st.laeuft} onClick={() => { setSt((x) => x && { ...x, laeuft: true }); act(null, () => api('/api/heute', { method: 'POST' })); }}>Neu sortieren</button>
        </p>
      ) : null}
      {toast}
      <TabBar />
    </main>
  );
}
