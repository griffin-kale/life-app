'use client';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../../ui';
import { BAUSTEIN_NAME, BAUSTEINE, FEST, STANDARD, bausteineAus, type Baustein } from '@/lib/heute-bausteine';

/** Heute anpassen: Bausteine an- und ausschalten und in die Reihenfolge schieben. Jede Änderung speichert sofort. */
export default function HeuteAnpassen() {
  const [liste, setListe] = useState<Baustein[] | null>(null);
  const [toast, setToast] = useToast();
  useEffect(() => { api<{ bausteine: Baustein[] }>('/api/heute/bausteine').then((r) => setListe(bausteineAus(r.bausteine))).catch((e) => setToast((e as Error).message, 'err')); }, [setToast]);

  async function speichern(neu: Baustein[]) {
    const alt = liste; setListe(neu);
    try { const r = await api<{ bausteine: Baustein[] }>('/api/heute/bausteine', { method: 'PUT', body: JSON.stringify({ bausteine: neu }) }); setListe(r.bausteine); }
    catch (e) { setListe(alt); setToast((e as Error).message, 'err'); }
  }
  const schieben = (i: number, um: number) => { if (!liste) return; const n = [...liste]; const [x] = n.splice(i, 1); n.splice(i + um, 0, x); speichern(n); };
  const aus = liste ? BAUSTEINE.filter((b) => !liste.includes(b)) : [];

  return (
    <main className="wrap">
      <TopBar title="Heute anpassen" back={{ label: 'Einstellungen', href: '/einstellungen' }} />
      <header className="head"><span className="eyebrow">Was du morgens sehen willst</span><h1 className="title">Heute anpassen<i>.</i></h1></header>
      {liste ? <>
        <section className="gsec" aria-label="Angezeigt">
          <h2 className="glabel">Angezeigt, in dieser Reihenfolge</h2>
          <ul className="group bausteine">
            {liste.map((b, i) => (
              <li key={b} className="baustein">
                <span className="baustein-pfeile">
                  <button type="button" className="pfeil" aria-label={`${BAUSTEIN_NAME[b][0]} nach oben`} disabled={i === 0} onClick={() => schieben(i, -1)}>{Icon.up}</button>
                  <button type="button" className="pfeil" aria-label={`${BAUSTEIN_NAME[b][0]} nach unten`} disabled={i === liste.length - 1} onClick={() => schieben(i, 1)}>{Icon.down}</button>
                </span>
                <span className="lbl">{BAUSTEIN_NAME[b][0]}<small>{BAUSTEIN_NAME[b][1]}</small></span>
                <button type="button" role="switch" aria-checked="true" aria-label={`${BAUSTEIN_NAME[b][0]} anzeigen`} className="schalter" disabled={FEST.includes(b)} onClick={() => speichern(liste.filter((x) => x !== b))} />
              </li>
            ))}
          </ul>
        </section>
        {aus.length ? (
          <section className="gsec" aria-label="Ausgeblendet">
            <h2 className="glabel">Ausgeblendet</h2>
            <ul className="group bausteine">
              {aus.map((b) => (
                <li key={b} className="baustein">
                  <span className="baustein-pfeile" />
                  <span className="lbl">{BAUSTEIN_NAME[b][0]}<small>{BAUSTEIN_NAME[b][1]}</small></span>
                  <button type="button" role="switch" aria-checked="false" aria-label={`${BAUSTEIN_NAME[b][0]} anzeigen`} className="schalter" onClick={() => speichern([...liste, b])} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="gnote">Jetzt dran und der Fragebogen bleiben immer an, weil der Coach ohne Antworten nichts zu sagen hat. Festhalten geht immer über die Coach-Leiste unten, auf dem Mac über das Feld rechts oder die Taste N.</p>
        <button type="button" className="btn wide" onClick={() => speichern([...STANDARD])}>Zurück zum Standard</button>
      </> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
