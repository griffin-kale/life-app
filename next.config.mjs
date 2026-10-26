// Alles läuft auf dem eigenen Server in Deutschland. Keine externen Skripte, Schriften oder Bilder.
// Die Content-Security-Policy setzt middleware.ts, weil sie pro Anfrage eine neue Nonce braucht.

export default {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Kamera nur für Barcode und Essensfoto, nur von Life selbst (Entscheidung Peter, 25.10.2026)
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=(self)' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
};
