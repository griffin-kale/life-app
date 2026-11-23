/**
 * Eine Bereichsliste für ganz Life (0.33, MAYA, Peter 23.11.2026): Arbeit, Körper, Ruhe, Menschen, Geld, Zeit.
 * Vorher gab es drei Listen mit verschiedenen Wörtern (Geschäft, Sozial, Mental, Ruhe und Geist).
 * Die Schlüssel in der Datenbank bleiben, wie sie sind (geschaeft, sozial, mental), damit nichts umgeschrieben werden muss.
 * Nur die Namen und die Reihenfolge kommen von hier. Ohne Datenbank, damit Unit-Tests und Client sie direkt nutzen.
 */

export const BEREICHE = ['geschaeft', 'koerper', 'mental', 'sozial', 'geld', 'zeit'] as const;
export type Bereich = (typeof BEREICHE)[number];

/** Die fünf Lebensbereiche ohne Arbeit (früher „Konten“). */
export const LEBENSBEREICHE = ['koerper', 'mental', 'sozial', 'geld', 'zeit'] as const;
export type Lebensbereich = (typeof LEBENSBEREICHE)[number];

export const BEREICH_NAME: Record<Bereich, string> = {
  geschaeft: 'Arbeit', koerper: 'Körper', mental: 'Ruhe', sozial: 'Menschen', geld: 'Geld', zeit: 'Zeit',
};

/** Farbe als CSS-Variable. Arbeit nimmt die Tinte von Life, damit sie in Hell und Dunkel passt. */
export const BEREICH_FARBE: Record<Bereich, string> = {
  geschaeft: 'var(--k-arbeit)', koerper: 'var(--k-koerper)', mental: 'var(--k-mental)', sozial: 'var(--k-sozial)', geld: 'var(--k-geld)', zeit: 'var(--k-zeit)',
};

export const istBereich = (x: unknown): x is Bereich => typeof x === 'string' && (BEREICHE as readonly string[]).includes(x);
export const bereichName = (x: string): string => (istBereich(x) ? BEREICH_NAME[x] : x);
