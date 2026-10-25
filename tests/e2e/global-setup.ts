import postgres from 'postgres';
import { TEST_ENV } from '../../playwright.config';

/**
 * Leert die Testdatenbank vor jedem Lauf. Die Adresse kommt nur aus TEST_ENV, nie vom Server.
 * Tabellen bleiben stehen, damit ein bereits laufender App-Server sein Schema behält.
 */
export default async function globalSetup() {
  const sql = postgres(TEST_ENV.DATABASE_URL, { max: 1, onnotice: () => {} });
  for (const t of ['korrekturen', 'items', 'credentials', 'settings']) {
    const [{ da }] = await sql`select to_regclass(${t}) is not null as da`;
    if (da) await sql.unsafe(`truncate ${t} cascade`);
  }
  await sql.end();
}
