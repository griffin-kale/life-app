# Auftrag: Life auf ein solides Fundament bringen

Du arbeitest im Repo `griffin-kale/life-app` (lokal `~/Lage/life-app`) an Peters App „Life“, live unter https://life.gneuss.xyz. Stand ist 0.15.2 auf dem Zweig `fix/sitzung`. `main` steht noch bei 0.4.0, dazwischen liegen rund 15 aufeinander aufbauende Zweige.

Lies zuerst `CLAUDE.md`, `docs/UEBERGABE.md` und `CHANGELOG.md`. Die Regeln in `CLAUDE.md` gelten ohne Ausnahme: Daten bleiben in Deutschland, Claude bekommt nur Pseudonyme, es gibt keine externen Ressourcen, Geheimnisse kommen nie ins Repo und nie in den Chat, die CSP wird nur verschärft, Fragen an Peter sind klickbar. Arbeite nach `karpathy-guidelines`, `security-and-hardening`, `apple-design` und `git-workflow-and-versioning`.

## Ausgangslage

Eine Prüfung am 26.10.2026 hat diese Noten ergeben (1 bis 10):

| Bereich | Note | Ziel |
|---|---|---|
| Sicherheit | 5 (vor dem Hotfix 2) | 8 |
| Datenschutz und Pseudonymisierung | 5 | 8 |
| Betrieb, Backups, Deploy | 3 | 8 |
| Architektur und Code | 6 | 8 |
| Datenbank | 5 | 7 |
| Tests und CI | 6 | 8 |
| Performance | 7 | 8 |
| Visuelles Design | 8 | 9 |
| Kernabläufe und Navigation | 5 | 8 |
| Zustände und Feedback | 5 | 8 |
| Barrierefreiheit | 6 | 8 |
| Texte | 7 | 8 |
| iPad und Mac | 6 | 8 |

Die kritische Lücke ist behoben. Das Challenge-Cookie galt als Sitzung und ist in 0.15.2 getrennt worden. Prüfe trotzdem, ob es weitere Wege gibt, ohne Anmeldung an Daten zu kommen.

## Vorgehen

- **Eine Phase nach der anderen**, jede auf einem eigenen Zweig. Am Ende jeder Phase:
  - `npm run typecheck`, `npm run test:unit`, `npm run build`, `npm run test:e2e` und `SCREENSHOTS=1` laufen lassen.
  - Version nach SemVer erhöhen, Eintrag in `CHANGELOG.md`, `docs/UEBERGABE.md` aktualisieren.
  - Peter sagen, was sich geändert hat und was er selbst tun muss. Erst dann zur nächsten Phase.
- **Zu jedem Befund ein Test, der vorher rot und danach grün ist.** Bei Sicherheitsbefunden ist das Pflicht.
- **Entscheidungen, die Peter treffen muss** (unten mit „Peter fragt“ markiert), stellst du als klickbare Auswahl mit Empfehlung und der Möglichkeit, eigene Worte zu ergänzen. Rate nicht.
- **Nichts auf Peters Mac oder dem Server löschen**, ohne vorher zu fragen. Jedes SSH läuft über 1Password mit Touch ID.
- **Wenn ein Befund nicht stimmt**, sag das und lass ihn weg. Bau nichts dazu, was hier nicht steht.

## Phase 1 – Sicherheit (zuerst, Zweig `fix/sicherheit`)

1. **Der Setup-Code ist ein dauerhafter Generalschlüssel.**
   - Betroffen: `app/api/auth/register-options`, `register`, `code/berechtigt.ts` und `code/fertig`.
   - Sobald ein Passkey oder ein Passwort existiert, gehen ein neuer Passkey oder ein neues Passwort mit Code nur noch mit gültiger Sitzung.
   - Der Setup-Code gilt nur, solange noch nichts eingerichtet ist.
   - Test: Setup-Code nach der Einrichtung liefert 403.
2. **Sitzungen lassen sich nicht widerrufen.**
   - Einen Zähler `sitzung_version` pro Nutzer im JWT mitführen. „Abmelden“ und „Auf allen Geräten abmelden“ (neu in den Einstellungen) erhöhen ihn.
   - Für Daten, die verschlüsselt gespeichert werden (TOTP, WHOOP, VAPID), einen eigenen `ENCRYPTION_KEY` einführen. Das Wechseln von `SESSION_SECRET` darf diese nicht mehr unlesbar machen.
   - Eine Übergangslösung, die bestehende Geheimnisse sicher umschlüsselt, ist nötig. **Peter fragt:** Wann soll umgestellt werden?
