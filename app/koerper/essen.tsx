'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../ui';

type Eintrag = { id: string; mahlzeit: string; quelle: string; name: string; gramm: number | null; kcal: number | null; kcal_bis: number | null; protein: number | null; protein_bis: number | null };
type Produkt = { ean: string; name: string; marke: string | null; kcal: number | null; protein: number | null; portion_g: number | null };

const MZ: [string, string][] = [['fruehstueck', 'Frühstück'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['snack', 'Snack']];
const vorschlag = () => { const h = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10); return h < 11 ? 'fruehstueck' : h < 15 ? 'mittag' : h < 17 ? 'snack' : 'abend'; };
const spanne = (a: number | null, b: number | null, e: string) => (a === null ? '–' : b !== null && b > a ? `${Math.round(a)}–${Math.round(b)} ${e}` : `${Math.round(a)} ${e}`);

/** Verkleinert ein Foto im Browser auf 1024 px und speichert es neu. Dabei fallen Ortsdaten und andere Metadaten weg. */
async function fotoVerkleinern(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

function Scanner({ onCode, onClose }: { onCode: (ean: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [fehler, setFehler] = useState('');
  const [hand, setHand] = useState('');
  useEffect(() => {
    let stop: (() => void) | null = null; let aus = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
        const reader = new BrowserMultiFormatReader(hints as unknown as ConstructorParameters<typeof BrowserMultiFormatReader>[0]);
        const c = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (r, _e, ctl) => { if (r && !aus) { aus = true; ctl.stop(); onCode(r.getText()); } });
        stop = () => c.stop(); if (aus) c.stop();
      } catch { setFehler('Die Kamera geht hier nicht. Tipp die Nummer unter dem Barcode ein.'); }
    })();
    return () => { aus = true; stop?.(); };
  }, [onCode]);
  return (
    <div className="scanner" role="dialog" aria-label="Barcode scannen">
      {!fehler ? <video ref={video} playsInline muted className="scan-video" /> : <p className="muted small">{fehler}</p>}
      <div className="scan-hand">
        <input inputMode="numeric" aria-label="Barcode-Nummer" placeholder="Nummer eintippen" value={hand} onChange={(e) => setHand(e.target.value.replace(/\D/g, '').slice(0, 14))} />
        <button type="button" className="btn primary" disabled={hand.length < 8} onClick={() => onCode(hand)}>Suchen</button>
      </div>
      <button type="button" className="linkbtn" onClick={onClose}>Abbrechen</button>
    </div>
  );
}

