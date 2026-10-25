'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';

type E = { morgen: boolean; abend: boolean; warnung: boolean; training: boolean; morgenZeit: string; abendZeit: string };
const ARTEN: [keyof E, string][] = [['morgen', 'Morgen-Check-in und Coach'], ['abend', 'Abendfragen'], ['warnung', 'Warnsignale, höchstens eins am Tag'], ['training', 'Training an Trainingstagen']];

const bytes = (b64: string) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

/** Mitteilungen einschalten und einstellen. iOS erlaubt das nur in der App vom Home-Bildschirm. */
export function Mitteilungen({ onToast }: { onToast: (t: string, k?: 'ok' | 'err') => void }) {
  const [st, setSt] = useState<{ publicKey: string; geraete: number; einstellungen: E } | null>(null);
  const [kann, setKann] = useState<'ja' | 'homescreen' | 'nein'>('ja');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ publicKey: string; geraete: number; einstellungen: E }>('/api/push').then(setSt).catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) setKann(/iPhone|iPad/.test(navigator.userAgent) && !standalone ? 'homescreen' : 'nein');
  }, []);

  async function einschalten() {
    if (!st) return;
    setBusy(true);
    try {
      const erlaubt = await Notification.requestPermission(); // muss direkt nach dem Tippen kommen
      if (erlaubt !== 'granted') throw new Error('Mitteilungen sind in den iPhone-Einstellungen für Life aus.');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const abo = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(st.publicKey) });
      await api('/api/push', { method: 'POST', body: JSON.stringify({ abo: abo.toJSON() }) });
      setSt({ ...st, geraete: Math.max(1, st.geraete) });
      onToast('Mitteilungen sind an');
    } catch (e) { onToast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function setzen(neu: Partial<E>) {
    if (!st) return;
    setSt({ ...st, einstellungen: { ...st.einstellungen, ...neu } });
    try { await api('/api/push', { method: 'PUT', body: JSON.stringify(neu) }); } catch (e) { onToast((e as Error).message, 'err'); }
  }
  async function probe() {
    try { const r = await api<{ gesendet: number }>('/api/push', { method: 'POST', body: JSON.stringify({ probe: true }) }); onToast(r.gesendet ? 'Probe ist unterwegs' : 'Kein Gerät angemeldet', r.gesendet ? 'ok' : 'err'); }
    catch (e) { onToast((e as Error).message, 'err'); }
  }

  const e = st?.einstellungen;
  return (
    <section className="gsec">
      <h2 className="glabel">Mitteilungen</h2>
      <div className="group pad">
        {kann === 'homescreen' ? <p className="muted small">Mitteilungen gehen nur, wenn du Life vom Home-Bildschirm öffnest: in Safari Teilen, dann „Zum Home-Bildschirm“.</p>
          : kann === 'nein' ? <p className="muted small">Dieser Browser kann keine Mitteilungen empfangen.</p>
          : <div className="row-btns">
              <button type="button" className={'btn' + (st?.geraete ? '' : ' primary')} onClick={einschalten} disabled={busy || !st}>{st?.geraete ? 'Dieses Gerät neu anmelden' : 'Mitteilungen einschalten'}</button>
              {st?.geraete ? <button type="button" className="linkbtn" onClick={probe}>Probe schicken</button> : null}
            </div>}
        {e ? <>
          <div className="fb-opts" role="group" aria-label="Welche Mitteilungen">{ARTEN.map(([k, l]) => <button key={k} type="button" aria-pressed={!!e[k]} className="fb-chip" onClick={() => setzen({ [k]: !e[k] })}>{l}</button>)}</div>
          <div className="row-btns">
            <label className="small muted" htmlFor="push-morgen">Morgens</label><input id="push-morgen" className="zeitfeld" type="time" value={e.morgenZeit} onChange={(x) => x.target.value && setzen({ morgenZeit: x.target.value })} />
            <label className="small muted" htmlFor="push-abend">Abends</label><input id="push-abend" className="zeitfeld" type="time" value={e.abendZeit} onChange={(x) => x.target.value && setzen({ abendZeit: x.target.value })} />
          </div>
        </> : null}
      </div>
      <p className="gnote">{st?.geraete ? `${st.geraete} ${st.geraete === 1 ? 'Gerät' : 'Geräte'} angemeldet. ` : ''}Der Inhalt geht Ende-zu-Ende verschlüsselt über Apples Push-Dienst. Apple sieht nur, dass etwas kommt.</p>
    </section>
  );
}
