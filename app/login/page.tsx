'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Mark } from '../mark';
import { usePressFeedback } from '../ui';

export default function Login() {
  usePressFeedback();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try {
      const opts = await (await fetch('/api/auth/login-options', { method: 'POST' })).json();
      const response = await startAuthentication({ optionsJSON: opts });
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Anmeldung fehlgeschlagen');
      window.location.href = '/';
    } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Tipp nochmal, wenn du so weit bist.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <main className="center"><div className="login">
      <Mark />
      <h1 className="title">Lage<i>.</i></h1>
      <p className="muted">Dein Logbuch. Nur für dich.</p>
      <button type="button" className="btn primary wide" onClick={go} disabled={busy}>{busy ? 'Prüft …' : 'Mit Face ID anmelden'}</button>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
