'use client';
import { useCallback, useEffect, useState } from 'react';
import { Icon, STAPEL, TabBar, TaskRow, TopBar, api, fTime, useToast, type Item, type Stand } from '../ui';
import { Fragebogen } from '../fragebogen';
import { useCheckins } from '../coach';

const REIHE = ['jetzt', 'woche', 'delegieren', 'geparkt', 'streichen'] as const;

function kw(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

export default function Woche() {
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

  const items = st?.items ?? [];
  const nach = (s: string) => items.filter((i) => i.stapel === s).sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
  const neu = items.filter((i) => !i.stapel);

  return (
    <main className="wrap">
      <TopBar title="Woche" />
      <header className="head">
        <span className="eyebrow">KW {kw()}{st ? ` · ${st.erledigtWoche} erledigt` : ''}</span>
        <h1 className="title">Woche<i>.</i></h1>
        {st?.engpass ? <p className="engpass"><b>Engpass</b><span>{st.engpass}</span></p> : null}
      </header>
      {ci.zeige === 'woche' ? (
        <section className="gsec" aria-label="Wochenbogen">
          <Fragebogen art="woche" onFertig={() => { ci.fertig(); setToast('Wochenbogen gespeichert'); }} onFehler={(m) => setToast(m, 'err')} />
        </section>
      ) : ci.who5 !== null ? <p className="gnote">Wohlbefinden (WHO-5) diese Woche: {ci.who5} von 100{ci.who5 < 51 ? '. Unter 51 lohnt ein genauerer Blick, gern auch mit ärztlichem Rat.' : ''}</p> : null}

      {st?.ziele.length ? (
        <section className="gsec">
          <h2 className="glabel">Ziele</h2>
          <div className="group">
            {st.ziele.map((z) => (
              <div key={z.ziel} className="cell static"><span className="lbl">{z.ziel}</span><span className="val"><span>{z.offen} offen · {z.erledigt} erledigt</span></span></div>
            ))}
          </div>
        </section>
      ) : null}

      {st === null ? <div className="loading">Lädt …</div> : null}
      {st && !items.length ? <div className="empty"><b>Alles erledigt.</b>Was du festhältst und zu tun ist, sortiert Claude hier ein.</div> : null}

      {REIHE.map((s) => {
        const liste = nach(s);
        if (!liste.length) return null;
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
            {s === 'streichen' ? <p className="gnote">Claude schlägt vor, das zu streichen. Gestrichenes liegt im Logbuch unter Archiviert.</p> : null}
          </section>
        );
      })}

      {neu.length ? (
        <section className="gsec">
          <h2 className="glabel">Noch nicht einsortiert · {neu.length}</h2>
          <ul className="tasks group">{neu.map((it) => <TaskRow key={it.id} it={it} from="woche" onToggle={() => toggle(it)} leaving={leaving === it.id} />)}</ul>
        </section>
      ) : null}

      {st && items.length ? (
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
