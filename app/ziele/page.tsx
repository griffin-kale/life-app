'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';
import { MiniRinge } from '../ringe';
import type { SaisonStand, ZielStand } from '@/lib/saison';

type HeuteZiele = { ziele: { ziel: string; offen: number; erledigt: number }[] };
type StandKurz = { wochenziel: string; engpass: string };
type KompassKurz = { jetzt: { ringe: Record<string, number | null> }; gesamt: { level: number } };
type SaisonAntwort = { saison: SaisonStand | null; start: string };

const BEREICH_FARBE: Record<string, string> = {
  geschaeft: 'var(--sky)', zeit: 'var(--k-zeit)', koerper: 'var(--k-koerper)', mental: 'var(--k-mental)', sozial: 'var(--k-sozial)', geld: 'var(--k-geld)',
};
const datum = (t: string, jahr = false) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', ...(jahr ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z'));
const STATUS: Record<string, [string, string]> = { kurs: ['ok', 'auf Kurs'], anpassen: ['an', 'anpassen'], daneben: ['da', 'daneben'] };

/**
 * Ziele (Life 2.0, Phase 2, Peter 29.10.2026): Saison mit Leitsatz und zwölf Wochen, darunter Zielkarten mit Hebeln.
 * Karten ohne Handlungsbedarf klappen zu. Ohne Saison: Einstieg ins Blatt „Neue Saison“ und die bisherige Liste.
 */
