'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar, TopBar, api, useToast } from '../ui';
import { betragAus, euro } from '@/lib/geld-regeln';

type Topf = { id: string; name: string; art: string; betrag_cent: number; stand_cent: number; ausgaben?: number; rahmen?: number; anzeige?: string; ueber?: boolean; uebertrag?: number; guthaben?: number };
type Stufe = { nr: number; titel: string; erklaerung: string; geschafft: boolean; fortschritt?: number };
type G = {
  wochentag: number; woche: Topf[]; kinder: Topf[]; spar: Topf[];
  buchungen: { id: string; tag: string; cent: number; was: string; quelle: string; topf_id: string | null; wer: string }[];
  posten: { id: string; art: 'einnahme' | 'fest' | 'schuld'; name: string; cent: number }[];
  profil: { ruecklage: number; sparrate: number; pufferMonate: number };
  stufen: Stufe[]; aktuell: Stufe; warnungen: string[];
};

const VORSCHLAG = ['Alltag', 'Familie', 'Spaß', 'Größeres', 'Auto', 'Drogerie'];
const WOCHE_BETRAEGE = [5000, 10000, 15000, 20000, 30000];
const centAus = (s: string) => betragAus(s)?.cent ?? null;

async function bonFoto(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82); // neu gespeichert, ohne Ortsdaten
  } finally { URL.revokeObjectURL(url); }
}

function Neu({ label, platzhalter, onSenden, ohneName }: { label: string; platzhalter: string; onSenden: (name: string, cent: number) => Promise<void>; ohneName?: boolean }) {
  const [n, setN] = useState(ohneName ? label : ''); const [b, setB] = useState('');
  const c = centAus(b);
  return (
    <div className="geld-neu">
      {ohneName ? null : <input aria-label={`${label}: Name`} placeholder={platzhalter} value={n} onChange={(e) => setN(e.target.value)} />}
      <input aria-label={`${label}: Betrag`} inputMode="decimal" placeholder={ohneName ? platzhalter : 'Betrag'} value={b} onChange={(e) => setB(e.target.value)} />
      <button type="button" className="btn" disabled={!n.trim() || !c} onClick={async () => { await onSenden(n.trim(), c!); if (!ohneName) setN(''); setB(''); }}>{ohneName ? 'Speichern' : 'Hinzufügen'}</button>
    </div>
  );
}

