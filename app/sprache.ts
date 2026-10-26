'use client';
import { useEffect, useRef, useState } from 'react';

type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };

/** Spracheingabe des Browsers für ein Textfeld. Hängt an den vorhandenen Text an. */
export function useSprache(text: string, setText: (t: string) => void, onFehler: (m: string) => void) {
  const [hoert, setHoert] = useState(false);
  const [geht, setGeht] = useState(false);
  const rec = useRef<Rec | null>(null);
  const basis = useRef('');
  useEffect(() => { const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setGeht(!!(W.SpeechRecognition || W.webkitSpeechRecognition)); }, []);
  useEffect(() => () => rec.current?.stop(), []);
  function umschalten() {
    if (hoert) { rec.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = true;
    basis.current = text ? text.replace(/\s*$/, ' ') : '';
    r.onresult = (e) => {
      let fest = ''; let zwischen = '';
      for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) fest += res[0].transcript; else zwischen += res[0].transcript; }
      setText(basis.current + fest + zwischen);
    };
    r.onend = () => setHoert(false);
    r.onerror = () => { setHoert(false); onFehler('Spracheingabe geht hier nicht. Nimm das Mikrofon der Tastatur.'); };
    rec.current = r; r.start(); setHoert(true);
  }
  return { hoert, geht, umschalten, stop: () => rec.current?.stop() };
}