export function Essen({ onFehler, onOk }: { onFehler: (m: string) => void; onOk: (m: string) => void }) {
  const [d, setD] = useState<{ liste: Eintrag[]; proteinZiel: number; gewicht: number | null } | null>(null);
  const [mz, setMz] = useState(vorschlag);
  const [scan, setScan] = useState(false);
  const [p, setP] = useState<Produkt | null>(null);
  const [gramm, setGramm] = useState(100);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const laden = useCallback(async () => setD(await api('/api/essen')), []);
  useEffect(() => { laden().catch(() => {}); }, [laden]);

  async function los(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try { await api('/api/essen', { method: 'POST', body: JSON.stringify({ mahlzeit: mz, ...body }) }); await laden(); onOk(ok); return true; }
    catch (e) { onFehler((e as Error).message); return false; } finally { setBusy(false); }
  }
  const code = useCallback(async (ean: string) => {
    setScan(false);
    try { const x = await api<Produkt>(`/api/essen/barcode?ean=${encodeURIComponent(ean)}`); setP(x); setGramm(x.portion_g || 100); }
    catch (e) { onFehler((e as Error).message); }
  }, [onFehler]);

  const summe = (k: 'protein' | 'protein_bis' | 'kcal' | 'kcal_bis') => (d?.liste ?? []).reduce((a, e) => a + (e[k] ?? (k.endsWith('_bis') ? e[k.replace('_bis', '') as 'protein' | 'kcal'] ?? 0 : 0)), 0);
  const pv = summe('protein'); const pb = summe('protein_bis');
  const ziel = d?.proteinZiel ?? 128;
  const proz = Math.min(100, Math.round((((pv + pb) / 2) / ziel) * 100));

  return (
    <section className="gsec" aria-label="Essen">
      <h2 className="glabel">Essen heute</h2>
      <div className="group pad">
        <div className="kb-row">
          <div className="kb-top"><span>Protein</span><span className="num">{pv === pb ? Math.round(pv) : `${Math.round(pv)}–${Math.round(pb)}`} / {ziel} g</span></div>
          <div className="kb-bar" role="progressbar" aria-valuenow={Math.round((pv + pb) / 2)} aria-valuemax={ziel} aria-label="Protein heute"><i style={{ width: `${proz}%` }} className={proz >= 100 ? 'voll' : ''} /></div>
          <span className="gnote flush">Ziel: 1,6 g pro kg{d?.gewicht ? ` bei ${String(d.gewicht).replace('.', ',')} kg aus WHOOP` : ', bis WHOOP dein Gewicht kennt mit 80 kg gerechnet'}. Etwa {spanne(summe('kcal'), summe('kcal_bis'), 'kcal')} bisher.</span>
        </div>
        {d?.liste.length ? (
          <ul className="essen-liste">
            {d.liste.map((e) => (
              <li key={e.id}>
                <div><b>{e.name}</b><span>{MZ.find(([k]) => k === e.mahlzeit)?.[1]}{e.gramm ? ` · ${Math.round(e.gramm)} g` : ''} · {spanne(e.protein, e.protein_bis, 'g Protein')}</span></div>
                <button type="button" className="chipbtn" aria-label={`${e.name} löschen`} onClick={async () => { await api(`/api/essen?id=${e.id}`, { method: 'DELETE' }).catch(() => {}); laden(); }}>Löschen</button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="fb-opts" role="radiogroup" aria-label="Mahlzeit">{MZ.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mz === k} className="fb-chip" onClick={() => setMz(k)}>{l}</button>)}</div>

        {p ? (
          <div className="produkt">
            <b>{p.name}</b><span className="muted small">{p.marke ? `${p.marke} · ` : ''}{p.protein ?? '–'} g Protein und {p.kcal ?? '–'} kcal pro 100 g</span>
            <div className="fb-opts" role="radiogroup" aria-label="Menge">
              {[...(p.portion_g ? [p.portion_g] : []), 50, 100, 150, 200, 250].filter((x, i, a) => a.indexOf(x) === i).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={gramm === g} className="fb-chip" onClick={() => setGramm(g)}>{g === p.portion_g ? `1 Portion (${g} g)` : `${g} g`}</button>
              ))}
            </div>
            <div className="row-btns">
              <button type="button" className="btn primary" disabled={busy} onClick={async () => { if (await los({ quelle: 'barcode', ean: p.ean, gramm }, 'Festgehalten')) setP(null); }}>Festhalten</button>
              <button type="button" className="linkbtn" onClick={() => setP(null)}>Abbrechen</button>
            </div>
          </div>
        ) : scan ? <Scanner onCode={code} onClose={() => setScan(false)} /> : (
          <>
            <div className="row-btns">
              <button type="button" className="btn" onClick={() => setScan(true)}>Barcode scannen</button>
              <button type="button" className="btn" disabled={busy} onClick={() => foto.current?.click()}>Foto vom Teller</button>
              <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
                try { const bild = await fotoVerkleinern(f); await los({ quelle: 'foto', bild, notiz: text }, 'Claude hat geschätzt'); setText(''); } catch (x) { onFehler((x as Error).message); }
              }} />
            </div>
            <div className="field">
              <label htmlFor="essen-text">Oder in einem Satz</label>
              <textarea id="essen-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Zum Beispiel: Bowl mit Hähnchen und Reis, große Portion" />
            </div>
            <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={async () => { if (await los({ quelle: 'text', text }, 'Claude hat geschätzt')) setText(''); }}>{busy ? 'Schätzt …' : 'Schätzen und festhalten'}</button>
          </>
        )}
        <p className="gnote flush">Fotos speichert Life nicht. Nährwerte zu Barcodes aus Open Food Facts (ODbL), dorthin geht nur die Nummer.</p>
      </div>
    </section>
  );
}