export default function Geld() {
  const [g, setG] = useState<G | null>(null);
  const [text, setText] = useState('');
  const [topf, setTopf] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [wahl, setWahl] = useState<Record<string, number>>({ Alltag: 15000, Familie: 5000, Spaß: 5000 });
  const [toast, setToast] = useToast();
  const foto = useRef<HTMLInputElement>(null);
  const laden = useCallback(async () => setG(await api<G>('/api/geld')), []);
  useEffect(() => { laden().catch((e) => setToast((e as Error).message, 'err')); }, [laden, setToast]);

  async function post(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try { const r = await api<{ cent?: number; was?: string }>('/api/geld', { method: 'POST', body: JSON.stringify(body) }); await laden(); if (ok) setToast(r.cent ? `${euro(r.cent)} ${r.was ?? ''} festgehalten` : ok); return true; }
    catch (e) { setToast((e as Error).message, 'err'); return false; } finally { setBusy(false); }
  }
  async function loeschen(art: string, id: string) { await api(`/api/geld?art=${art}&id=${id}`, { method: 'DELETE' }).catch(() => {}); laden(); }

  const kw = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long' }).format(new Date());
  const summe = (a: G['posten'][number]['art']) => (g?.posten ?? []).filter((p) => p.art === a);
  return (
    <main className="wrap">
      <TopBar title="Geld" />
      <header className="head"><span className="eyebrow">{kw}</span><h1 className="title">Geld<i>.</i></h1></header>

      {g?.warnungen.map((w) => <p key={w} className="coach-warn">{w}</p>)}

      {g && !g.woche.length ? (
        <section className="gsec" aria-label="Töpfe einrichten">
          <h2 className="glabel">Wochentöpfe einrichten</h2>
          <div className="group pad fb">
            <div className="fb-head"><b>Wenige Töpfe pro Woche</b><span>Jede Ausgabe landet in einem Topf. Am Ende der Woche zeigt Life den Rest als Spanne, weil genaue Restbeträge zum Ausgeben verleiten. Übrig Gebliebenes wandert eine Woche weiter.</span></div>
            {VORSCHLAG.map((n) => (
              <div key={n} className="fb-q">
                <button type="button" aria-pressed={n in wahl} className="fb-chip left" onClick={() => setWahl((w) => { const x = { ...w }; if (n in x) delete x[n]; else x[n] = 5000; return x; })}>{n}</button>
                {n in wahl ? <div className="fb-opts" role="radiogroup" aria-label={`Rahmen ${n}`}>{WOCHE_BETRAEGE.map((c) => <button key={c} type="button" role="radio" aria-checked={wahl[n] === c} className="fb-chip" onClick={() => setWahl((w) => ({ ...w, [n]: c }))}>{euro(c)}</button>)}</div> : null}
              </div>
            ))}
            <button type="button" className="btn primary" disabled={busy || !Object.keys(wahl).length} onClick={async () => { for (const [name, betrag_cent] of Object.entries(wahl)) await post({ aktion: 'topf', art: 'woche', name, betrag_cent }); setToast('Töpfe angelegt'); }}>Töpfe anlegen</button>
          </div>
        </section>
      ) : null}

      {g?.woche.length ? <>
        <section className="capture compact" aria-label="Ausgabe festhalten">
          <textarea id="geld-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="12,50 Bäcker" aria-label="Ausgabe, zum Beispiel 12,50 Bäcker" rows={1} />
          <div className="fb-opts" role="radiogroup" aria-label="Topf">
            <button type="button" role="radio" aria-checked={!topf} className="fb-chip" onClick={() => setTopf('')}>Claude ordnet zu</button>
            {g.woche.map((t) => <button key={t.id} type="button" role="radio" aria-checked={topf === t.id} className="fb-chip" onClick={() => setTopf(t.id)}>{t.name}</button>)}
          </div>
          <div className="row-btns">
            <button type="button" className="btn primary" disabled={busy || !betragAus(text)} onClick={async () => { if (await post({ aktion: 'buchung', text, topf_id: topf || undefined }, 'Festgehalten')) setText(''); }}>{busy ? 'Speichert …' : 'Festhalten'}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => foto.current?.click()}>Bon fotografieren</button>
            <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await post({ aktion: 'bon', bild: await bonFoto(f), topf_id: topf || undefined }, 'Bon gelesen'); }} />
          </div>
        </section>

        <section className="gsec" aria-label="Diese Woche">
          <h2 className="glabel">Diese Woche</h2>
          <div className="group pad">
            {g.woche.map((t) => (
              <div key={t.id} className="kb-row">
                <div className="kb-top"><span>{t.name}</span><span className={'num' + (t.ueber ? ' warn' : '')}>{t.anzeige}</span></div>
                <div className="kb-bar" role="progressbar" aria-label={t.name} aria-valuenow={t.ausgaben} aria-valuemax={t.rahmen}><i style={{ width: `${Math.min(100, ((t.ausgaben ?? 0) / Math.max(1, t.rahmen ?? 1)) * 100)}%` }} className={t.ueber ? 'drueber' : ''} /></div>
                {t.uebertrag ? <span className="gnote flush">{euro(Math.min(t.uebertrag, t.betrag_cent))} aus der Vorwoche dabei</span> : null}
              </div>
            ))}
            <details className="disclose"><summary>Rahmen ändern</summary>
              {g.woche.map((t) => (
                <div key={t.id} className="fb-q"><span className="fb-sub">{t.name}</span>
                  <div className="fb-opts" role="radiogroup" aria-label={`Rahmen ${t.name}`}>{WOCHE_BETRAEGE.map((c) => <button key={c} type="button" role="radio" aria-checked={t.betrag_cent === c} className="fb-chip" onClick={async () => { await api('/api/geld', { method: 'PATCH', body: JSON.stringify({ id: t.id, betrag_cent: c }) }); laden(); }}>{euro(c)}</button>)}</div>
                </div>
              ))}
            </details>
          </div>
        </section>

        {g.buchungen.length ? (
          <section className="gsec" aria-label="Zuletzt">
            <h2 className="glabel">Zuletzt</h2>
            <ul className="group pad essen-liste">
              {g.buchungen.map((b) => (
                <li key={b.id}><div><b>{euro(b.cent)} · {b.was}</b><span>{[...g.woche, ...g.kinder].find((t) => t.id === b.topf_id)?.name ?? 'ohne Topf'} · {b.quelle === 'bon' ? 'Bon' : b.wer}</span></div>
                  <button type="button" className="chipbtn" onClick={() => loeschen('buchung', b.id)}>Löschen</button></li>
              ))}
            </ul>
          </section>
        ) : null}
      </> : null}

      {g ? <>
        <section className="gsec" aria-label="Stufenplan">
          <h2 className="glabel">Stufenplan · Stufe {g.aktuell.nr} von 7</h2>
          <ol className="group pad stufenplan">
            {g.stufen.map((s) => (
              <li key={s.nr} className={s.nr === g.aktuell.nr ? 'jetzt' : s.geschafft ? 'ok' : ''}>
                <b>{s.geschafft ? '✓ ' : ''}{s.titel}</b>
                {s.nr === g.aktuell.nr ? <><span>{s.erklaerung}</span>{s.fortschritt !== undefined ? <div className="kb-bar"><i style={{ width: `${Math.round(s.fortschritt * 100)}%` }} /></div> : null}</> : null}
              </li>
            ))}
          </ol>
          <p className="gnote">Angelehnt an Dave Ramseys Baby Steps und die Empfehlungen der Verbraucherzentrale. Life ist keine Finanzberatung.</p>
        </section>

        <section className="gsec" aria-label="Monatlich">
          <h2 className="glabel">Monatlich</h2>
          <div className="group pad">
            {([['einnahme', 'Einnahmen', 'Gehalt, Unternehmerlohn, Kindergeld'], ['fest', 'Feste Kosten', 'Miete, Versicherung, Abos'], ['schuld', 'Konsumschulden (Restbetrag)', 'Dispo, Ratenkredit']] as const).map(([art, titel, ph]) => (
              <div key={art} className="fb-q">
                <span className="fb-frage">{titel}{summe(art).length ? ` · ${euro(summe(art).reduce((a, p) => a + p.cent, 0))}` : ''}</span>
                {summe(art).map((p) => <div key={p.id} className="geld-zeile"><span>{p.name}</span><span className="num">{euro(p.cent)}</span><button type="button" className="chipbtn" onClick={() => loeschen('posten', p.id)}>Löschen</button></div>)}
                <Neu label={titel} platzhalter={ph} onSenden={async (name, cent) => { await post({ aktion: 'posten', art, name, cent }); }} />
              </div>
            ))}
            <div className="fb-q">
              <span className="fb-frage">Rücklage auf dem Tagesgeld · {euro(g.profil.ruecklage)}</span>
              <Neu ohneName label="Rücklage" platzhalter="Stand in Euro" onSenden={async (_n, cent) => { await post({ aktion: 'profil', ruecklage_cent: cent }, 'Gespeichert'); }} />
              <span className="fb-frage">Sparrate pro Monat · {euro(g.profil.sparrate)}</span>
              <Neu ohneName label="Sparrate" platzhalter="Betrag pro Monat" onSenden={async (_n, cent) => { await post({ aktion: 'profil', sparrate_cent: cent }, 'Gespeichert'); }} />
              <span className="fb-frage">Wie groß soll der Puffer sein?</span>
              <div className="fb-opts" role="radiogroup" aria-label="Puffer in Monaten">{[3, 6, 9, 12].map((m) => <button key={m} type="button" role="radio" aria-checked={g.profil.pufferMonate === m} className="fb-chip" onClick={() => post({ aktion: 'profil', puffer_monate: m })}>{m} Monate</button>)}</div>
            </div>
          </div>
        </section>

        <section className="gsec" aria-label="Sparziele">
          <h2 className="glabel">Sparziele</h2>
          <div className="group pad">
            {g.spar.map((t) => (
              <div key={t.id} className="kb-row">
                <div className="kb-top"><span>{t.name}</span><span className="num">{euro(t.stand_cent)} / {euro(t.betrag_cent)}</span></div>
                <div className="kb-bar"><i style={{ width: `${Math.min(100, (t.stand_cent / Math.max(1, t.betrag_cent)) * 100)}%` }} className={t.stand_cent >= t.betrag_cent ? 'voll' : ''} /></div>
                <div className="fb-opts">{[2500, 5000, 10000].map((c) => <button key={c} type="button" className="fb-chip" onClick={() => post({ aktion: 'sparen', topf_id: t.id, cent: c }, 'Eingezahlt')}>+ {euro(c)}</button>)}<button type="button" className="chipbtn" onClick={() => loeschen('topf', t.id)}>Entfernen</button></div>
              </div>
            ))}
            <Neu label="Sparziel" platzhalter="Urlaub, Fahrrad …" onSenden={async (name, cent) => { await post({ aktion: 'topf', art: 'spar', name, betrag_cent: cent }, 'Sparziel angelegt'); }} />
          </div>
        </section>

        <section className="gsec" aria-label="Taschengeld">
          <h2 className="glabel">Taschengeld</h2>
          <div className="group pad">
            {g.kinder.map((t) => (
              <div key={t.id} className="fb-q">
                <div className="kb-top"><span>{t.name} · {euro(t.betrag_cent)} pro Woche</span><b className="num">{euro(t.guthaben ?? 0)}</b></div>
                <div className="fb-opts" aria-label={`Ausgabe ${t.name}`}>{[50, 100, 200, 500].map((c) => <button key={c} type="button" className="fb-chip" onClick={() => post({ aktion: 'taschengeld', topf_id: t.id, cent: c }, 'Abgezogen')}>− {euro(c)}</button>)}<button type="button" className="chipbtn" onClick={() => loeschen('topf', t.id)}>Entfernen</button></div>
              </div>
            ))}
            <Neu label="Kind" platzhalter="Name" onSenden={async (name, cent) => { await post({ aktion: 'topf', art: 'kind', name, betrag_cent: cent }, 'Taschengeld angelegt'); }} />
            <p className="gnote flush">Jeden Montag kommt der Wochenbetrag dazu. Die Namen der Kinder bleiben auf dem Server und gehen nie an Claude.</p>
          </div>
        </section>
      </> : <p className="muted small">Lädt …</p>}

      {toast}
      <TabBar />
    </main>
  );
}
