/**
 * Stand von Sicherung und Wiederherstellungstest, ohne Datenbank und ohne Dateizugriff (dafür sorgt `/api/health`).
 * Die Skripte `deploy/backup.sh` und `deploy/restore-test.sh` schreiben die Statusdateien.
 */

/** Nächtliche Sicherung plus zwei Stunden Spielraum. */
export const BACKUP_HOECHSTENS_MS = 26 * 3_600_000;
/** Monatlicher Test plus Spielraum. */
export const RESTORE_HOECHSTENS_MS = 40 * 86_400_000;

export type BackupStatus = 'ok' | 'alt' | 'fehlt' | 'aus';
export type RestoreStatus = 'ok' | 'fehler' | 'alt' | 'fehlt' | 'aus';

/** `inhalt` ist der Text aus `status-backup` (ISO-Zeit), null wenn die Datei fehlt, undefined wenn nicht eingerichtet. */
export function backupStatus(inhalt: string | null | undefined, jetzt: number): BackupStatus {
  if (inhalt === undefined) return 'aus';
  if (inhalt === null) return 'fehlt';
  const t = Date.parse(inhalt.trim());
  return Number.isFinite(t) && jetzt - t <= BACKUP_HOECHSTENS_MS ? 'ok' : 'alt';
}

/** `inhalt` aus `status-restore`: „ok <ISO>“ oder „fehler <ISO>“. */
export function restoreStatus(inhalt: string | null | undefined, jetzt: number): RestoreStatus {
  if (inhalt === undefined) return 'aus';
  if (inhalt === null) return 'fehlt';
  const [art, zeit] = inhalt.trim().split(/\s+/);
  if (art !== 'ok') return 'fehler';
  const t = Date.parse(zeit ?? '');
  return Number.isFinite(t) && jetzt - t <= RESTORE_HOECHSTENS_MS ? 'ok' : 'alt';
}

/** Ein fehlender Status ist kein Ausfall (frischer Server), ein alter oder gescheiterter schon. */
export const betriebGesund = (b: BackupStatus, r: RestoreStatus) => b !== 'alt' && r !== 'fehler' && r !== 'alt';
