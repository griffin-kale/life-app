'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Musik } from '@/lib/fokus-regeln';

/**
 * Musik für den Fokus. Alles kommt vom eigenen Server oder entsteht im Browser, nichts wird von außen geladen.
 * Klassik: zehn Musopen-Aufnahmen (CC0, Quellen in public/musik/QUELLEN.md).
 * Fokus-Welle: dieselbe Musik mit einer schnellen, leisen Lautstärke-Welle (16 Hz), angelehnt an die Studie hinter Brain.fm.
 * Rauschen: braunes Rauschen, im Browser erzeugt. Stille: nichts.
 */
export const STUECKE: { datei: string; titel: string }[] = [
  { datei: 'm01', titel: 'Bach · Goldberg-Variationen, Aria' },
  { datei: 'm02', titel: 'Chopin · Nocturne op. 15 Nr. 1' },
  { datei: 'm07', titel: 'Albinoni · Oboenkonzert op. 9 Nr. 2, Adagio' },
  { datei: 'm03', titel: 'Chopin · Nocturne op. 15 Nr. 2' },
  { datei: 'm08', titel: 'Beethoven · Pathétique, Adagio cantabile' },
  { datei: 'm04', titel: 'Chopin · Nocturne op. 55 Nr. 1' },
  { datei: 'm09', titel: 'Brahms · 3. Sinfonie, Poco allegretto' },
  { datei: 'm05', titel: 'Chopin · Nocturne op. 55 Nr. 2' },
  { datei: 'm10', titel: 'Brahms · 2. Sinfonie, Adagio non troppo' },
  { datei: 'm06', titel: 'Chopin · Nocturne op. posth. 72 Nr. 1' },
];
const WELLE_HZ = 16;
const WELLE_TIEFE = 0.22;

type Kette = { ctx: AudioContext; audio: HTMLAudioElement; am: GainNode; lfoTiefe: GainNode; laut: GainNode; rauschen: AudioBufferSourceNode | null };

function braunesRauschen(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 4; const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let k = 0; k < 2; k++) {
    const d = buf.getChannelData(k); let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  }
  return buf;
}

export function useFokusMusik() {
  const kette = useRef<Kette | null>(null);
  const [art, setArt] = useState<Musik>('stille');
  const [spielt, setSpielt] = useState(false);
  const [stueck, setStueck] = useState(0);
  const [lautstaerke, setLautstaerke] = useState(0.6);

  // Muss aus einem Tippen heraus laufen, sonst lässt Safari keinen Ton zu
  const aufbauen = useCallback((): Kette => {
    if (kette.current) return kette.current;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = new Audio(); audio.preload = 'auto'; audio.crossOrigin = 'anonymous';
    const quelle = ctx.createMediaElementSource(audio);
    const am = ctx.createGain(); am.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = WELLE_HZ;
    const lfoTiefe = ctx.createGain(); lfoTiefe.gain.value = 0;
    lfo.connect(lfoTiefe).connect(am.gain); lfo.start();
    const laut = ctx.createGain(); laut.gain.value = lautstaerke;
    quelle.connect(am).connect(laut).connect(ctx.destination);
    kette.current = { ctx, audio, am, lfoTiefe, laut, rauschen: null };
    return kette.current;
  }, [lautstaerke]);

  const stueckLaden = useCallback((k: Kette, i: number) => {
    const s = STUECKE[((i % STUECKE.length) + STUECKE.length) % STUECKE.length];
    k.audio.src = `/musik/${s.datei}.m4a`; setStueck(STUECKE.indexOf(s));
  }, []);

  useEffect(() => {
    const k = kette.current; if (!k) return;
    const weiter = () => { stueckLaden(k, stueck + 1); k.audio.play().catch(() => setSpielt(false)); };
    k.audio.addEventListener('ended', weiter);
    return () => k.audio.removeEventListener('ended', weiter);
  }, [stueck, stueckLaden]);

  const stop = useCallback(() => {
    const k = kette.current; if (!k) return;
    k.audio.pause();
    if (k.rauschen) { try { k.rauschen.stop(); } catch { /* schon aus */ } k.rauschen = null; }
    setSpielt(false);
  }, []);

  const spielen = useCallback((a: Musik) => {
    setArt(a);
    if (a === 'stille') { stop(); return; }
    const k = aufbauen();
    k.ctx.resume().catch(() => {});
    if (a === 'rauschen') {
      k.audio.pause();
      if (!k.rauschen) { const r = k.ctx.createBufferSource(); r.buffer = braunesRauschen(k.ctx); r.loop = true; r.connect(k.laut); r.start(); k.rauschen = r; }
      setSpielt(true); return;
    }
    if (k.rauschen) { try { k.rauschen.stop(); } catch { /* schon aus */ } k.rauschen = null; }
    k.lfoTiefe.gain.value = a === 'welle' ? WELLE_TIEFE : 0;
    k.am.gain.value = a === 'welle' ? 1 - WELLE_TIEFE : 1;
    if (!k.audio.src) stueckLaden(k, Math.floor(Math.random() * STUECKE.length));
    k.audio.play().then(() => setSpielt(true)).catch(() => setSpielt(false));
  }, [aufbauen, stop, stueckLaden]);

  const naechstes = useCallback(() => {
    const k = kette.current; if (!k || (art !== 'klassik' && art !== 'welle')) return;
    stueckLaden(k, stueck + 1); k.audio.play().then(() => setSpielt(true)).catch(() => setSpielt(false));
  }, [art, stueck, stueckLaden]);

  useEffect(() => { if (kette.current) kette.current.laut.gain.value = lautstaerke; }, [lautstaerke]);
  useEffect(() => () => { stop(); kette.current?.ctx.close().catch(() => {}); kette.current = null; }, [stop]);

  return { art, spielt, spielen, stop, naechstes, titel: art === 'klassik' || art === 'welle' ? STUECKE[stueck].titel : null, lautstaerke, setLautstaerke };
}
