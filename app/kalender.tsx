'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from './ui';
import { KALENDER_ARTEN, hhmm, type Block, type KalenderArt, type Termin } from '@/lib/kalender-regeln';

type K = { href: string; name: string; farbe: string; an: boolean; art: KalenderArt };
type Stand = { bereit: boolean; zuletzt: string | null; kalender: K[]; heute: { ganztag: Termin[]; bloecke: Block[]; frei: number } | null };

const dauer = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}${m % 60 ? `,${Math.round((m % 60) / 6)}` : ''} Std.` : `${m} Min.`);
const ART_NAME: Record<string, string> = { privat: 'Privat', familie: 'Familie', arbeit: 'Arbeit' };

export function useKalender() {
  const [k, setK] = useState<Stand | null>(null);
  const laden = useCallback(async () => setK(await api<Stand>('/api/kalender')), []);
  useEffect(() => { laden().catch(() => {}); }, [laden]);
  return { k, laden };
}

/** Heute im Kalender: Termine, Lücken ab 30 Minuten und ein Vorschlag, wann das Wichtigste passt. */
export function KalenderHeute() {
  const { k } = useKalender();
  if (!k?.heute) return null;
  const { ganztag, bloecke, frei } = k.heute;
  return (
    <section className="gsec" aria-label="Heute im Kalender">
      <h2 className="glabel">Heute im Kalender{frei ? ` · ${dauer(frei)} frei` : ''}</h2>
      <div className="group pad kal">
        {ganztag.length ? <div className="kal-ganztag">{ganztag.map((t, i) => <span key={i} className={'kal-chip ' + t.art}>{t.titel || ART_NAME[t.art]}</span>)}</div> : null}
        {bloecke.length ? bloecke.map((b, i) => (
          <div key={i} className={'kal-slot ' + b.art}>
            <time>{hhmm(b.von)}</time>
            <div>{b.art === 'frei' ? `${dauer(b.bis - b.von)} frei` : b.art === 'vorschlag' ? <><b>{b.titel}</b><small>Vorschlag fürs Wichtigste, {hhmm(b.von)} bis {hhmm(b.bis)}</small></> : <>{b.titel || ART_NAME[b.art]}<small>{hhmm(b.von)}–{hhmm(b.bis)} · {ART_NAME[b.art]}{b.art === 'familie' ? ', da plant der Coach nichts hinein' : ''}</small></>}</div>
          </div>
        )) : <p className="muted small">Heute stehen keine Termine im Kalender.</p>}
      </div>
    </section>
  );
}

/** Einstellungen: welche Kalender zählen und als was. Der Zugang selbst steht in der .env auf dem Server. */
export function KalenderEinstellungen({ onToast }: { onToast: (t: string, k?: 'ok' | 'err') => void }) {
  const { k, laden } = useKalender();
  const [busy, setBusy] = useState(false);
  async function abgleichen() {
    setBusy(true);
    try { const r = await api<{ kalender: number; termine: number }>('/api/kalender', { method: 'POST' }); await laden(); onToast(`${r.kalender} Kalender, ${r.termine} Termine abgeglichen`); }
    catch (e) { onToast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function aendern(href: string, wert: { an?: boolean; art?: KalenderArt }) {
    try { await api('/api/kalender', { method: 'PATCH', body: JSON.stringify({ href, ...wert }) }); if (wert.an) await abgleichen(); else await laden(); }
    catch (e) { onToast((e as Error).message, 'err'); }
  }
  if (!k) return null;
  return (
    <section className="gsec" aria-label="Kalender">
      <h2 className="glabel">Kalender</h2>
      {!k.bereit ? (
        <div className="group pad"><p className="muted small">Life liest deinen iCloud-Kalender, sobald ICLOUD_USER und ICLOUD_APP_PASSWORT in der .env auf dem Server stehen. Das Passwort legst du auf account.apple.com unter „App-spezifische Passwörter“ an, am besten mit dem Namen „Life“.</p></div>
      ) : (
        <div className="group">
          {k.kalender.map((x) => (
            <div key={x.href} className="cell static kal-zeile">
              <span className="kal-punkt" style={{ background: /^#[0-9a-f]{6,8}$/i.test(x.farbe) ? x.farbe.slice(0, 7) : 'var(--faint)' }} aria-hidden="true" />
              <span className="lbl">{x.name}</span>
              <label className="chipbtn"><span>{ART_NAME[x.art]}</span>
                <select aria-label={`Art von ${x.name}`} value={x.art} onChange={(e) => aendern(x.href, { art: e.target.value as KalenderArt })}>{KALENDER_ARTEN.map(([a, n]) => <option key={a} value={a}>{n}</option>)}</select>
              </label>
              <button type="button" role="switch" aria-checked={x.an} aria-label={`${x.name} einbeziehen`} className="schalter" onClick={() => aendern(x.href, { an: !x.an })} />
            </div>
          ))}
          <button type="button" className="cell tint" onClick={abgleichen} disabled={busy}>{busy ? 'Gleicht ab …' : k.kalender.length ? 'Jetzt abgleichen' : 'Kalender suchen'}</button>
        </div>
      )}
      <p className="gnote">Life liest nur und schreibt nichts in deinen Kalender. Termine bleiben auf dem Server. Der Coach sieht Uhrzeiten und Titel mit Platzhaltern für Namen, bei Familie nur „Familie“.{k.zuletzt ? ` Zuletzt abgeglichen ${new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(k.zuletzt))}.` : ''} <Link href="/" className="linkbtn">Zu Heute</Link></p>
    </section>
  );
}
