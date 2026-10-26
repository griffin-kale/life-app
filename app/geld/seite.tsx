'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';
import { UeberKarte } from '../ueberkarte';
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
const FARBEN = ['var(--k-geld)', 'var(--k-zeit)', 'var(--k-sozial)', 'var(--k-koerper)', 'var(--k-mental)'];
const farbe = (i: number) => ({ '--c': FARBEN[i % FARBEN.length] }) as React.CSSProperties;

/** „noch etwa 40–60 €“ wird zu großer Zahl „40–60 €“ und kleinem Wort „noch etwa“. */
function teile(anzeige = ''): [string, string] {
  const m = anzeige.match(/^(noch etwa|noch) (.+)$/); if (m) return [m[2], m[1]];
  const d = anzeige.match(/^(.+) drüber$/); if (d) return [d[1], 'drüber'];
  return [anzeige, ''];
}

/** Ein Topf als Kachel, wie die Werte auf „Körper“: Name mit Farbpunkt, Zahl in der Serife, Balken. */
function TopfKachel({ t, i }: { t: Topf; i: number }) {
  const [wert, wort] = teile(t.anzeige);
  return (
    <div className="kachel topf" style={farbe(i)}>
      <span className="kachel-name"><i />{t.name}</span>
      <b className={t.ueber ? 'warn' : ''}>{wert}</b>
      <div className="kb-bar" role="progressbar" aria-label={t.name} aria-valuenow={t.ausgaben} aria-valuemax={t.rahmen}><i style={{ width: `${Math.min(100, ((t.ausgaben ?? 0) / Math.max(1, t.rahmen ?? 1)) * 100)}%` }} className={t.ueber ? 'drueber' : ''} /></div>
      <span className="kachel-fuss">{[wort, `Rahmen ${euro(t.rahmen ?? t.betrag_cent)}`, t.uebertrag ? `${euro(Math.min(t.uebertrag, t.betrag_cent))} aus der Vorwoche` : ''].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

const Loeschen = ({ onClick, label = 'Löschen' }: { onClick: () => void; label?: string }) => <button type="button" className="chipbtn" onClick={onClick}>{label}</button>;

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
      {ohneName
        ? <button type="button" className="btn" disabled={!c} onClick={async () => { await onSenden(n.trim(), c!); setB(''); }}>Speichern</button>
        : <button type="button" className="geld-plus" aria-label="Hinzufügen" disabled={!n.trim() || !c} onClick={async () => { await onSenden(n.trim(), c!); setN(''); setB(''); }}>{Icon.plus}</button>}
    </div>
  );
}

function Buchung({ b, g, onLoeschen }: { b: G['buchungen'][number]; g: G; onLoeschen: () => void }) {
  const i = g.woche.findIndex((t) => t.id === b.topf_id);
  const topf = [...g.woche, ...g.kinder].find((t) => t.id === b.topf_id)?.name ?? 'ohne Topf';
  return (
    <li className="cell static buchung" style={i >= 0 ? farbe(i) : undefined}>
      <span className="bu-punkt" aria-hidden="true" />
      <span className="bu-text"><b>{b.was}</b><span>{topf} · {b.quelle === 'bon' ? 'Bon' : b.wer}</span></span>
      <span className="bu-betrag num">{euro(b.cent)}</span>
      <Loeschen onClick={onLoeschen} />
    </li>
  );
}

export const TEILE: Record<string, string> = { plan: 'Stufenplan', monatlich: 'Monatlich', sparen: 'Sparziele', taschengeld: 'Taschengeld', zuletzt: 'Alle Buchungen' };

/** Geld als Übersicht: Ausgabe festhalten und die Töpfe der Woche oben, alles andere als Karte mit eigener Seite. */
export function GeldSeite({ teil }: { teil?: string }) {
  const [g, setG] = useState<G | null>(null);
  const [text, setText] = useState('');
  const [topf, setTopf] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [wahl, setWahl] = useState<Record<string, number>>({ Alltag: 15000, Familie: 5000, Spaß: 5000 });
  const [toast, setToast] = useToast();
  const foto = useRef<HTMLInputElement>(null);
  const laden = useCallback(async () => setG(await api<G>('/api/geld')), []);
  useEffect(() => { laden().catch((e) => setToast((e as Error).message, 'err')); }, [laden, setToast]);
  // Aus dem Schnellzugriff: direkt ins Ausgabe-Feld
  const springen = useRef(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('erfassen') === '1') { springen.current = true; window.history.replaceState(null, '', '/geld'); } }, []);
  useEffect(() => { if (springen.current && g?.woche.length) { springen.current = false; document.getElementById('geld-text')?.focus(); } }, [g]);

  async function post(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try { const r = await api<{ cent?: number; was?: string }>('/api/geld', { method: 'POST', body: JSON.stringify(body) }); await laden(); if (ok) setToast(r.cent ? `${euro(r.cent)} ${r.was ?? ''} festgehalten` : ok); return true; }
    catch (e) { setToast((e as Error).message, 'err'); return false; } finally { setBusy(false); }
  }
  async function loeschen(art: string, id: string) { await api(`/api/geld?art=${art}&id=${id}`, { method: 'DELETE' }).catch(() => {}); laden(); }

  const kw = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long' }).format(new Date());
  const summe = (a: G['posten'][number]['art']) => (g?.posten ?? []).filter((p) => p.art === a);
  const gesamt = (a: G['posten'][number]['art']) => summe(a).reduce((x, p) => x + p.cent, 0);
  const karten = !teil && g ? (
    <section className="ueber" aria-label="Bereiche">
      <UeberKarte c={{ href: '/geld/plan', titel: 'Stufenplan', farbe: 'var(--k-geld)', zahl: `Stufe ${g.aktuell.nr}`, sub: g.aktuell.titel }} />
      <UeberKarte c={{ href: '/geld/monatlich', titel: 'Monatlich', farbe: 'var(--k-zeit)', zahl: g.posten.length ? euro(gesamt('einnahme') - gesamt('fest')) : '–', sub: g.posten.length ? 'bleibt nach festen Kosten' : 'Einnahmen und Kosten eintragen' }} />
      <UeberKarte c={{ href: '/geld/sparen', titel: 'Sparziele', farbe: 'var(--k-koerper)', zahl: g.spar.length ? euro(g.spar.reduce((x, t) => x + t.stand_cent, 0)) : '–', sub: g.spar.length ? `von ${euro(g.spar.reduce((x, t) => x + t.betrag_cent, 0))} in ${g.spar.length} ${g.spar.length === 1 ? 'Ziel' : 'Zielen'}` : 'Noch kein Sparziel', aktion: { href: '/geld/sparen', text: g.spar.length ? 'Einzahlen' : '+ Sparziel' } }} />
      <UeberKarte c={{ href: '/geld/taschengeld', titel: 'Taschengeld', farbe: 'var(--k-sozial)', zahl: g.kinder.length ? euro(g.kinder.reduce((x, t) => x + (t.guthaben ?? 0), 0)) : '–', sub: g.kinder.length ? `Guthaben von ${g.kinder.length} ${g.kinder.length === 1 ? 'Kind' : 'Kindern'}` : 'Noch kein Kind angelegt' }} />
    </section>
  ) : null;
  return (
    <main className={'wrap' + (teil ? '' : ' breit')}>
      <TopBar title={teil ? TEILE[teil] : 'Geld'} back={teil ? { label: 'Geld', href: '/geld' } : undefined} />
      <header className="head"><span className="eyebrow">{teil ? 'Geld' : kw}</span><h1 className="title">{teil ? TEILE[teil] : 'Geld'}<i>.</i></h1></header>

      {!teil ? g?.warnungen.map((w) => <p key={w} className="coach-warn">{w}</p>) : null}

      {!teil && g && !g.woche.length ? (
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

      <div className="zwei-raster"><div className="spalte-gap">
      {!teil && g?.woche.length ? <>
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
          <div className="toepfe">{g.woche.map((t, i) => <TopfKachel key={t.id} t={t} i={i} />)}</div>
          <details className="disclose rahmen"><summary>{Icon.chevronRight}Rahmen ändern</summary>
            <div className="group pad">
              {g.woche.map((t) => (
                <div key={t.id} className="fb-q"><span className="fb-sub">{t.name}</span>
                  <div className="fb-opts" role="radiogroup" aria-label={`Rahmen ${t.name}`}>{WOCHE_BETRAEGE.map((c) => <button key={c} type="button" role="radio" aria-checked={t.betrag_cent === c} className="fb-chip" onClick={async () => { await api('/api/geld', { method: 'PATCH', body: JSON.stringify({ id: t.id, betrag_cent: c }) }); laden(); }}>{euro(c)}</button>)}</div>
                </div>
              ))}
            </div>
          </details>
        </section>

        {g.buchungen.length ? (
          <section className="gsec" aria-label="Zuletzt">
            <h2 className="glabel">Zuletzt</h2>
            <ul className="group buchungen">{g.buchungen.slice(0, 3).map((b) => <Buchung key={b.id} b={b} g={g} onLoeschen={() => loeschen('buchung', b.id)} />)}</ul>
            {g.buchungen.length > 3 ? <p className="gnote"><Link href="/geld/zuletzt" className="linkbtn">Alle Buchungen</Link></p> : null}
          </section>
        ) : null}
      </> : null}

      </div>{karten}</div>
      {g ? <>
        {teil === 'plan' ? <section className="gsec" aria-label="Stufenplan">
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
        </section> : null}

        {teil === 'monatlich' ? <section className="gsec-stapel" aria-label="Monatlich">
          {g.posten.length ? (
            <div className="werte drei">
              <div className="kachel" style={farbe(3)}><span className="kachel-name"><i />Einnahmen</span><b>{euro(gesamt('einnahme'))}</b></div>
              <div className="kachel" style={farbe(2)}><span className="kachel-name"><i />Kosten</span><b>{euro(gesamt('fest'))}</b></div>
              <div className="kachel" style={farbe(0)}><span className="kachel-name"><i />Bleibt</span><b>{euro(gesamt('einnahme') - gesamt('fest'))}</b></div>
            </div>
          ) : null}
          {([['einnahme', 'Einnahmen', 'Gehalt, Unternehmerlohn, Kindergeld'], ['fest', 'Feste Kosten', 'Miete, Versicherung, Abos'], ['schuld', 'Konsumschulden (Restbetrag)', 'Dispo, Ratenkredit']] as const).map(([art, titel, ph]) => (
            <div key={art} className="gsec">
              <h2 className="glabel">{titel}{summe(art).length ? ` · ${euro(gesamt(art))}` : ''}</h2>
              <div className="group">
                {summe(art).map((p) => <div key={p.id} className="cell static"><span className="lbl">{p.name}</span><span className="val"><span className="num">{euro(p.cent)}</span><Loeschen onClick={() => loeschen('posten', p.id)} /></span></div>)}
                <div className="cell static neu-zeile"><Neu label={titel} platzhalter={ph} onSenden={async (name, cent) => { await post({ aktion: 'posten', art, name, cent }); }} /></div>
              </div>
            </div>
          ))}
          <div className="gsec">
            <h2 className="glabel">Rücklage und Puffer</h2>
            <div className="group pad">
              <div className="fb-q">
                <span className="fb-frage">Rücklage auf dem Tagesgeld · {euro(g.profil.ruecklage)}</span>
                <Neu ohneName label="Rücklage" platzhalter="Stand in Euro" onSenden={async (_n, cent) => { await post({ aktion: 'profil', ruecklage_cent: cent }, 'Gespeichert'); }} />
              </div>
              <div className="fb-q">
                <span className="fb-frage">Sparrate pro Monat · {euro(g.profil.sparrate)}</span>
                <Neu ohneName label="Sparrate" platzhalter="Betrag pro Monat" onSenden={async (_n, cent) => { await post({ aktion: 'profil', sparrate_cent: cent }, 'Gespeichert'); }} />
              </div>
              <div className="fb-q">
                <span className="fb-frage">Wie groß soll der Puffer sein?</span>
                <div className="fb-opts" role="radiogroup" aria-label="Puffer in Monaten">{[3, 6, 9, 12].map((m) => <button key={m} type="button" role="radio" aria-checked={g.profil.pufferMonate === m} className="fb-chip" onClick={() => post({ aktion: 'profil', puffer_monate: m })}>{m} Monate</button>)}</div>
              </div>
            </div>
          </div>
        </section> : null}

        {teil === 'sparen' ? <section className="gsec-stapel" aria-label="Sparziele">
          {g.spar.map((t, i) => (
            <div key={t.id} className="kachel ziel" style={farbe(i + 3)}>
              <span className="kachel-name"><i />{t.name}</span>
              <b>{euro(t.stand_cent)}<small>von {euro(t.betrag_cent)}</small></b>
              <div className="kb-bar" role="progressbar" aria-label={t.name} aria-valuenow={t.stand_cent} aria-valuemax={t.betrag_cent}><i style={{ width: `${Math.min(100, (t.stand_cent / Math.max(1, t.betrag_cent)) * 100)}%` }} className={t.stand_cent >= t.betrag_cent ? 'voll' : ''} /></div>
              <div className="kachel-aktionen">{[2500, 5000, 10000].map((c) => <button key={c} type="button" className="chipbtn" onClick={() => post({ aktion: 'sparen', topf_id: t.id, cent: c }, 'Eingezahlt')}>+ {euro(c)}</button>)}<Loeschen label="Entfernen" onClick={() => loeschen('topf', t.id)} /></div>
            </div>
          ))}
          <h2 className="glabel">Neues Sparziel</h2>
          <div className="group pad">
            <Neu label="Sparziel" platzhalter="Urlaub, Fahrrad …" onSenden={async (name, cent) => { await post({ aktion: 'topf', art: 'spar', name, betrag_cent: cent }, 'Sparziel angelegt'); }} />
          </div>
        </section> : null}

        {teil === 'taschengeld' ? <section className="gsec-stapel" aria-label="Taschengeld">
          {g.kinder.map((t, i) => (
            <div key={t.id} className="kachel ziel" style={farbe(i + 2)}>
              <span className="kachel-name"><i />{t.name} · {euro(t.betrag_cent)} pro Woche</span>
              <b>{euro(t.guthaben ?? 0)}<small>Guthaben</small></b>
              <div className="kachel-aktionen" aria-label={`Ausgabe ${t.name}`}>{[50, 100, 200, 500].map((c) => <button key={c} type="button" className="chipbtn" onClick={() => post({ aktion: 'taschengeld', topf_id: t.id, cent: c }, 'Abgezogen')}>− {euro(c)}</button>)}<Loeschen label="Entfernen" onClick={() => loeschen('topf', t.id)} /></div>
            </div>
          ))}
          <h2 className="glabel">Kind anlegen</h2>
          <div className="group pad">
            <Neu label="Kind" platzhalter="Name" onSenden={async (name, cent) => { await post({ aktion: 'topf', art: 'kind', name, betrag_cent: cent }, 'Taschengeld angelegt'); }} />
          </div>
          <p className="gnote">Jeden Montag kommt der Wochenbetrag dazu. Die Namen der Kinder bleiben auf dem Server und gehen nie an Claude.</p>
        </section> : null}
        {teil === 'zuletzt' && g?.buchungen.length ? (
          <section className="gsec" aria-label="Alle Buchungen">
            <ul className="group buchungen">{g.buchungen.map((b) => <Buchung key={b.id} b={b} g={g} onLoeschen={() => loeschen('buchung', b.id)} />)}</ul>
          </section>
        ) : null}

      </> : <p className="muted small">Lädt …</p>}

      {toast}
      <TabBar />
    </main>
  );
}
