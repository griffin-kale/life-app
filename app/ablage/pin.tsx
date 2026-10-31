'use client';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';
import { api } from '../ui';

/** PIN-Stand vom Server, nie die PIN selbst. */
export type PinStand = { gesetzt: boolean; gesperrt: boolean; frisch: boolean; code: boolean };
const PRIVAT = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false, 'data-1p-ignore': true, 'data-lpignore': 'true' } as const;

/** Passkey für den Riegel. Gilt auch als frische Bestätigung. */
export async function mitPasskey(): Promise<void> {
  const opts = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/ablage/riegel-optionen', { method: 'POST' });
  const response = await startAuthentication({ optionsJSON: opts });
  await api('/api/ablage/riegel', { method: 'POST', body: JSON.stringify({ response }) });
}

/** Passwort und Code: öffnet den Riegel, bestätigt frisch und hebt eine PIN-Sperre auf. */
export function PasswortCode({ knopf, onFertig, onFehler, busy, setBusy }: { knopf: string; onFertig: () => void; onFehler: (m: string) => void; busy: boolean; setBusy: (b: boolean) => void }) {
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  async function los() {
    setBusy(true);
    try { await api('/api/ablage/riegel', { method: 'POST', body: JSON.stringify({ passwort, code }) }); setPasswort(''); setCode(''); onFertig(); }
    catch (e) { onFehler((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <label className="field">Passwort<input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoComplete="current-password" aria-label="Passwort" /></label>
      <label className="field">Code<input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" aria-label="Code" /></label>
      <button type="button" className="btn primary wide" onClick={los} disabled={busy || !passwort || code.length !== 6}>{busy ? 'Prüft …' : knopf}</button>
    </>
  );
}

/** PIN festlegen oder ändern. Der Server nimmt sie nur mit frischer Bestätigung an. */
export function PinSetzen({ stand, onFertig, onAbbrechen, onFehler }: { stand: PinStand; onFertig: () => void; onAbbrechen?: () => void; onFehler: (m: string) => void }) {
  const [frisch, setFrisch] = useState(stand.frisch);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  async function speichern() {
    if (!/^\d{6}$/.test(pin1)) { setFehler('Die PIN hat genau 6 Ziffern.'); return; }
    if (pin1 !== pin2) { setFehler('Die beiden Eingaben sind verschieden.'); return; }
    setBusy(true); setFehler('');
    try { await api('/api/ablage/pin', { method: 'PUT', body: JSON.stringify({ pin: pin1 }) }); setPin1(''); setPin2(''); onFertig(); }
    catch (e) { setFehler((e as Error).message); if (/Bestätige zuerst/.test((e as Error).message)) setFrisch(false); }
    finally { setBusy(false); }
  }
  const ziffern = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  return (
    <section className="gsec" aria-label="PIN festlegen">
      <h2 className="glabel">{stand.gesetzt ? 'PIN ändern' : 'PIN festlegen'}</h2>
      <div className="group pad tr-form">
        {!frisch ? <>
          <p className="tr-satz">Bestätige zuerst, dass du es bist. Danach hast du fünf Minuten für die neue PIN.</p>
          {stand.code ? <PasswortCode knopf="Bestätigen" busy={busy} setBusy={setBusy} onFehler={setFehler} onFertig={() => setFrisch(true)} /> : null}
          <button type="button" className={stand.code ? 'btn wide' : 'btn primary wide'} disabled={busy} onClick={async () => { setBusy(true); try { await mitPasskey(); setFrisch(true); } catch (e) { setFehler((e as Error).message); } finally { setBusy(false); } }}>Mit Passkey bestätigen</button>
        </> : <>
          <p className="tr-satz">Mit der PIN öffnest du die Ablage auf dem iPhone, solange dort keine Passkeys gehen. Sie gilt nur zusammen mit deiner Anmeldung. Nach 5 falschen Versuchen ist sie gesperrt.</p>
          <label className="field">Neue PIN, 6 Ziffern<input type="password" inputMode="numeric" value={pin1} onChange={(e) => setPin1(ziffern(e.target.value))} aria-label="Neue PIN" {...PRIVAT} /></label>
          <label className="field">Noch einmal<input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(ziffern(e.target.value))} aria-label="PIN wiederholen" {...PRIVAT} /></label>
          <button type="button" className="btn primary wide" onClick={speichern} disabled={busy || pin1.length !== 6 || pin2.length !== 6}>{busy ? 'Speichert …' : 'PIN speichern'}</button>
        </>}
        {fehler ? <p className="tr-fehler" role="alert">{fehler}</p> : null}
        {onAbbrechen ? <button type="button" className="linkbtn tr-vergessen" onClick={onAbbrechen}>{stand.gesetzt ? 'Abbrechen' : 'Später'}</button> : null}
      </div>
    </section>
  );
}
