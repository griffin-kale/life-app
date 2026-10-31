'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar, api, useToast } from '../ui';
import { auf, auspacken, ausPassphrase, ausWiederherstellung, einpacken, inhaltsSchluessel, neuesSalz, zu, zufall } from '../ablage-krypto';
import { ITERATIONEN, LEERLAUF_MIN, PASSPHRASE_MIN, passphraseOk, wiederAusText, wiederText } from '@/lib/ablage-regeln';
import { Offen, PRIVAT, type Eintrag, type Inhalt } from './offen';
import { PasswortCode, PinSetzen, mitPasskey, type PinStand } from './pin';
import { PIN_LAENGE } from '@/lib/ablage-pin';

/**
 * Ablage (0.30, Peter 31.10.2026): verborgen, Ende-zu-Ende verschlüsselt. Kein Menüpunkt, Zugang über eine Geste.
 * Öffnen braucht Face ID und die Passphrase. Der Inhaltsschlüssel lebt nur im Speicher dieser Seite und ist weg,
 * sobald die Seite in den Hintergrund geht, zwei Minuten nichts passiert oder Peter „Sperren“ tippt.
 * Keine KI, keine Suche, kein Diktat, keine Rechtschreibprüfung, kein Coach, keine Mitteilungen.
 */
type Kopf = { eingerichtet: boolean; offen: boolean; salz?: string; iterationen?: number; pass_block?: string; wieder_block?: string };
type Phase = 'laedt' | 'riegel' | 'pinSetzen' | 'einrichten' | 'wiederZeigen' | 'entsperren' | 'wiederEingeben' | 'neuePass' | 'offen';


