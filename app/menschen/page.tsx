'use client';
import { useCallback, useEffect, useState } from 'react';
import { TabBar, TopBar, api, useToast } from '../ui';

type P = { id: string; name: string; kreis: string; geburtstag: string | null; takt_tage: number; notiz: string | null; letzter: string | null; seit: number; faellig: boolean; stunden: number; kontakte: number; bisGeburtstag: number | null; freundschaft: { stufe: string; naechste: number | null } | null };
const KREISFARBE: Record<string, string> = { familie: 'var(--k-mental)', freunde: 'var(--k-sozial)', team: 'var(--k-zeit)', netzwerk: 'var(--k-geld)', kunden: 'var(--k-koerper)' };
type M = { liste: P[]; faellig: P[]; geburtstage: P[]; vorschlaege: string[]; wocheMin: number; familieMin: number };

const KREISE: [string, string][] = [['familie', 'Familie'], ['freunde', 'Freunde'], ['team', 'Team'], ['netzwerk', 'Netzwerk und Kunden']];
const TAKTE: [number, string][] = [[7, 'jede Woche'], [14, 'alle 2 Wochen'], [21, 'alle 3 Wochen'], [30, 'monatlich'], [60, 'alle 2 Monate'], [90, 'alle 3 Monate']];
const STD = (min: number) => `${Math.round((min / 60) * 10) / 10} Std.`.replace('.', ',').replace(',Std', ' Std');
const seitText = (p: P) => (p.letzter ? (p.seit === 0 ? 'heute' : p.seit === 1 ? 'gestern' : `vor ${p.seit} Tagen`) : 'noch kein Kontakt');

function Kontakt({ p, onKontakt }: { p: P; onKontakt: (art: string, min: number | null) => void }) {
  return (
    <div className="fb-opts" aria-label={`Kontakt mit ${p.name} festhalten`}>
      <button type="button" className="chipbtn" onClick={() => onKontakt('treffen', 60)}>Treffen 1 Std.</button>
      <button type="button" className="chipbtn" onClick={() => onKontakt('treffen', 180)}>Abend 3 Std.</button>
      <button type="button" className="chipbtn" onClick={() => onKontakt('telefon', 20)}>Telefoniert</button>
      <button type="button" className="chipbtn" onClick={() => onKontakt('nachricht', null)}>Nachricht</button>
    </div>
  );
}

