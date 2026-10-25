/** Startet beim Hochfahren des Servers den Zeitplan für WHOOP-Abgleich und Mitteilungen. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { starten } = await import('./lib/zeitplan');
    starten();
  }
}
