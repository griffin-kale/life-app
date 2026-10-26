/** Nur die Video-ID aus einem YouTube-Link (Phase 3): keine Zeitmarken, Playlists oder Tracking-Parameter an YouTube. */
export function videoId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^(www\.|m\.)/, '');
    const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0]
      : host === 'youtube.com' ? (u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] || '') : '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