3. **CSRF.**
   - In `middleware.ts` jede Anfrage auf `/api/*` ablehnen, die nicht GET oder HEAD ist und deren `Origin` nicht `PUBLIC_ORIGIN` ist. Ausnahme: `/api/capture` mit Bearer-Schlüssel.
   - Die Cookies bekommen den Präfix `__Host-`.
4. **`OPEN` in `middleware.ts` passt auf Präfixe.**
   - Auf genaue Pfade umstellen.
   - Jede API-Route prüft die Sitzung zusätzlich selbst über `requireSession()`. Das ist der zweite Riegel.
5. **Pseudonymisierung muss geschlossen ausfallen.**
   - In `lib/claude.ts` `geschuetzteNamen` schluckt einen Datenbankfehler mit `.catch(() => [])`. Dann gehen Namen im Klartext raus.
   - Fehler weiterwerfen, sodass der Claude-Aufruf abbricht.
6. **Begrenzungen.**
   - `POST /api/heute` startet einen teuren Sortierlauf ohne `begrenzt()`.
   - Beim Passwort-Login nur Fehlversuche zählen, damit niemand Peter aussperren kann.
7. **Fehlermeldungen.**
   - Texte aus simplewebauthn, Anthropic, WHOOP und iCloud gehen roh an den Client (`auth/login`, `auth/register`, `essen`, `geld`, `koerper`).
   - Stattdessen feste deutsche Meldungen senden.
8. **CSP ohne `'unsafe-inline'` für Skripte.**
   - Nonce aus der Middleware mit `'strict-dynamic'`, so wie Next 15 es vorsieht.
   - Prüfen, dass Darstellung, Service Worker und Kamera weiter gehen.
9. **Größe von Anfragen.** `request_body max_size` in Caddy auf 8 MB, für Fotos geprüft. Auf dem Server die JPEG-Signatur prüfen und EXIF entfernen.

## Phase 2 – Betrieb (Zweig `chore/betrieb`)

**Stand 0.17.0:** Punkte 2, 4 (ohne Uptime-Dienst), 5 und 6 (ohne Digest) erledigt. Punkt 3 nach Peters Entscheidung ohne Storage Box und `age`: Hetzner-Server-Backup plus geprüfte Dumps. Offen: Punkt 1 (Lese-Token und `GHCR_IMAGE`), Uptime Kuma auf eigenem Server, Punkt 7 mit Tailscale, Deploy-Nutzer und fail2ban.

1. **Zweige aufräumen.**
   - Den Stapel nach `main` bringen, am einfachsten über einen Pull Request vom neuesten Zweig. Peter gibt mit „Merge“ frei.
   - Dann `v0.x.y` taggen und `GHCR_IMAGE` in der `.env` setzen.
   - Ab dann nur noch fertige Images aufspielen, kein Bauen auf dem 1-GB-Server.
   - `deploy.sh --build` bleibt der Notweg. Vorher `docker tag life-app:local life-app:prev`, nicht aufräumen, damit es einen Rückweg gibt.
2. **CI.**
   - `ci.yml` läuft für alle Pull Requests.
   - `release.yml` baut erst nach grüner CI und nur von Tags auf `main`.
   - Actions auf Commit-SHA festlegen, Images per Digest aufspielen.
3. **Backups.**
   - Ein eigenes Skript mit `set -o pipefail`, Prüfung (`gunzip -t`, Mindestgröße), Verschlüsselung mit `age`, Kopie auf eine Hetzner Storage Box in Deutschland.
   - Einmal im Monat automatisch in eine Wegwerf-Datenbank wiederherstellen und das Ergebnis melden.
   - **Peter fragt:**
     - Storage Box ja oder nein?
     - Wo liegt der private `age`-Schlüssel, zum Beispiel in 1Password?
   - Die Anleitung zum Wiederherstellen kommt in die UEBERGABE.
4. **Monitoring.**
   - `/api/health` meldet zusätzlich den letzten erfolgreichen Lauf des Zeitplans und liefert 503 ab 5 Minuten Verzug.
   - `healthcheck` im Compose für app, db und caddy. Log-Rotation (`max-size 10m`, `max-file 3`).
   - Ein externer Uptime-Check, der Peter per Push oder Mail meldet. **Peter fragt:** welcher Dienst, in Deutschland gehostet?
   - Ein Caddy-Access-Log ohne Query-Strings, 14 Tage aufbewahren.
5. **Zeitplan.**
   - `tick()` darf sich nicht überlappen: Flag im Prozess plus `pg_try_advisory_lock`.
   - `einmal()` setzt den Schlüssel atomar vor dem Senden (`insert … on conflict do nothing returning`).
