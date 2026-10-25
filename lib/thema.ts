/** Darstellung: Dunkel (Standard), Hell oder wie das Gerät. Steht in einem Cookie, damit der Server die Seite gleich richtig ausliefert. */
export const THEMEN = ['dark', 'light', 'system'] as const;
export type Thema = (typeof THEMEN)[number];
export const THEMA_COOKIE = 'life-thema';
export const themaAus = (v: string | undefined): Thema => (THEMEN as readonly string[]).includes(v ?? '') ? (v as Thema) : 'dark';
/** Farbe der Statusleiste und des Browserrands pro Modus */
export const RAND = { dark: '#0A1326', light: '#F2F1EC' } as const;
