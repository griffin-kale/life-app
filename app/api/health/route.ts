import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { LETZTER_LAUF, zeitplanStatus } from '@/lib/zeitplan-schutz';
import { backupStatus, betriebGesund, restoreStatus } from '@/lib/betrieb';

export const dynamic = 'force-dynamic';

/** Liest eine Statusdatei der Sicherung. undefined, wenn kein Ordner eingerichtet ist, null, wenn die Datei fehlt. */
async function status(datei: string): Promise<string | null | undefined> {
  const ordner = process.env.BACKUP_STATUS_DIR;
  if (!ordner) return undefined;
  try { return (await readFile(path.join(ordner, datei), 'utf8')).slice(0, 100); } catch { return null; }
}

/**
 * Lebenszeichen für Überwachung und nach jedem Update. Verrät nichts außer „läuft“:
 * Datenbank erreichbar, Zeitplan (Mitteilungen, WHOOP) höchstens fünf Minuten im Verzug,
 * Sicherung höchstens 26 Stunden alt, letzter Wiederherstellungstest geklappt.
 */
export async function GET() {
  const jetzt = Date.now();
  let db = 'ok';
  let letzter: number | null = null;
  try {
    const [r] = await sql<{ value: string }[]>`select value from settings where key = ${LETZTER_LAUF}`;
    const t = r ? Date.parse(r.value) : NaN;
    letzter = Number.isFinite(t) ? t : null;
  } catch {
    // Direkt nach dem allerersten Start fehlt die Tabelle noch: dann reicht ein einfaches select
    try { await sql`select 1`; } catch { db = 'fehler'; }
  }
  const zeitplan = zeitplanStatus({ letzter, jetzt, laeuftSeitMs: process.uptime() * 1000, aus: process.env.LIFE_ZEITPLAN === 'aus' });
  const backup = backupStatus(await status('status-backup'), jetzt);
  const restore = restoreStatus(await status('status-restore'), jetzt);
  const ok = db === 'ok' && zeitplan !== 'verzug' && betriebGesund(backup, restore);
  return NextResponse.json({ ok, db, zeitplan, backup, restore }, { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