export default function Ablage() {
  const [phase, setPhase] = useState<Phase>('laedt');
  const [kopf, setKopf] = useState<Kopf | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [wieder, setWieder] = useState('');
  const [bestaetigt, setBestaetigt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  const [toast, setToast] = useToast();
  const leerlauf = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pinStand, setPinStand] = useState<PinStand | null>(null);
  const [pin, setPin] = useState('');
  const [mitCode, setMitCode] = useState(false);
  /** Kopf und PIN-Stand laden. nachOeffnen: ohne PIN erst anbieten, eine festzulegen (fürs iPhone). */
  const kopfLaden = useCallback(async (nachOeffnen = false) => {
    const [k, p] = await Promise.all([api<Kopf>('/api/ablage'), api<PinStand>('/api/ablage/pin')]);
    setKopf(k); setPinStand(p);
    setPhase(!k.offen ? 'riegel' : nachOeffnen && !p.gesetzt && p.frisch ? 'pinSetzen' : k.eingerichtet ? 'entsperren' : 'einrichten');
  }, []);
  useEffect(() => { kopfLaden().catch((e) => setToast((e as Error).message, 'err')); }, [kopfLaden, setToast]);

  const sperren = useCallback((grund?: string) => {
    setKey(null); setEintraege([]); setPass1(''); setPass2(''); setWieder(''); setFehler(''); setBestaetigt(false);
    fetch('/api/ablage/riegel', { method: 'DELETE', keepalive: true }).catch(() => {});
    setPhase('riegel');
    if (grund) setToast(grund);
  }, [setToast]);

  // Hintergrund oder Leerlauf: sofort zu. Gilt auch, während der Wiederherstellungsschlüssel angezeigt wird.
  // Seit 0.31.2: sobald der Riegel offen ist, auch vor der Passphrase. Der Server schließt ihn dann sofort.
  const offenOderGeheim = phase !== 'laedt' && phase !== 'riegel';
  useEffect(() => {
    if (!offenOderGeheim) return;
    const weg = () => { if (document.visibilityState === 'hidden') sperren(); };
    const ende = () => sperren();
    const neu = () => { if (leerlauf.current) clearTimeout(leerlauf.current); leerlauf.current = setTimeout(() => sperren(`Nach ${LEERLAUF_MIN} Minuten ohne Eingabe gesperrt`), LEERLAUF_MIN * 60_000); };
    neu();
    document.addEventListener('visibilitychange', weg);
    window.addEventListener('pagehide', ende);
    for (const e of ['pointerdown', 'keydown'] as const) window.addEventListener(e, neu);
    return () => {
      document.removeEventListener('visibilitychange', weg);
      window.removeEventListener('pagehide', ende);
      for (const e of ['pointerdown', 'keydown'] as const) window.removeEventListener(e, neu);
      if (leerlauf.current) clearTimeout(leerlauf.current);
    };
  }, [offenOderGeheim, sperren]);
  useEffect(() => () => { fetch('/api/ablage/riegel', { method: 'DELETE', keepalive: true }).catch(() => {}); }, []);

  function fehlerOderZu(e: unknown) {
    const m = (e as Error).message || '';
    if (/Bitte neu öffnen/.test(m)) sperren('Fünf Minuten ohne Nutzung. Bitte neu öffnen.');
    else setToast(m, 'err');
  }

  async function passkey() {
    setBusy(true); setFehler('');
    try { await mitPasskey(); await kopfLaden(); }
    catch (e) { setFehler((e as Error).name === 'NotAllowedError' ? 'Passkey abgebrochen.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  async function mitPin() {
    setBusy(true); setFehler('');
    try { await api('/api/ablage/riegel', { method: 'POST', body: JSON.stringify({ pin }) }); setPin(''); await kopfLaden(); }
    catch (e) {
      const m = (e as Error).message; setFehler(m); setPin('');
      if (/gesperrt/.test(m)) setPinStand((s) => (s ? { ...s, gesperrt: true } : s));
    } finally { setBusy(false); }
  }

  async function laden(k: CryptoKey) {
    const r = await api<{ bloecke: { id: string; block: string; geaendert: string }[] }>('/api/ablage/eintraege');
    const liste: Eintrag[] = [];
    for (const b of r.bloecke) { try { liste.push({ ...(await auf<Inhalt>(k, b.block)), id: b.id, geaendert: b.geaendert }); } catch { /* kaputter Block bleibt unsichtbar */ } }
    setEintraege(liste);
  }

  async function einrichten() {
    if (!passphraseOk(pass1)) { setFehler(`Mindestens ${PASSPHRASE_MIN} Zeichen, gern ein ganzer Satz.`); return; }
    if (pass1 !== pass2) { setFehler('Die beiden Eingaben sind verschieden.'); return; }
    setBusy(true); setFehler('');
    const inhalt = zufall(32); const wiederRoh = zufall(32);
    try {
      const salz = neuesSalz();
      const pass_block = await einpacken(await ausPassphrase(pass1, salz, ITERATIONEN), inhalt);
      const wieder_block = await einpacken(await ausWiederherstellung(wiederRoh), inhalt);
      await api('/api/ablage', { method: 'POST', body: JSON.stringify({ salz, iterationen: ITERATIONEN, pass_block, wieder_block }) });
      setKey(await inhaltsSchluessel(inhalt));
      setWieder(wiederText(wiederRoh)); setPass1(''); setPass2(''); setEintraege([]); setBestaetigt(false); setPhase('wiederZeigen');
    } catch (e) { fehlerOderZu(e); }
    finally { inhalt.fill(0); wiederRoh.fill(0); setBusy(false); }
  }

  async function entsperren() {
    if (!kopf?.salz || !kopf.iterationen || !kopf.pass_block) return;
    setBusy(true); setFehler('');
    try {
      let k: CryptoKey;
      try { k = await auspacken(await ausPassphrase(pass1, kopf.salz, kopf.iterationen), kopf.pass_block); }
      catch { setFehler('Die Passphrase stimmt nicht.'); return; }
      await laden(k); setKey(k); setPass1(''); setPhase('offen');
    } catch (e) { fehlerOderZu(e); }
    finally { setBusy(false); }
  }

  async function mitWiederherstellung() {
    if (!kopf?.wieder_block) return;
    const roh = wiederAusText(wieder);
    if (!roh) { setFehler('Der Schlüssel hat 52 Zeichen in Vierergruppen. Bitte prüfen.'); return; }
    setBusy(true); setFehler('');
    try {
      let k: CryptoKey;
      try { k = await auspacken(await ausWiederherstellung(roh), kopf.wieder_block); }
      catch { setFehler('Dieser Wiederherstellungsschlüssel passt nicht.'); return; }
      setKey(k); setWieder(''); setPhase('neuePass');
      // Den Wiederherstellungsschlüssel nur bis zur neuen Passphrase im Speicher halten, danach überschreiben
      wiederRef.current = roh;
    } catch (e) { fehlerOderZu(e); }
    finally { setBusy(false); }
  }
  const wiederRef = useRef<Uint8Array | null>(null);

  async function passphraseSetzen() {
    if (!passphraseOk(pass1)) { setFehler(`Mindestens ${PASSPHRASE_MIN} Zeichen, gern ein ganzer Satz.`); return; }
    if (pass1 !== pass2) { setFehler('Die beiden Eingaben sind verschieden.'); return; }
    if (!kopf?.wieder_block || !wiederRef.current || !key) return;
    setBusy(true); setFehler('');
    try {
      // Den rohen Inhaltsschlüssel bekommt nur, wer den Wiederherstellungsschlüssel hat: aus dem eingepackten Block lesen
      const roh = await rohInhalt(wiederRef.current, kopf.wieder_block);
      const salz = neuesSalz();
      const pass_block = await einpacken(await ausPassphrase(pass1, salz, ITERATIONEN), roh);
      roh.fill(0);
      await api('/api/ablage', { method: 'PUT', body: JSON.stringify({ salz, iterationen: ITERATIONEN, pass_block }) });
      wiederRef.current.fill(0); wiederRef.current = null;
      setPass1(''); setPass2('');
      await laden(key); setPhase('offen'); setToast('Neue Passphrase gilt');
    } catch (e) { fehlerOderZu(e); }
    finally { setBusy(false); }
  }

  async function allesLoeschen() {
    if (!window.confirm('Passphrase und Wiederherstellungsschlüssel verloren? Dann lässt sich nichts retten. Alles wird gelöscht, danach richtest du neu ein.')) return;
    try { await api('/api/ablage?bestaetigt=alles-loeschen', { method: 'DELETE' }); await kopfLaden(); setToast('Gelöscht'); }
    catch (e) { fehlerOderZu(e); }
  }

  async function speichern(inhalt: Inhalt, id?: string) {
    if (!key) return;
    try {
      const block = await zu(key, inhalt);
      if (id) await api(`/api/ablage/eintraege/${id}`, { method: 'PUT', body: JSON.stringify({ block }) });
      else await api('/api/ablage/eintraege', { method: 'POST', body: JSON.stringify({ block }) });
      await laden(key);
    } catch (e) { fehlerOderZu(e); }
  }
  async function loeschen(x: Eintrag, frage = true) {
    if (frage && !window.confirm('Diesen Eintrag löschen?')) return;
    try { await api(`/api/ablage/eintraege/${x.id}`, { method: 'DELETE' }); if (key) await laden(key); }
    catch (e) { fehlerOderZu(e); }
  }

  /** Verschlüsselter Export: alles, was der Server hat, als Datei. Ohne Passphrase oder Wiederherstellungsschlüssel unlesbar. */
  async function exportieren() {
    try {
      const k = await api<Kopf>('/api/ablage');
      const b = await api<{ bloecke: { id: string; block: string; geaendert: string }[] }>('/api/ablage/eintraege');
      const datei = { format: 'life.ablage.export.v1', salz: k.salz, iterationen: k.iterationen, pass_block: k.pass_block, wieder_block: k.wieder_block, bloecke: b.bloecke };
      const url = URL.createObjectURL(new Blob([JSON.stringify(datei)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `ablage-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { fehlerOderZu(e); }
  }

  const fehlerZeile = fehler ? <p className="tr-fehler" role="alert">{fehler}</p> : null;
  return (
    <main className="wrap ablage">
      <TopBar title="Ablage" back={{ label: 'Leben', href: '/leben' }} />
      <header className="head"><span className="eyebrow">Nur auf diesem Gerät lesbar</span><h1 className="title">Ablage<i>.</i></h1></header>

      {phase === 'laedt' ? <p className="loading">Lädt …</p> : null}

      {phase === 'riegel' && pinStand ? (
        <section className="gsec" aria-label="Öffnen">
          <div className="group pad tr-form">
            <p className="tr-satz">Life verschlüsselt alles hier auf deinem Gerät, bevor es zum Server geht. Der Server, Backups, Claude und andere Konten sehen nur Unlesbares.</p>
            {pinStand.gesetzt && !pinStand.gesperrt && !mitCode ? <>
              {/* PIN vorn (Peter, 31.10.2026): auf dem iPhone gehen keine Passkeys, ein QR-Code hilft dort nicht */}
              <label className="field">PIN<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LAENGE))} aria-label="PIN" autoFocus {...PRIVAT}
                onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === PIN_LAENGE) mitPin(); }} /></label>
              <button type="button" className="btn primary wide" onClick={mitPin} disabled={busy || pin.length !== PIN_LAENGE}>{busy ? 'Prüft …' : 'Öffnen'}</button>
              {fehlerZeile}
              <button type="button" className="btn wide" onClick={passkey} disabled={busy}>Mit Passkey</button>
              {pinStand.code ? <button type="button" className="linkbtn tr-vergessen" onClick={() => { setFehler(''); setMitCode(true); }}>Mit Passwort und Code</button> : null}
            </> : <>
              {pinStand.gesperrt && !fehler ? <p className="tr-warn">Die PIN ist nach 5 Fehlversuchen gesperrt. Öffne mit Passwort und Code, danach gilt sie wieder.</p> : null}
              {pinStand.code ? <PasswortCode knopf="Mit Passwort und Code öffnen" busy={busy} setBusy={setBusy} onFehler={setFehler} onFertig={() => { setMitCode(false); setFehler(''); kopfLaden(true).catch(() => {}); }} /> : null}
              {fehlerZeile}
              <button type="button" className={pinStand.code ? 'btn wide' : 'btn primary wide'} onClick={passkey} disabled={busy}>Mit Passkey</button>
              {mitCode ? <button type="button" className="linkbtn tr-vergessen" onClick={() => { setFehler(''); setMitCode(false); }}>Zurück zur PIN</button> : null}
            </>}
          </div>
        </section>
      ) : null}

      {phase === 'pinSetzen' && pinStand ? <PinSetzen stand={pinStand} onFehler={(m) => setToast(m, 'err')}
        onFertig={() => { setToast('PIN gespeichert'); kopfLaden().catch(() => {}); }} onAbbrechen={() => kopfLaden().catch(() => {})} /> : null}

      {phase === 'einrichten' || phase === 'neuePass' ? (
        <section className="gsec" aria-label={phase === 'einrichten' ? 'Einrichten' : 'Neue Passphrase'}>
          <div className="group pad tr-form">
            <p className="tr-warn">{phase === 'einrichten'
              ? <><b>Wichtig:</b> Niemand kann die Passphrase zurücksetzen. Nach dem Einrichten bekommst du einen Wiederherstellungsschlüssel zum Ausdrucken. Ohne beides ist der Inhalt verloren.</>
              : <>Der Wiederherstellungsschlüssel passt. Leg jetzt eine neue Passphrase fest.</>}</p>
            <label className="field">Passphrase, mindestens {PASSPHRASE_MIN} Zeichen
              <input type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} {...PRIVAT} autoComplete="new-password" aria-label="Passphrase" />
            </label>
            <label className="field">Noch einmal
              <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} {...PRIVAT} autoComplete="new-password" aria-label="Passphrase wiederholen" />
            </label>
            <button type="button" className="btn primary wide" onClick={phase === 'einrichten' ? einrichten : passphraseSetzen} disabled={busy || !pass1 || !pass2}>{busy ? 'Schlüssel wird berechnet …' : phase === 'einrichten' ? 'Einrichten' : 'Passphrase speichern'}</button>
            {fehlerZeile}
          </div>
        </section>
      ) : null}

      {phase === 'wiederZeigen' ? (
        <section className="gsec" aria-label="Wiederherstellungsschlüssel">
          <div className="group pad tr-form">
            <p className="tr-warn"><b>Einmal ausdrucken oder abschreiben, offline aufbewahren.</b> Life zeigt diesen Schlüssel nie wieder. Mit ihm kommst du hinein, wenn die Passphrase weg ist. Kein Foto, keine Cloud.</p>
            <p className="tr-schluessel" aria-label="Schlüssel">{wieder}</p>
            <div className="tr-reihe">
              <button type="button" className="chipbtn" onClick={() => window.print()}>Drucken</button>
            </div>
            <label className="tr-check"><input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} />Ich habe den Schlüssel sicher notiert</label>
            <button type="button" className="btn primary wide" disabled={!bestaetigt} onClick={() => { setWieder(''); setPhase('offen'); }}>Weiter</button>
          </div>
        </section>
      ) : null}

      {phase === 'entsperren' ? (
        <section className="gsec" aria-label="Entsperren">
          <div className="group pad tr-form">
            <label className="field">Passphrase
              <input type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} {...PRIVAT} autoComplete="current-password" aria-label="Passphrase" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') entsperren(); }} />
            </label>
            <button type="button" className="btn primary wide" onClick={entsperren} disabled={busy || !pass1}>{busy ? 'Entsperrt …' : 'Entsperren'}</button>
            {fehlerZeile}
            <button type="button" className="linkbtn tr-vergessen" onClick={() => { setFehler(''); setPhase('wiederEingeben'); }}>Passphrase vergessen?</button>
          </div>
        </section>
      ) : null}

      {phase === 'wiederEingeben' ? (
        <section className="gsec" aria-label="Wiederherstellen">
          <div className="group pad tr-form">
            <label className="field">Wiederherstellungsschlüssel
              <textarea rows={3} value={wieder} onChange={(e) => setWieder(e.target.value)} {...PRIVAT} aria-label="Wiederherstellungsschlüssel" placeholder="XXXX-XXXX-…" />
            </label>
            <button type="button" className="btn primary wide" onClick={mitWiederherstellung} disabled={busy || !wieder.trim()}>{busy ? 'Prüft …' : 'Öffnen'}</button>
            {fehlerZeile}
            <button type="button" className="linkbtn tr-vergessen" onClick={() => { setFehler(''); setWieder(''); setPhase('entsperren'); }}>Zurück zur Passphrase</button>
            <button type="button" className="linkbtn tr-vergessen tr-gefahr" onClick={allesLoeschen}>Beides verloren: alles löschen</button>
          </div>
        </section>
      ) : null}

      {phase === 'offen' && key ? <Offen eintraege={eintraege} onSpeichern={speichern} onLoeschen={loeschen} onSperren={() => sperren('Gesperrt')} onExport={exportieren} onFehler={(m) => setToast(m, 'err')} /> : null}
      {toast}
    </main>
  );
}

/** Den rohen Inhaltsschlüssel nur für das Neu-Einpacken: mit dem Wiederherstellungsschlüssel auspacken, danach sofort löschen. */
async function rohInhalt(wiederRoh: Uint8Array, wiederBlock: string): Promise<Uint8Array> {
  const huelle = await ausWiederherstellung(wiederRoh);
  const roh = Uint8Array.from(atob(wiederBlock), (c) => c.charCodeAt(0));
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: roh.slice(0, 12) as Uint8Array<ArrayBuffer> }, huelle, roh.slice(12) as Uint8Array<ArrayBuffer>));
}

