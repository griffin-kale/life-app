'use client';
import { useEffect, useState } from 'react';
import { RAND, THEMA_COOKIE, themaAus, type Thema } from '@/lib/thema';

const WAHL: [Thema, string][] = [['dark', 'Dunkel'], ['light', 'Hell'], ['system', 'Wie das iPhone']];

/** Hell, Dunkel oder wie das Gerät. Wirkt sofort, ohne Neuladen. Die Statusleiste stellt iOS erst beim nächsten Öffnen um. */
export function Darstellung() {
  const [t, setT] = useState<Thema>('dark');
  useEffect(() => { setT(themaAus(document.documentElement.dataset.theme)); }, []);

  function waehlen(neu: Thema) {
    setT(neu);
    document.documentElement.dataset.theme = neu;
    document.cookie = `${THEMA_COOKIE}=${neu}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    const hell = neu === 'light' || (neu === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', hell ? RAND.light : RAND.dark));
  }

  return (
    <section className="gsec" aria-label="Darstellung">
      <h2 className="glabel">Darstellung</h2>
      <div className="group pad">
        <div className="themen" role="radiogroup" aria-label="Darstellung">
          {WAHL.map(([id, name]) => (
            <button key={id} type="button" role="radio" aria-checked={t === id} className="thema" onClick={() => waehlen(id)}>
              <span className={'thema-bild ' + id} aria-hidden="true"><i /><i /><i /></span>
              <span className="thema-name">{name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="gnote">Gilt für dieses Gerät. Die Statusleiste oben passt iOS an, sobald du Life einmal schließt und neu öffnest.</p>
    </section>
  );
}
