'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, useToast } from '../ui';

export type Tag = { tag: string; schlaf_min: number | null; erholung: number | null; hrv: number | null; ruhepuls: number | null; belastung: number | null };
export type K = {
  ruheMin: number; ruheTage: number;
  heute: string; blockWoche: number; letzteNacht: Tag | null; tage: Tag[]; kraft: number; zone2: number; intervall: number; ausgefallen: number;
  trainingstagHeute: boolean; warnungen: string[]; stand: { einheitenSoll: number; uhrzeit: string };
  whoop: { bereit: boolean; verbunden: boolean; zuletzt: string | null };
};

export const hm = (min: number | null) => (min === null ? '–' : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`);
export const erholFarbe = (e: number | null | undefined) => (e == null ? 'var(--faint)' : e < 34 ? 'var(--bad)' : e < 67 ? 'var(--warn)' : 'var(--ok)');
export const RIR = ['3 Wiederholungen vor Schluss', '2 Wiederholungen vor Schluss', '1 Wiederholung vor Schluss', '0 bis 1 Wiederholung vor Schluss', 'Entlastung, locker bleiben'];

export function Balken({ label, wert, ziel, einheit }: { label: string; wert: number; ziel: number; einheit?: string }) {
  const p = Math.min(100, Math.round((wert / Math.max(1, ziel)) * 100));
  return (
    <div className="kb-row">
      <div className="kb-top"><span>{label}</span><span className="num">{wert} / {ziel}{einheit ? ` ${einheit}` : ''}</span></div>
      <div className="kb-bar" role="progressbar" aria-valuenow={wert} aria-valuemax={ziel} aria-label={label}><i style={{ width: `${p}%` }} className={p >= 100 ? 'voll' : ''} /></div>
    </div>
  );
}

/** Körperdaten laden, WHOOP-Rückmeldung nach dem Verbinden zeigen, Abgleich und Training eintragen. */
export function useKoerper(pfad: string) {
  const [k, setK] = useState<K | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const laden = useCallback(async () => setK(await api<K>('/api/koerper')), []);
  useEffect(() => {
    laden().catch((e) => setToast((e as Error).message, 'err'));
    const q = new URLSearchParams(window.location.search).get('whoop');
    if (q === 'ok') setToast('WHOOP ist verbunden. Die letzten 30 Tage kommen gleich.');
    if (q === 'fehler') setToast('WHOOP hat die Verbindung abgelehnt. Bitte nochmal.', 'err');
    if (q) window.history.replaceState(null, '', pfad);
  }, [laden, setToast, pfad]);
  async function abgleichen() {
    setBusy(true);
    try { await api('/api/koerper', { method: 'POST', body: JSON.stringify({ aktion: 'abgleichen' }) }); await laden(); setToast('Abgeglichen'); }
    catch (e) { setToast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function plan(body: Record<string, unknown>) {
    try { await api('/api/training', { method: 'PATCH', body: JSON.stringify(body) }); await laden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function eintragen(art: string, dauer_min: number, text: string) {
    try { await api('/api/training', { method: 'POST', body: JSON.stringify({ art, dauer_min }) }); await laden(); setToast(text); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  return { k, busy, toast, setToast, abgleichen, plan, eintragen };
}
