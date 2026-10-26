/** Beim Hochfahren: Geheimnisse auf ENCRYPTION_KEY heben, dann den Zeitplan für WHOOP-Abgleich und Mitteilungen starten. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { umschluesseln } = await import('./lib/tresor');
    // Schlägt das fehl, startet Life trotzdem: Gelesen wird mit beiden Schlüsseln, beim nächsten Start geht es weiter.
    await umschluesseln().catch((e) => console.error('[tresor] Umschlüsseln fehlgeschlagen', (e as Error).name));
    const { starten } = await import('./lib/zeitplan');
    starten();
  }
}
