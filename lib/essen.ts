import { askJson, askJsonBild } from './claude';
import { ensureSchema, sql } from './db';

/**
 * Essen festhalten: per Barcode (Open Food Facts bekommt nur die Nummer), per Satz oder per Foto (Claude schätzt Spannen).
 * Fotos werden nicht gespeichert.
 */

export const MAHLZEITEN = ['fruehstueck', 'mittag', 'abend', 'snack'] as const;
export type Mahlzeit = (typeof MAHLZEITEN)[number];
export const MAHLZEIT_NAME: Record<Mahlzeit, string> = { fruehstueck: 'Frühstück', mittag: 'Mittag', abend: 'Abend', snack: 'Snack' };

export type Produkt = { ean: string; name: string; marke: string | null; kcal: number | null; protein: number | null; kh: number | null; fett: number | null; portion_g: number | null };

const zahl = (x: unknown, max = 5000) => { const n = Number(x); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null; };
export const eanOk = (ean: string) => /^\d{8}$|^\d{12,14}$/.test(ean);

/** Produkt zur Barcode-Nummer. Erst der eigene Speicher, dann Open Food Facts. */
export async function produkt(ean: string): Promise<Produkt | null> {
  if (!eanOk(ean)) return null;
  await ensureSchema();
  const [da] = await sql<Produkt[]>`select ean, name, marke, kcal::float, protein::float, kh::float, fett::float, portion_g::float from lebensmittel where ean = ${ean} and updated_at > now() - interval '90 days'`;
  if (da) return da;
  // Feste Adresse, nur die geprüfte Nummer wird eingesetzt. Kein Eintragstext verlässt den Server.
  const basis = (process.env.OFF_BASE || 'https://world.openfoodfacts.org').replace(/\/$/, '');
  const r = await fetch(`${basis}/api/v2/product/${ean}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity`, { headers: { 'user-agent': 'Life/0.7 (Griffin & Kale GmbH, private App)' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r || r.status !== 200) return null;
  const roh = await r.text(); if (roh.length > 400_000) return null;
  let j: { status?: number; product?: { product_name?: string; product_name_de?: string; brands?: string; serving_quantity?: number | string; nutriments?: Record<string, unknown> } };
  try { j = JSON.parse(roh); } catch { return null; }
  const p = j.product; if (!p || j.status === 0) return null;
  const n = p.nutriments ?? {};
  const name = String(p.product_name_de || p.product_name || '').trim().slice(0, 160);
  if (!name) return null;
  const neu: Produkt = { ean, name, marke: String(p.brands || '').split(',')[0].trim().slice(0, 80) || null,
    kcal: zahl(n['energy-kcal_100g'], 1000), protein: zahl(n['proteins_100g'], 100), kh: zahl(n['carbohydrates_100g'], 100), fett: zahl(n['fat_100g'], 100), portion_g: zahl(p.serving_quantity, 2000) };
  await sql`insert into lebensmittel (ean, name, marke, kcal, protein, kh, fett, portion_g) values (${ean}, ${neu.name}, ${neu.marke}, ${neu.kcal}, ${neu.protein}, ${neu.kh}, ${neu.fett}, ${neu.portion_g})
    on conflict (ean) do update set name = excluded.name, marke = excluded.marke, kcal = excluded.kcal, protein = excluded.protein, kh = excluded.kh, fett = excluded.fett, portion_g = excluded.portion_g, updated_at = now()`;
  return neu;
}

export type Schaetzung = { name: string; protein: number; protein_bis: number; kcal: number; kcal_bis: number; gemuese: boolean };

const PROMPT = [
  'ESSEN',
  'Schätze die Nährwerte dieser Mahlzeit für eine Person. Sei ehrlich mit der Unsicherheit: gib Spannen, keine Scheingenauigkeit. Nennt der Text Grammangaben, rechne damit genau.',
  'Antworte nur mit JSON: {"name": string (höchstens 6 Wörter, deutsch), "protein_von": Zahl in g, "protein_bis": Zahl in g, "kcal_von": Zahl, "kcal_bis": Zahl, "gemuese": true oder false (sichtbar Gemüse oder Salat dabei)}',
].join('\n\n');

function pruefen(a: Record<string, unknown>, fallback: string): Schaetzung {
  const pv = zahl(a.protein_von, 300) ?? 0; const pb = Math.max(pv, zahl(a.protein_bis, 300) ?? pv);
  const kv = zahl(a.kcal_von, 5000) ?? 0; const kb = Math.max(kv, zahl(a.kcal_bis, 5000) ?? kv);
  return { name: String(a.name || fallback).slice(0, 80), protein: pv, protein_bis: pb, kcal: kv, kcal_bis: kb, gemuese: a.gemuese === true };
}

export async function schaetzenText(text: string): Promise<Schaetzung> {
  const a = await askJson<Record<string, unknown>>(`${PROMPT}\n\nMahlzeit (oft diktiert):\n${text.slice(0, 600)}`);
  return pruefen(a, text.slice(0, 40));
}

export async function schaetzenFoto(jpegBase64: string, notiz: string): Promise<Schaetzung> {
  const a = await askJsonBild<Record<string, unknown>>(`${PROMPT}\n\nAuf dem Foto ist die Mahlzeit.${notiz ? ` Dazu von Peter: ${notiz.slice(0, 300)}` : ''}`, jpegBase64);
  return pruefen(a, 'Mahlzeit vom Foto');
}