6. **Updates.** `docker compose pull` für alle Dienste. Caddy und Postgres per Digest festlegen, dazu Renovate oder Dependabot.
7. **SSH.** Port 22 über die Hetzner Cloud Firewall auf Peters IPs beschränken oder auf Tailscale umstellen. Deploy mit eigenem Nutzer statt root, dazu fail2ban. **Peter fragt:** Welche Variante soll es sein?

## Phase 3 – Datenschutz (Zweig `fix/datenschutz`)

1. **Kein Datum an Claude.** In `lib/coach.ts` steht „Heute ist Montag, 26. Oktober“ neben Schlaf, HRV und WHO-5. Nur noch den Wochentag schicken.
2. **Kalendertitel.**
   - Private Titel gehen mit Uhrzeit raus. Neue Namen erkennt die Pseudonymisierung erst nach dem ersten Mal.
   - **Peter fragt:**
     - Titel ganz weglassen (nur „Termin privat“)?
     - Titel nur mit vorheriger Maskierung über eine lokale Liste (Arzt, Therapie, Namen)?
     - Oder wie bisher?
3. **Fotos von Bons und Essen** gehen ungefiltert an Claude: Adresse, Kartennummer, Gesichter. **Peter fragt:**
   - Bons im Browser auf den oberen Teil zuschneiden?
   - Ausnahme ausdrücklich in `CLAUDE.md` aufnehmen?
   - Oder nur Text statt Foto?
4. **YouTube oEmbed** ist ein nicht genannter Fremddienst (`lib/enrich.ts`). Mindestens die URL auf die Video-ID kürzen. **Peter fragt:** behalten und in `CLAUDE.md` aufnehmen, oder streichen?
5. **Zeitzone.** `lib/kalender.ts` rechnet fest mit `+01:00`. Einen zentralen Baustein `lib/zeit.ts` bauen (`heuteBerlin`, `jetztBerlin`, Tagesgrenzen) und die rund 28 Stellen mit eigenem `Intl.DateTimeFormat` darauf umstellen. Mit Tests für Sommer- und Winterzeit.

## Phase 4 – UX und UI (Zweig `feature/ux`)

**Stand 0.18.0:** Punkte 1, 3 und 4 sind mit dem Umbau von Heute erledigt (Mockups, Peters Wahl B mit Coach-Blatt wie A). Abweichungen: Festhalten liegt im Coach-Blatt statt als eigenes Feld, der Kalender zeigt auf Heute nur noch freie Zeit an der ersten Aufgabe. Punkt 2 hat sich damit erledigt: Die Coach-Leiste öffnet das Feld mit einem Tippen. Offen bleibt: Offen-Punkte im Coach als Links.

Zeig Peter vor dem Bauen zwei bis drei Mockups für Heute, mit iPhone, iPad und Mac nebeneinander. Er entscheidet, erst dann bauen.

1. **Heute: das Wichtigste nach oben.**
   - „Jetzt dran“ beginnt heute erst nach etwa 2,6 Bildschirmen.
   - Vorschlag für die Reihenfolge: Kopf, Fragebogen (nur wenn fällig), Jetzt dran, Festhalten kompakt, Coach, Empfohlen, Kalender, Als Nächstes, Kompass, Erledigt.
   - Gespeicherte Listen über `nachruesten` mit `STAND = 5` umstellen.
2. **Festhalten mit einem Tap.** Das Plus fokussiert sofort das Feld, das Menü mit allen Wegen kommt per langem Drücken oder als zweite Option.
3. **Coach auf Heute.**
   - Nur die letzten zwei Wechsel zeigen, das ganze Gespräch als eigene Ansicht. Kein zweiter Scrollbereich.
   - Die Offen-Punkte sind selbst Links. Der doppelte Wochenstart-Chip fällt weg, jedes Ding steht an genau einer Stelle.
4. **Kalender auf Heute** zeigt ab jetzt die nächsten drei Einträge plus den Vorschlag fürs Wichtigste. Den ganzen Tag gibt es zum Aufklappen.
5. **Blättern** (`app/blaetter.tsx`, `.bl-bahn`).
   - Die Höhe folgt der aktiven Seite.
   - Die Leiste mit Zurück und Weiter klebt über der Tab-Leiste.
   - Prüfen in Wochenstart, Standortbestimmung und Fragebögen.
