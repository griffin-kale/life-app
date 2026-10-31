'use client';
import { useEffect, useState } from 'react';
/**
 * Ansicht eines Langfristplans in der Ablage (0.30). Liest die Felder des Plans so, wie sie in der Datei stehen,
 * und zeigt sie als Text: React maskiert alles, nichts wird als HTML ausgegeben. Unbekannte Felder bleiben weg.
 * Abgehakte Jahresziele liegen verschlüsselt neben dem Plan, die Datei selbst bleibt unverändert.
 */
export type Plan = Record<string, unknown>;
type Obj = Record<string, unknown>;

const istObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const zahl = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
/** Ein Wert als lesbarer Text: Text bleibt Text, ein Objekt zeigt Text oder Name, sonst seine einfachen Werte. */
function txt(x: unknown): string {
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (istObj(x)) {
    for (const k of ['text', 'name', 'titel', 'frage']) if (typeof x[k] === 'string') return x[k] as string;
    return Object.values(x).filter((v) => typeof v === 'string' || typeof v === 'number').join(' · ');
  }
  return '';
}
const NAME: Record<string, string> = { ist: 'Ist', ziel: 'Ziel', soll: 'Soll' };

export function PlanAnsicht({ plan, haken: gespeichert, onHaken }: { plan: Plan; haken: Record<string, boolean>; onHaken: (h: Record<string, boolean>) => void }) {
  // Haken sofort zeigen, gespeichert wird verschlüsselt im Hintergrund
  const [haken, setHaken] = useState(gespeichert);
  useEffect(() => { setHaken(gespeichert); }, [gespeichert]);
  const kategorien = liste(plan.kategorien).filter(istObj);
  const katName = (nr: unknown) => txt(kategorien.find((k) => k.nr === nr)?.name) || String(nr);
  const fokus = liste(plan.fokus_wahlen).filter(istObj);
  const zieljahr = Math.max(0, ...fokus.map((f) => zahl(f.jahr) ?? 0));
  const jetzt = new Date().getFullYear();
  // Messspalten wie ist_2026, ziel_2032, soll_2045: nach Jahr sortiert, Maßstab ist der größte Wert
  const spalten = [...new Set(kategorien.flatMap((k) => Object.keys(k).filter((s) => /^(ist|ziel|soll)_\d{4}$/.test(s))))].sort((a, b) => a.slice(-4).localeCompare(b.slice(-4)));
  const max = Math.max(1, ...kategorien.flatMap((k) => spalten.map((s) => zahl(k[s]) ?? 0)));
  const jahresziele = liste(plan.jahresziele).filter(istObj);
  const gewohnheiten = liste(plan.dividenden_gewohnheiten).filter(istObj);
  const bs = istObj(plan.betriebssystem) ? plan.betriebssystem : {};
  const rhythmen = liste(bs.rhythmen).filter(istObj);
  const umschalten = (k: string) => { const neu = { ...haken, [k]: !haken[k] }; setHaken(neu); onHaken(neu); };

  return (
    <div className="pl">
      <section className="gsec" aria-label="Überblick">
        <div className="group pad pl-kopf">
          <h2 className="pl-titel">{txt(plan.titel)}</h2>
          {zieljahr > jetzt ? <p className="pl-count"><b className="num">{zieljahr - jetzt}</b> Jahre bis {zieljahr}</p> : null}
          {plan.ziel ? <p className="pl-ziel">{txt(plan.ziel)}</p> : null}
          {plan.weg ? <p className="muted small">{txt(plan.weg)}</p> : null}
          {plan.stand ? <p className="muted small">Stand {txt(plan.stand)}</p> : null}
        </div>
      </section>

      {fokus.length ? (
        <section className="gsec" aria-label="Wahlen">
          <h2 className="glabel">Entscheidende Wahlen</h2>
          <div className="group">{fokus.map((f, i) => <div key={i} className="cell static"><span className="lbl">{txt(f.jahr)}{f.art ? ` · ${txt(f.art)}` : ''}<small>{f.alter ? `mit ${txt(f.alter)}` : ''}{f.prioritaet ? ` · ${txt(f.prioritaet)}` : ''}</small></span></div>)}</div>
        </section>
      ) : null}

      {kategorien.length ? (
        <section className="gsec" aria-label="Kategorien">
          <h2 className="glabel">Kategorien</h2>
          <div className="pl-legende">{spalten.map((s, i) => <span key={s} className={'pl-l' + i}>{NAME[s.split('_')[0]] ?? s} {s.slice(-4)}</span>)}</div>
          <div className="group">
            {kategorien.map((k, i) => {
              const gate = /gate|tor/i.test(txt(k.typ));
              return (
                <div key={i} className={'cell static pl-kat' + (gate ? ' gate' : '')}>
                  <span className="lbl">{txt(k.nr)}. {txt(k.name)}{k.typ ? <small>{txt(k.typ)}</small> : null}</span>
                  <span className="pl-balken" role="img" aria-label={spalten.map((s) => `${NAME[s.split('_')[0]] ?? s} ${s.slice(-4)}: ${zahl(k[s]) ?? '–'}`).join(', ')}>
                    {spalten.map((s, j) => <i key={s} className={'pl-l' + j} style={{ width: `${((zahl(k[s]) ?? 0) / max) * 100}%` }} />)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {liste(plan.phasen).length ? (
        <details className="disclose pl-teil" aria-label="Phasen"><summary>Phasen</summary>
          <div className="group">{liste(plan.phasen).filter(istObj).map((p, i) => <div key={i} className="cell static"><span className="lbl">{txt(p.name)}<small>{txt(p.zeitraum)}{liste(p.kategorien).length ? ` · ${liste(p.kategorien).map(katName).join(', ')}` : ''}</small></span></div>)}</div>
        </details>
      ) : null}

      {jahresziele.length ? (
        <section className="gsec" aria-label="Jahresziele">
          <h2 className="glabel">Jahresziele</h2>
          {jahresziele.map((j) => {
            const ziele = liste(j.ziele); const jahr = txt(j.jahr);
            const fertig = ziele.filter((_, i) => haken[`${jahr}|${i}`]).length;
            return (
              <details key={jahr} className="disclose pl-teil" open={jahr === String(jetzt) || jahr === String(jetzt + 1)}>
                <summary>{jahr}<span className="muted small"> · {fertig} von {ziele.length}</span></summary>
                <div className="group">
                  {ziele.map((z, i) => (
                    <label key={i} className="cell static tr-aufgabe">
                      <input type="checkbox" className="tr-haken" checked={!!haken[`${jahr}|${i}`]} onChange={() => umschalten(`${jahr}|${i}`)} />
                      <span className="lbl">{txt(z)}{istObj(z) && liste(z.kategorien).length ? <small>{liste(z.kategorien).map(katName).join(', ')}</small> : null}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </section>
      ) : null}

      {gewohnheiten.length ? (
        <details className="disclose pl-teil" aria-label="Gewohnheiten"><summary>Gewohnheiten</summary>
          <div className="group">{gewohnheiten.map((g, i) => <div key={i} className="cell static"><span className="lbl">{txt(g.text)}<small>{[txt(g.ebene), txt(g.rhythmus), g.start ? `ab ${txt(g.start)}` : ''].filter(Boolean).join(' · ')}</small></span></div>)}</div>
        </details>
      ) : null}

      {rhythmen.length ? (
        <details className="disclose pl-teil" aria-label="Rhythmen"><summary>Rhythmen</summary>
          <div className="group">
            {rhythmen.map((r, i) => {
              const f = istObj(r.abendfrage) ? r.abendfrage : null;
              return (
                <div key={i} className="cell static pl-rhythmus">
                  <span className="lbl">{txt(r.name)}<small>{[txt(r.ebene), r.dauer_min ? `${txt(r.dauer_min)} Min.` : '', r.zielquote ? `Ziel ${txt(r.zielquote)}` : ''].filter(Boolean).join(' · ')}</small></span>
                  {r.inhalt ? <p className="muted small">{txt(r.inhalt)}</p> : null}
                  {f ? <p className="pl-frage">{txt(f.frage)}{liste(f.optionen).length ? <span className="pl-optionen">{liste(f.optionen).map((o, j) => <span key={j} className="fb-chip">{txt(o)}</span>)}</span> : null}</p> : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {[['Prinzipien', bs.prinzipien], ['Rote Linien', plan.rote_linien], ['Annahmen', plan.annahmen]].map(([t, l]) => liste(l).length ? (
        <details key={t as string} className="disclose pl-teil" aria-label={t as string}><summary>{t as string}</summary>
          <ul className="pl-liste">{liste(l).map((x, i) => <li key={i}>{txt(x)}</li>)}</ul>
        </details>
      ) : null)}
    </div>
  );
}
