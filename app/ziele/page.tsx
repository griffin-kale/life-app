'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api } from '../ui';
import { MiniRinge } from '../ringe';

type HeuteZiele = { ziele: { ziel: string; offen: number; erledigt: number }[]; engpass: string };
type StandKurz = { wochenziel: string; engpass: string };
type KompassKurz = { jetzt: { ringe: Record<string, number | null> }; gesamt: { level: number } };

/**
 * Ziele (Life 2.0, Phase 1): Wochenziel, deine Ziele mit offenen und erledigten Schritten, Kompass und Dein Stand an einem Ort.
 * Phase 2 macht daraus Saisons à 12 Wochen mit Hebeln im Kalender.
 */
export default function Ziele() {
  const [h, setH] = useState<HeuteZiele | null>(null);
  const [s, setS] = useState<StandKurz | null>(null);
  const [k, setK] = useState<KompassKurz | null>(null);
  useEffect(() => {
    api<HeuteZiele>('/api/heute').then(setH).catch(() => {});
    api<StandKurz>('/api/stand').then(setS).catch(() => {});
    api<KompassKurz>('/api/kompass').then(setK).catch(() => {});
  }, []);
  return (
    <main className="wrap">
      <TopBar title="Ziele" />
      <header className="head"><span className="eyebrow">Bin ich auf Kurs?</span><h1 className="title">Ziele<i>.</i></h1></header>

      <section className="gsec" aria-label="Diese Woche">
        <h2 className="glabel">Diese Woche</h2>
        <Link href="/wochenstart" className="group pad zl-woche">
          <span className="ck-name">Wochenziel</span>
          <b>{s?.wochenziel || 'Noch kein Wochenziel'}</b>
          <small>{s?.wochenziel ? 'Aus dem Wochenstart' : 'Im Wochenstart legst du es in zehn Minuten fest'}</small>
          {s?.engpass ? <small>Engpass: {s.engpass}</small> : null}
        </Link>
      </section>

      <section className="gsec" aria-label="Deine Ziele">
        <h2 className="glabel">Deine Ziele</h2>
        {!h ? <div className="group pad"><p className="loading">Lädt …</p></div>
          : h.ziele.length ? (
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
          ) : (
            <div className="group pad zl-leer">
              <p>Noch keine Ziele. Mit Zielen ordnet Claude jeden Eintrag einem Ziel zu und zeigt hier, wie weit du bist.</p>
              <Link href="/einstellungen" className="btn primary">Ziele festlegen</Link>
            </div>
          )}
      </section>

      <section className="gsec">
        <div className="group">
          <Link className="cell" href="/kompass">
            <span className="lbl">Kompass</span>
            <span className="val">{k ? <MiniRinge ringe={k.jetzt.ringe} level={k.gesamt.level} /> : null}{Icon.chevronRight}</span>
          </Link>
          <Link className="cell" href="/stand"><span className="lbl">Dein Stand</span><span className="val"><span>Baseline, Richtung, Engpass</span>{Icon.chevronRight}</span></Link>
        </div>
      </section>
      <TabBar />
    </main>
  );
}