6. **Fehler und Laden.**
   - `app/error.tsx` und `app/not-found.tsx` auf Deutsch, mit „Neu laden“ und „Zu Heute“.
   - Die rund 66 stillen `.catch(() => {})` durchgehen. Wo Daten fehlen, steht eine leise Zeile mit „Nochmal“.
   - Skelette mit fester Höhe, damit Heute beim Laden nicht springt. Die Bausteine kommen serverseitig mit, wie das Thema-Cookie.
7. **Kontrast** (axe, alle Seiten im hellen Modus).
   - `--faint` hell auf etwa `#6B7487`, dunkel auf `#7E8BA2`.
   - Eigene dunklere Textfarben für die Konten im hellen Modus, z. B. `--k-geld-text`.
   - Ziel: keine ernsten axe-Befunde. Einen axe-Lauf in die e2e-Tests aufnehmen.
8. **Tap-Ziele ab 44 px.**
   - Skala 1–10 in der Standortbestimmung (heute 29 px breit, zwei Reihen à fünf).
   - Pfeile in „Heute anpassen“.
   - Inline-Links, `chat-chip`, `chat-senden`, `uk-akt`, Ruhe-Pillen.
9. **iPad.**
   - `.hero { grid-template-columns: minmax(0,1fr) }` gegen den Überlauf der Coach-Karte.
   - Ruhe und Dein Stand in die Leiste oben.
   - Körper hochkant als 2×2, Schnellzugriffe ohne harten Schnitt.
10. **Farben und Texte.**
    - „Ausgabe“ bekommt die Geld-Farbe, „Essen“ und die Geld-Töpfe neutrale Töne.
    - „Fertig“ im Fragebogen heißt „Antworten speichern“ und steht am Ende.
    - Energie-Kachel in Worten.
    - „Danach:“ vor gab Kraft, neutral, kostete Kraft.
    - Einheitlich „Wenn-dann-Plan“.
    - Minutenangabe ohne Umbruch.
    - Doppelten Mikrofon-Hinweis streichen.

## Phase 5 – Technik und Familie vorbereiten (Zweig `refactor/fundament`)

1. **Nutzer statt `'peter'`.** 73 Stellen setzen den Nutzer fest ein, und 19 von 28 Abfragen auf `items` filtern nicht nach `user_id`.
   - `withUser(handler)` liest den Nutzer aus der Sitzung, jede Abfrage bekommt ihn.
   - Settings-Schlüssel bekommen das Nutzer-Suffix. `tick()` läuft für alle Nutzer.
   - Ein e2e-Test mit zwei Nutzern beweist, dass keiner die Daten des anderen sieht, auch nicht per ID.
2. **Transaktionen** in `app/api/items/[id]` (Verdrängen aus Jetzt plus Korrektur plus Update) mit `select … for update`.
3. **Claude-Aufrufe in Anfragen.**
   - Gemeint sind Chat, Standort, Bon und Essen.
   - Obergrenze 30 s, `maxRetries: 0`.
   - Lange Aufrufe über `after()` und einen Status-Endpunkt, wie bei `enrich`.
4. **Heute in einem Abruf.** Die rund zehn Einzelabrufe in einen Endpunkt oder eine Server Component zusammenfassen. Fürs Abfragen beim Sortieren ein kleiner Status-Endpunkt statt alle 2,5 s die ganze Seite.
5. **Migrationen.** Eine Tabelle `schema_version` mit nummerierten Schritten, `pg_advisory_lock` und je einer Transaktion pro Schritt. Fehlende Indizes: `korrekturen(item_id)` und `ruhe(user_id, tag)`.
6. **Tests.**
   - Den großen e2e-Test in Teile mit eigenem Setup über API-Fixtures aufteilen.
   - In den Tests den Standalone-Server starten wie live.
   - Einen Test für `tick()` mit gefälschter Uhr schreiben.
7. **Dokumente angleichen.**
   - README und `.env.example` beschreiben noch Bedrock und AWS.
   - UEBERGABE nennt den Stand 0.11 und die Schrift Instrument Serif.
   - Ein CI-Check vergleicht die Version in `package.json` mit UEBERGABE und CHANGELOG.
8. **Große Dateien teilen**, wenn du sie ohnehin anfasst: `globals.css` (80 KB) nach Bereichen, `app/geld/seite.tsx` und `app/page.tsx` in Komponenten. Kein Umbau ohne Anlass.

## Abschluss

Nach Phase 5 machst du dieselbe Prüfung noch einmal mit drei unabhängigen Prüfern: Sicherheit, UX und UI, Technik. Gib Peter die neue Tabelle mit alter Note, neuer Note und Ziel. Für jeden Bereich unter dem Ziel nennst du den Grund und den nächsten Schritt.