export default function Menschen() {
  const [m, setM] = useState<M | null>(null);
  const [name, setName] = useState(''); const [kreis, setKreis] = useState('freunde');
  const [offen, setOffen] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const laden = useCallback(async () => setM(await api<M>('/api/menschen')), []);
  useEffect(() => { laden().catch((e) => setToast((e as Error).message, 'err')); }, [laden, setToast]);
  const post = async (body: object, ok?: string) => { try { await api('/api/menschen', { method: 'POST', body: JSON.stringify(body) }); await laden(); if (ok) setToast(ok); } catch (e) { setToast((e as Error).message, 'err'); } };
  const patch = async (body: object) => { await api('/api/menschen', { method: 'PATCH', body: JSON.stringify(body) }).catch(() => {}); laden(); };
  const kontakt = (p: P) => (art: string, minuten: number | null) => post({ aktion: 'kontakt', person_id: p.id, art, minuten }, `Kontakt mit ${p.name} festgehalten`);

  return (
    <main className="wrap">
      <TopBar title="Menschen" back={{ label: 'Mehr', href: '/mehr' }} />
      <header className="head"><span className="eyebrow">Diese Woche {m ? `${STD(m.wocheMin)} mit Menschen, davon Familie ${STD(m.familieMin)}` : '…'}</span><h1 className="title">Menschen<i>.</i></h1></header>

      {m?.geburtstage.length ? (
        <section className="gsec" aria-label="Geburtstage">
          <h2 className="glabel">Geburtstage</h2>
          <div className="group">{m.geburtstage.map((p) => <div key={p.id} className="cell static"><span>{p.name}</span><span className="val">{p.bisGeburtstag === 0 ? 'heute' : p.bisGeburtstag === 1 ? 'morgen' : `in ${p.bisGeburtstag} Tagen`}</span></div>)}</div>
        </section>
      ) : null}

      {m?.faellig.length ? (
        <section className="gsec" aria-label="Fällig">
          <h2 className="glabel">Länger nichts gehört</h2>
          <div className="group pad">
            {m.faellig.slice(0, 6).map((p) => (
              <div key={p.id} className="fb-q"><div className="kb-top"><b>{p.name}</b><span className="num warn">{seitText(p)}</span></div><Kontakt p={p} onKontakt={kontakt(p)} /></div>
            ))}
          </div>
        </section>
      ) : null}

      {m?.vorschlaege.length ? (
        <section className="gsec" aria-label="Vorschläge">
          <h2 className="glabel">Neu in deinen Einträgen</h2>
          <div className="group pad">
            {m.vorschlaege.map((v) => (
              <div key={v} className="fb-q"><span className="fb-frage">{v}</span>
                <div className="fb-opts" aria-label={`${v} einem Kreis zuordnen`}>{KREISE.map(([k, l]) => <button key={k} type="button" className="fb-chip" onClick={() => post({ aktion: 'person', name: v, kreis: k }, `${v} unter ${l}`)}>{l}</button>)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {KREISE.map(([k, l]) => {
        const leute = (m?.liste ?? []).filter((p) => p.kreis === k);
        if (!leute.length) return null;
        return (
          <section key={k} className="gsec" aria-label={l}>
            <h2 className="glabel">{l}</h2>
            <div className="group pad">
              {leute.map((p) => (
                <div key={p.id} className="fb-q person-zeile">
                  <button type="button" className="person-kopf" aria-expanded={offen === p.id} onClick={() => setOffen(offen === p.id ? null : p.id)}>
                    <span className="avatar" style={{ background: KREISFARBE[p.kreis] ?? 'var(--faint)' }} aria-hidden="true">{p.name.slice(0, 1)}</span><b>{p.name}</b><span className={'num' + (p.faellig ? ' warn' : '')}>{seitText(p)}{p.stunden ? ` · ${STD(p.stunden * 60)}` : ''}</span>
                  </button>
                  {p.freundschaft ? <span className="small muted">{p.freundschaft.stufe}{p.freundschaft.naechste ? `, noch ${Math.max(0, Math.round(p.freundschaft.naechste - p.stunden))} Stunden bis zur nächsten Stufe` : ''}</span> : null}
                  <Kontakt p={p} onKontakt={kontakt(p)} />
                  {offen === p.id ? (
                    <div className="person-detail">
                      <span className="fb-sub">Kreis</span>
                      <div className="fb-opts" role="radiogroup" aria-label={`Kreis von ${p.name}`}>{KREISE.map(([kk, ll]) => <button key={kk} type="button" role="radio" aria-checked={p.kreis === kk} className="fb-chip" onClick={() => patch({ id: p.id, kreis: kk })}>{ll}</button>)}</div>
                      <span className="fb-sub">Wie oft Kontakt?</span>
                      <div className="fb-opts" role="radiogroup" aria-label={`Takt für ${p.name}`}>{TAKTE.map(([t, tl]) => <button key={t} type="button" role="radio" aria-checked={p.takt_tage === t} className="fb-chip" onClick={() => patch({ id: p.id, takt_tage: t })}>{tl}</button>)}</div>
                      <label className="fb-sub" htmlFor={`gb-${p.id}`}>Geburtstag</label>
                      <input id={`gb-${p.id}`} className="zeitfeld" type="date" value={p.geburtstag ?? ''} onChange={(e) => patch({ id: p.id, geburtstag: e.target.value })} />
                      <button type="button" className="linkbtn" onClick={async () => { await api(`/api/menschen?id=${p.id}`, { method: 'DELETE' }); laden(); }}>{p.name} entfernen</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="gsec" aria-label="Neuer Mensch">
        <h2 className="glabel">Mensch hinzufügen</h2>
        <div className="group pad">
          <input className="zeitfeld breit" aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="fb-opts" role="radiogroup" aria-label="Kreis">{KREISE.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kreis === k} className="fb-chip" onClick={() => setKreis(k)}>{l}</button>)}</div>
          <button type="button" className="btn primary" disabled={!name.trim()} onClick={async () => { await post({ aktion: 'person', name: name.trim(), kreis }, `${name.trim()} hinzugefügt`); setName(''); }}>Hinzufügen</button>
          <p className="gnote flush">Namen hier gehen nie im Klartext an Claude. Steht ein Name in einem Eintrag, zählt Life das als Kontakt.</p>
        </div>
      </section>
      {toast}
      <TabBar />
    </main>
  );
}