export default function Ziele() {
  const [s, setS] = useState<SaisonAntwort | null>(null);
  const [h, setH] = useState<HeuteZiele | null>(null);
  const [st, setSt] = useState<StandKurz | null>(null);
  const [k, setK] = useState<KompassKurz | null>(null);
  const [toast, setToast] = useToast();
  const laden = useCallback(() => api<SaisonAntwort>('/api/saison').then(setS).catch((e) => setToast((e as Error).message, 'err')), [setToast]);
  useEffect(() => {
    laden();
    api<HeuteZiele>('/api/heute').then(setH).catch(() => {});
    api<StandKurz>('/api/stand').then(setSt).catch(() => {});
    api<KompassKurz>('/api/kompass').then(setK).catch(() => {});
  }, [laden]);

  async function zaehlen(z: ZielStand, delta: 1 | -1) {
    if (!s?.saison) return;
    setS({ ...s, saison: { ...s.saison, ziele: s.saison.ziele.map((x) => (x.id === z.id ? { ...x, stand: Math.max(0, x.stand + delta) } : x)) } });
    try { await api(`/api/saison/ziele/${z.id}`, { method: 'PATCH', body: JSON.stringify({ delta }) }); laden(); }
    catch (e) { setToast((e as Error).message, 'err'); laden(); }
  }

  const sa = s?.saison ?? null;
  const eyebrow = !s ? '…' : !sa ? 'Bin ich auf Kurs?' : sa.woche < 1 ? `Saison ${sa.name} · beginnt am ${datum(sa.start)}` : `Saison ${sa.name} · Woche ${sa.woche} von 12`;
  return (
    <main className="wrap">
      <TopBar title="Ziele" />
      <header className="head"><span className="eyebrow">{eyebrow}</span><h1 className="title">Ziele<i>.</i></h1></header>

      {!s ? <p className="loading">Lädt …</p> : sa ? (
        <>
          <section className="sz-saison" aria-label="Saison">
            <div className="sz-zeile"><span>{datum(sa.start)} bis {datum(sa.ende, true)}</span><span>{sa.woche < 1 ? 'startet bald' : sa.woche >= 12 ? 'letzte Woche' : `noch ${12 - sa.woche} Wochen`}</span></div>
            <div className="sz-wochen" role="img" aria-label={sa.woche < 1 ? 'Die Saison hat noch nicht begonnen' : `Woche ${sa.woche} von 12`}>
              {Array.from({ length: 12 }, (_, i) => <i key={i} className={i + 1 < sa.woche ? 'vorbei' : i + 1 === sa.woche ? 'jetzt' : ''} />)}
            </div>
            {sa.leitsatz ? <p className="sz-leitsatz">„{sa.leitsatz}“</p> : null}
          </section>

          <section className="gsec" aria-label="Saisonziele">
            <h2 className="glabel">Saisonziele</h2>
            <div className="sz-ziele">
              {sa.ziele.map((z) => {
                const achtung = z.plan === 'dahinter' || z.hebel.some((x) => x.bewertung === 'anpassen' || x.bewertung === 'daneben');
                return (
                  <details key={z.id} className="sz-ziel" style={{ '--k': BEREICH_FARBE[z.bereich] } as React.CSSProperties} open={achtung || sa.woche <= 1} aria-label={z.titel}>
                    <summary>
                      <span className="sz-bereich">{z.bereichTitel}</span>
                      <b className="sz-titel">{z.titel}</b>
                      {z.anteil !== null ? (
                        <>
                          <span className="zl-balken" role="progressbar" aria-label={`${z.titel}: ${z.stand} von ${z.zielwert}`} aria-valuenow={z.stand} aria-valuemax={z.zielwert ?? undefined}><i style={{ width: `${Math.round(z.anteil * 100)}%`, background: 'var(--k)' }} /></span>
                          <small>{z.stand} von {z.zielwert}{z.plan ? ` · ${z.plan}` : ''}</small>
                        </>
                      ) : <small>{z.hebel.length ? `${z.hebel.filter((x) => x.bewertung === 'kurs').length} von ${z.hebel.length} Hebeln auf Kurs` : 'Noch ohne Hebel'}</small>}
                    </summary>
                    <div className="sz-mehr">
                      {z.hebel.length ? (
                        <ul className="sz-hebel" aria-label="Hebel">
                          {z.hebel.map((x) => (
                            <li key={x.id}>
                              <span className={'sz-punkt ' + (x.bewertung ? STATUS[x.bewertung][0] : 'offen')} aria-hidden="true" />
                              <span className="sz-ht">{x.titel}</span>
                              <small>{x.bewertung ? STATUS[x.bewertung][1] : 'neu'}</small>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {z.wennDann ? <p className="sz-wenn">{z.wennDann}</p> : null}
                      {z.offen || z.erledigtWoche ? <small className="sz-items">{z.erledigtWoche ? `${z.erledigtWoche} ${z.erledigtWoche === 1 ? 'Eintrag' : 'Einträge'} diese Woche erledigt` : 'Diese Woche noch nichts erledigt'}{z.offen ? ` · ${z.offen} offen` : ''}</small> : null}
                      {z.zielwert ? (
                        <div className="sz-zaehler">
                          <button type="button" className="chipbtn" onClick={() => zaehlen(z, -1)} disabled={z.stand <= 0} aria-label={`${z.titel}: einen weniger`}>−1</button>
                          <button type="button" className="chipbtn" onClick={() => zaehlen(z, 1)} aria-label={`${z.titel}: einen mehr`}>+1</button>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
            {sa.leer.length ? <p className="sz-leer">Ohne Ziel in dieser Saison: {sa.leer.map((b) => ({ geschaeft: 'Geschäft', zeit: 'Zeit', koerper: 'Körper', mental: 'Ruhe und Geist', sozial: 'Menschen', geld: 'Geld' } as Record<string, string>)[b]).join(', ')}. Das ist in Ordnung, wenige Ziele tragen weiter.</p> : null}
          </section>
        </>
      ) : (
        <section className="gsec" aria-label="Neue Saison">
          <Link href="/ziele/neu" className="ws-banner">
            <span><b>Neue Saison anlegen</b><small>Zwölf Wochen ab {datum(s.start)}. Ein Ziel pro Bereich, je drei Hebel, ein Wenn-dann-Plan. Etwa zehn Minuten.</small></span>
            {Icon.chevronRight}
          </Link>
          {h?.ziele.length ? (
            <>
              <h2 className="glabel">Bisherige Ziele</h2>
              <div className="zl-liste">
                {h.ziele.map((z) => {
                  const alle = z.offen + z.erledigt; const p = alle ? z.erledigt / alle : 0;
                  return (
                    <div key={z.ziel} className="group pad zl-ziel">
                      <b>{z.ziel}</b>
                      <span className="zl-balken" role="progressbar" aria-label={`${z.ziel}: ${z.erledigt} von ${alle} erledigt`} aria-valuenow={z.erledigt} aria-valuemax={alle}><i style={{ width: `${Math.round(p * 100)}%` }} /></span>
                      <small>{z.erledigt ? `${z.erledigt} erledigt diese Woche` : 'Diese Woche noch offen'}{z.offen ? ` · ${z.offen} ${z.offen === 1 ? 'Schritt' : 'Schritte'} offen` : ''}</small>
                    </div>
                  );
                })}
              </div>
              <p className="sz-leer">Diese Ziele schlägt das Blatt dir für die Saison vor.</p>
            </>
          ) : null}
        </section>
      )}

      <section className="gsec" aria-label="Diese Woche">
        <h2 className="glabel">Diese Woche</h2>
        <Link href="/wochenstart" className="group pad zl-woche">
          <span className="ck-name">Wochenziel</span>
          <b>{st?.wochenziel || 'Noch kein Wochenziel'}</b>
          <small>{st?.wochenziel ? 'Aus der Wochenrunde' : 'In der Wochenrunde legst du es in zehn Minuten fest'}</small>
          {st?.engpass ? <small>Engpass: {st.engpass}</small> : null}
        </Link>
      </section>

      <section className="gsec">
        <div className="group">
          <Link className="cell" href="/kompass">
            <span className="lbl">Kompass</span>
            <span className="val">{k ? <MiniRinge ringe={k.jetzt.ringe} level={k.gesamt.level} /> : null}{Icon.chevronRight}</span>
          </Link>
          <Link className="cell" href="/stand"><span className="lbl">Dein Stand</span><span className="val"><span>Richtung, Engpass</span>{Icon.chevronRight}</span></Link>
        </div>
      </section>
      {toast}
      <TabBar />
    </main>
  );
}
