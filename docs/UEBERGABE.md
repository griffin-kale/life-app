# Life – Übergabe und Stand

Diese Datei hält fest, was gebaut ist, warum es so gebaut ist und was als Nächstes kommt. Sie ergänzt `CLAUDE.md` (feste Regeln) und `CHANGELOG.md` (jede Version im Detail). Wer an Life weiterarbeitet, liest zuerst `CLAUDE.md`, dann diese Datei.

Stand: 26. Oktober 2026, Version 0.18.0.

Der Plan für die nächsten Schritte steht in `docs/VERBESSERUNG.md` (fünf Phasen). Phase 1 Sicherheit ist mit 0.16.0 erledigt. Phase 2 Betrieb ist mit 0.17.0 zur Hälfte erledigt (Sicherung, Health, Zeitplan, CI). Offen sind SSH über Tailscale, Uptime Kuma und fertige Images, dafür braucht es zuerst Schritte von Peter. Aus Phase 4 ist mit 0.18.0 der Umbau von Heute vorgezogen (Punkte 1, 3 und 4), Phase 3 Datenschutz ist noch offen.

## Worum es geht

Life ist Peters persönliche App für die fünf Konten nach Sahil Bloom: Zeit, Sozial, Mental, Körper, Geld. Ein Eingang für alles (Aktionstaste, Satz, Foto), Claude sortiert, ein Coach meldet sich morgens und abends. Bedient wird Life fast nur auf dem iPhone als Web-App vom Home-Bildschirm. Life gehört der Griffin & Kale GmbH und soll später für Peters Familie und vielleicht als Produkt taugen.

## Was läuft

| Bereich | Stand | Wo im Code |
|---|---|---|
| Heute aufgeräumt: Wochenringe oben, Coach-Leiste und Coach-Blatt mit einem Feld für Festhalten und Fragen, Spur im Gespräch, freie Zeit an der ersten Aufgabe, Coach fest rechts auf dem Mac | 0.18 | `app/page.tsx`, `app/coach.tsx` (`CoachInhalt`, `CoachLeiste`, `CoachBlatt`, `useCoachChat`), `app/ringe.tsx` (`Wochenringe`), `app/sprache.ts`, `lib/heute-bausteine.ts` |
| Erfassen per Text, Mikrofon, Kurzbefehl, Teilen-Menü | läuft seit 0.1 | `app/page.tsx`, `app/api/capture`, `lib/enrich.ts` |
| Einordnen und Priorisieren mit Engpass, „Jetzt dran“ (3), Stapel, Lernen aus Korrekturen | läuft seit 0.3 | `lib/priorisieren.ts`, `app/woche` |
| Anmeldung per Passkey, ersatzweise Passwort und Einmal-Code | 0.5 | `lib/webauthn.ts`, `lib/zweifaktor.ts`, `lib/totp-core.ts` |
| Sitzungen in der Datenbank, zwei Riegel, CSRF-Schutz, CSP mit Nonce, `ENCRYPTION_KEY`, Einrichtungscode nur einmal | 0.16 | `middleware.ts`, `lib/session.ts` (Signatur, Edge), `lib/sitzung.ts` (Datenbank), `lib/tresor.ts`, `lib/passwort-core.ts`, `lib/fehler.ts`, `lib/jpeg.ts` |
| Claude über die Anthropic-API mit Pseudonymisierung | 0.6 | `lib/claude.ts`, `lib/pseudonym.ts` |
| Coach morgens und abends, Warnsignale | 0.6, erweitert in 0.7 | `lib/coach.ts`, `lib/coach-regeln.ts`, `app/coach.tsx` |
| Fragebögen: Morgen, Abend, Woche mit WHO-5 | 0.6 | `lib/fragen.ts`, `app/fragebogen.tsx` |
| Haushalte und mehrere Menschen im Datenmodell | 0.6, sichtbar nur Peter | `lib/db.ts` (`haushalte`, `nutzer`, `user_id`) |
| WHOOP über OAuth | 0.7 | `lib/whoop.ts`, `app/api/whoop` |
| Training wie RP Hypertrophy, für zu Hause | 0.7 | `lib/training.ts`, `app/koerper/training` |
| Essen per Barcode, Foto, Satz | 0.7 | `lib/essen.ts`, `app/koerper/essen.tsx` |
| Mitteilungen aufs iPhone (Web Push) mit Zeitplan | 0.7 | `lib/push.ts`, `lib/zeitplan.ts`, `instrumentation.ts`, `public/sw.js` |
| Ruhe: Stille, Atem, NSDR, Wim Hof, Runterfahren | 0.8 | `lib/ruhe.ts`, `app/koerper/ruhe` |
| Geld: Wochentöpfe, Bon, Stufenplan, Sparziele, Taschengeld | 0.9 | `lib/geld.ts`, `lib/geld-regeln.ts`, `app/geld` |
| Menschen, Wenn-dann-Pläne, Energie-Bilanz, Parkplatz, Zeit kaufen | 0.11 | `lib/menschen.ts`, `app/menschen`, `app/wenn.tsx`, `app/zeit-kaufen.tsx` |
| Kompass: fünf Ringe, Verlauf, Level, Meilensteine | 0.10 | `lib/kompass.ts`, `lib/kompass-regeln.ts`, `app/kompass` |
| Rückmeldungen ins Backlog, optional als GitHub-Issue | 0.9 | `lib/rueckmeldung.ts`, `app/rueckmeldung.tsx` |
| Standortbestimmung in drei Etappen, Dein Stand, Kalender aus iCloud (lesend), Wochenziel | 0.15 | `lib/standort.ts` (Fragen, Prüfung, ohne Datenbank), `lib/stand.ts`, `app/stand`, `lib/caldav.ts`, `lib/ical-termine.ts`, `lib/kalender-regeln.ts`, `lib/kalender.ts`, `app/kalender.tsx` |
| Coach-Gespräch, Offenes, Empfohlen für dich, Wochenstart, Fragebögen zum Blättern, Geld als Kacheln | 0.14 | `lib/tagesregeln.ts` (Regeln, ohne Datenbank), `lib/tag.ts`, `lib/coach.ts` (`coachChat`), `app/api/coach/chat`, `app/api/wochenstart`, `app/wochenstart`, `app/blaetter.tsx`, `app/coach.tsx`, `lib/zeitplan.ts` |
| Übersicht mit Unterseiten (Körper, Geld, Woche), Schnellzugriffe, iPad und Mac mit Seitenleiste und Inspektor | 0.13 | `app/ueberkarte.tsx`, `app/koerper/{nacht,bewegung,essen}`, `app/geld/seite.tsx`, `app/woche/seite.tsx`, `app/schnell.tsx`, `app/navigation.tsx`, `app/inspektor.tsx` |
| Design: Dunkel, Hell, wie das iPhone; Verlaufskarten, Kontenfarbe pro Bereich, Wochenringe, Level-Weg | 0.12 | `app/globals.css` (Tokens oben, Abschnitt 0.12), `lib/thema.ts`, `app/darstellung.tsx`, `app/ringe.tsx`, `lib/heute-bausteine.ts`, `app/einstellungen/heute`, `app/kurz.tsx` |

Live unter `https://life.gneuss.xyz`. Server: Hetzner CPX02 in Nürnberg (1 vCPU, 1 GB RAM, 2 GB Swap, Ubuntu 24.04), Docker Compose mit App, Postgres und Caddy.

## Was Peter noch tun muss

1. **Anthropic-Schlüssel** in der Console der Griffin & Kale GmbH anlegen, Ausgabenlimit setzen, Auftragsverarbeitungsvertrag annehmen, Schlüssel in `/opt/life/deploy/.env` als `ANTHROPIC_API_KEY=` eintragen, dann `docker compose up -d --force-recreate app`. Ohne Schlüssel sortiert nichts und der Coach schweigt.
2. **WHOOP-App** auf developer.whoop.com registrieren. Weiterleitung `https://life.gneuss.xyz/api/whoop/callback`, Scopes: offline, read:recovery, read:cycles, read:sleep, read:workout, read:body_measurement. `WHOOP_CLIENT_ID` und `WHOOP_CLIENT_SECRET` in die `.env`, App neu starten, in Life unter Körper „WHOOP verbinden“.
3. **`ENCRYPTION_KEY` eintragen, vor dem Aufspielen von 0.16.0:** auf dem Server `cd /opt/life/deploy && (grep -q '^ENCRYPTION_KEY=' .env || echo "ENCRYPTION_KEY=$(openssl rand -base64 48)" >> .env)`. Der Wert erscheint dabei nirgends, und ein vorhandener Schlüssel bleibt stehen. Danach nie wieder ändern oder löschen, sonst sind Einmal-Code, WHOOP und Push-Schlüssel unlesbar. Eine Kopie gehört in 1Password.
4. **Fertige Images (Phase 2):** Lese-Token für GitHub-Pakete (classic, nur `read:packages`) auf dem Server mit `docker login ghcr.io` hinterlegen und `GHCR_IMAGE=ghcr.io/griffin-kale/life-app` in die `.env`. Bis dahin Aufspielen mit `deploy.sh --build`.
4a. **Hetzner-Server-Backup** ist gebucht (Peter, 26.10.2026). Es sichert den ganzen Server täglich, dazu kommen die geprüften Datenbank-Dumps unter `/opt/life/deploy/backups`.
4b. **Für den Rest von Phase 2:** einen zweiten kleinen Hetzner-Server für Uptime Kuma anlegen, ein Tailscale-Konto anlegen und die App auf dem Mac installieren.
5. **Mitteilungen einschalten:** Life vom Home-Bildschirm öffnen, Einstellungen, „Mitteilungen einschalten“, „Probe schicken“.
6. **GitHub-Schlüssel für Rückmeldungen** (optional): Fine-grained Token nur für `griffin-kale/life-app`, nur „Issues: Read and write“, als `GITHUB_ISSUES_TOKEN=` in die `.env`. Ohne Schlüssel bleiben Meldungen nur in Life.
7. **Kalender verbinden:** auf account.apple.com unter „Anmelden und Sicherheit“ → „App-spezifische Passwörter“ eines mit dem Namen „Life“ anlegen. In die `.env` `ICLOUD_USER=` (deine Apple-ID) und `ICLOUD_APP_PASSWORT=` eintragen, `docker compose up -d --force-recreate app`, dann in Life Einstellungen → Kalender → „Kalender suchen“. Widerrufen geht jederzeit an derselben Stelle.
8. **`SETUP_TOKEN` leeren**, sobald alle Geräte eingerichtet sind. Seit 0.16 gilt er nach der Einrichtung ohnehin nicht mehr, leer ist trotzdem sauberer.
9. Später: ui-ux-pro-max-Skill in den Einstellungen entfernen, alte SSH-Schlüssel auf dem Mac löschen, Schlüssel „Peters Mac“ bei Hetzner entfernen.

## Entscheidungen und Gründe

- **Heute 0.18 (Peter, 26.10.2026):** Aus drei Mockups (Artefakt „Life Heute aufräumen“) Richtung B gewählt: große Wochenringe oben, Coach als Leiste über der Tab-Leiste. Geöffnet sieht der Coach aus wie in Richtung A, als Blatt von unten. Festhalten wandert in den Coach, mit zwei Knöpfen „Festhalten“ und „Coach fragen“ (Peters Wahl, statt dass Claude rät). Einwand dazu: Festhalten ist die häufigste Handlung, deshalb öffnet die Leiste das Blatt mit Tastatur, ein Tippen wie vorher. Kalender auf Heute nur noch als Chip mit freier Zeit an der ersten Aufgabe. „Zuletzt festgehalten“ ersetzt die Spur im Gespräch (Peters Wahl). Die Spur kommt aus `items`, nicht aus `coach_chat`, damit sie nie an Claude geht. Der Coach ist kein Baustein mehr, Kalender, Festhalten-Feld und Tagespunkte lassen sich weiter zuschalten.

- **Betrieb 0.17 (Peter, 26.10.2026):** Sicherung bleibt auf dem Server, das Hetzner-Server-Backup ersetzt Storage Box und `age` (Peters Wahl). Restrisiko: Das Hetzner-Backup hängt am selben Konto und verschwindet mit dem Server, und es dreht nur den ganzen Server zurück. Deshalb liegen daneben geprüfte Dumps pro Tag. Ausfall-Meldung über Uptime Kuma auf einem eigenen kleinen Hetzner-Server (kein Fremddienst), SSH über Tailscale mit eigenem Deploy-Nutzer und fail2ban. `/api/health` ist die eine Stelle, die alles meldet: Datenbank, Zeitplan, Sicherung, Wiederherstellungstest. Die App liest dafür nur zwei Statusdateien aus `backups/` (Ordner 711, Dumps 600). Abweichung vom Plan: Caddy und Postgres laufen weiter auf `16-alpine` und `2-alpine` statt per Digest, weil die Cloud-Sitzung Docker Hub nicht erreicht. Das Release hält den Digest des App-Pakets fest, aufgespielt wird weiter per Tag.

- **Claude-Werkzeug 0.16.1 (26.10.2026):** Manche Modelle lehnen `tool_choice` „tool“ mit Fehler 400 ab. `lib/claude.ts` (`senden`) versucht das erzwungene Werkzeug, erkennt die Ablehnung (`zwangAbgelehnt` in `lib/fehler.ts`), merkt sich das Modell im Speicher und fragt mit „auto“ nach. Die Systemanweisung bittet um genau einen Aufruf von „ergebnis“, notfalls holt Life das JSON aus dem Text. Antworten prüft Life weiter gegen feste Listen. Strukturierte Ausgaben (`output_config.format`) wären die sauberere Lösung, brauchen aber pro Aufruf ein festes Schema. Das ist ein Kandidat für Phase 5 Technik.
- **Sicherheit 0.16 (Peter, 26.10.2026):** Phase 1 aus `docs/VERBESSERUNG.md`. `ENCRYPTION_KEY` kommt mit diesem Release (Peters Wahl), alte Geheimnisse bleiben lesbar und werden beim Start umgeschlüsselt. Abweichung vom Plan: statt eines Zählers `sitzung_version` eine Tabelle `sitzungen`. Mit dem Zähler hätte Abmelden auf dem iPhone auch den Mac abgemeldet, mit der Tabelle widerruft Abmelden genau eine Sitzung und „Auf allen Geräten abmelden“ alle. Die Middleware läuft im Edge-Runtime ohne Datenbank, deshalb prüft sie nur die Signatur, jede API-Route prüft zusätzlich die Tabelle. Seiten laden ihre Daten nur über die API.
- **Standortbestimmung und Kalender 0.15 (Peter, 26.10.2026):** Direkt in Life gebaut, drei Etappen à zwölf Minuten (Baseline mit Skalenfragen, Richtung, Engpass nach der Engpasstheorie). Claude schlägt vor, übernommen wird nur, was Peter antippt (feste Liste der Vorschlagsarten in `pruefeAuswertung`). Stand in `stand:peter`, Wochenziel in `wochenziel:peter`. Kalender: iCloud per CalDAV mit app-spezifischem Passwort (Peters Wahl, obwohl das Passwort auch Mail und Kontakte öffnet; Life nutzt es nur für PROPFIND und REPORT auf `caldav.icloud.com`). Arbeitskalender kommt später. Familientermine gehen ohne Titel an Claude.
- **Coach und Tag 0.14 (Peter, 26.10.2026):** Gespräch direkt auf Heute, Verlauf pro Tag (Tabelle `coach_chat`). Proaktiv über vier Wege: verpasste Uhrzeit, Nachmittags-Check um 15 Uhr, Offenes in der Coach-Karte, Wochenstart am Montag. Wochenstart in vier Schritten (Rückblick, Engpass, drei Dinge, Parkplatz), abgeschlossen steht in `wochenstart:peter`, die drei Dinge in `fokus:peter`. „Empfohlen für dich“: feste Regeln in `lib/tagesregeln.ts` entscheiden, die Karte braucht keinen Claude-Aufruf und ist sofort da. Der Coach bekommt die Empfehlung als Grundlage und formuliert sie in seinem Text. Fragebögen blättern seitlich, eine Frage pro Seite. Geld folgt dem Kachelmuster von Körper.
- **Struktur 0.13 (Peter, 25.10.2026):** Übersicht mit Unterseiten wie Apple Health und Oura (höchstens zwei Ebenen, jede Karte mit Zahl und Handlung), gleich für Körper, Geld und Woche. Schnellzugriffe als Baustein auf Heute, das erste Element ist ein Plus mit allen Wegen. Mac: Seitenleiste und Spalten, Logbuch und Woche mit Inspektor. iPad: quer Seitenleiste, hochkant schwebende Leiste oben. Web-Apps auf iOS können keine Schnellaktionen am App-Symbol und keine Widgets, deshalb Kurzbefehle und Aktionstaste. Festhalten liegt auf N statt ⌘N, weil Browser ⌘N für neue Fenster reservieren.

- **Design 0.12 (Peter, 25.10.2026):** Grundlage Richtung A „Nachtblau mit Licht“ aus drei Mockups, dazu Erholung als Farbverlauf, Wochentag-Ringe mit Level-Weg und farbige Ruhe-Karten. Segment-Balken und volle Farbkarten (Richtung B) bewusst nicht. Wochenstand als Tagespunkte statt Ringreihe (zwei Ringreihen übereinander gefielen Peter nicht). Schrift Fraunces nach Recherche (Serifen wirken in Studien luxuriöser, Luxusmarken mischen Serife für Titel mit klarer Schrift für Text). Heute ist pro Mensch anpassbar (Setting `heute:<user_id>`, `lib/heute-bausteine.ts`), „Jetzt dran“ und Fragebogen bleiben fest, weil der Coach die Antworten braucht. Dunkel bleibt Standard. Der Modus steht im Cookie `life-thema`, damit der Server ohne Skript und ohne Aufblitzen richtig rendert. Die iOS-Statusleiste stellt sich erst beim nächsten Öffnen der App um.

| Datum | Entscheidung | Grund |
|---|---|---|
| 25.10. | Web-App statt nativer App | Eine native App wäre gerade Ablenkung. Web-App reicht und ist schneller. |
| 25.10. | Eigener Server bei Hetzner in Nürnberg, Firma zahlt | Daten in Deutschland, Life gehört Griffin & Kale. |
| 25.10. | Imperial Blue `#001D51`, Dark Mode, Instrument Serif | Peters persönliche Farbe, bewusst getrennt vom EHRENBEHÖRDE-Royalblau. |
| 25.10. | SSH und GitHub nur über 1Password mit Touch ID, kein ControlPersist | „Lieber einmal mehr sicher.“ |
| 25.10. | Passwort plus Einmal-Code als zweiter Weg | Passkeys gehen auf Peters iPhone wegen einer Firmen-Einstellung (AutoFill) nicht. Fliegt raus, sobald Passkeys gehen. |
| 25.10. | Claude über die Anthropic-API statt Bedrock | Peter will kein AWS. Ausgleich: Pseudonymisierung vor jedem Aufruf, Körperwerte nur zusammengefasst und ohne Datum. Anthropic verarbeitet in den USA und löscht API-Daten nach 30 Tagen. |
| 25.10. | Namen raus, Gesundheit nur zusammengefasst | Claude soll nie erfahren, um wen es geht. Neue Namen sieht Claude einmal und meldet sie zurück. |
| 25.10. | WHOOP direkt, Apple Health später | WHOOP liefert Erholung, HRV, Schlafphasen automatisch. Schritte gibt die WHOOP-Schnittstelle nicht her. |
| 25.10. | Barcode mit Open Food Facts | Frei, viele deutsche Produkte, bekommt nur die Nummer. Fotos und Sätze schätzt Claude als Spannen (Studie: rund 40 % Fehler bei Kalorien aus Fotos). |
| 25.10. | Mitteilungen per Web Push, 7:00 und 20:30 | Alle vier Arten gewünscht: Morgen, Abend, Warnsignale, Training. |
| 25.10. | Alles bauen, Stück für Stück live | Jede Stufe geht online, sobald sie fertig ist. |
| 25.10. | Fragen immer klickbar, eigene Worte zusätzlich | Peters Regel für die App und für Rückfragen. |
| 25.10. | Dashboard mit Gamification, ohne Tagesserien | Peter mag Dashboards und Spiel-Elemente. Gerissene Serien frustrieren, ein verpasster Tag ändert laut Studie fast nichts. Deshalb Wochenpunkte und bleibende Meilensteine. |

## Fahrplan

### Stufe 3: Ruhe (Meditation), gebaut in 0.8
Peters Wahl: Vorlagen 5, 10 und 20 Minuten, Gong am Anfang und Ende, Wochenstatistik, Runterfahren am Abend. Dazu NSDR (Yoga Nidra), Wim-Hof-Atmung und „normale“ Meditation.

- Stille mit Gongs, geführte Atem-Meditation, NSDR geführt mit Sprachausgabe des iPhones (Web Speech, keine fremden Dateien), Wim Hof in drei Runden mit Atemtakt und Stoppuhr für das Anhalten.
- Wim Hof nur nach Sicherheitsbestätigung: sitzen oder liegen, nie im oder am Wasser, nie beim Fahren.
- Gongs werden im Browser erzeugt (Web Audio). Bildschirm bleibt an (Wake Lock). Bei gesperrtem iPhone laufen Ton und Sprache nicht zuverlässig.
- Runterfahren am Abend: Atmung, dann direkt die Abendfragen.
- Minuten pro Woche auf „Körper“ und im Coach.

### Stufe 4: Geld für die Familie, gebaut in 0.9
Peters Wahl: wenige Töpfe pro Woche, Ausgaben per Sprache und Foto vom Kassenbon, Alltag, feste Kosten, Sparziele, ganze Familie mit Taschengeld, Familieneinkommen dabei. Stufenplan nach Studienlage, angelehnt an Dave Ramseys Baby Steps und die Verbraucherzentrale.

- Töpfe pro Woche, Anzeige als Spanne gegen Ende der Woche (genaue Restbeträge erhöhen laut Studie die Ausgaben).
- Stufen: Überblick und Einnahmen über Ausgaben, Notgroschen (Selbstständige 6 Monate), Konsumschulden weg, Puffer bis 12 Monate, Sparrate automatisch, Vermögensaufbau.
- Peters Frau kommt als zweite Person in den Haushalt. Davor muss jede Abfrage nach `user_id` filtern und die Anmeldung pro Person laufen.
- Kein Bankzugang. CSV-Import der Bank ist eine spätere Option.

### Stufe 5: Menschen und Zeit, gebaut in 0.11
Peters Wahl: Personen aus Einträgen erkennen, letzter Kontakt mit Erinnerung, Familienzeit zählen, Geburtstage, Stunden mit Freunden schätzen, Kreise Familie, Freunde, Team, Netzwerk. Für die Zeit: Wenn-dann-Plan zu jeder Top-Aufgabe, Energie-Bilanz nach Terminen, Ablenkungs-Parkplatz, Liste „Zeit kaufen“. Der Coach schlägt täglich eine kleine Geste vor.

## Was als Nächstes sinnvoll ist

- Zwei Wochen Alltag, dann aus den Rückmeldungen und dem Kompass entscheiden, was nachgeschärft wird.
- Peters Frau als zweite Person: Anmeldung pro Person, jede Abfrage nach `user_id` filtern, Geld auf Haushaltsebene ist vorbereitet.
- Apple Health per Kurzbefehl für Schritte (WHOOP liefert keine).
- Kalender: Blöcke für „Jetzt dran“ und die Energie-Bilanz nach echten Terminen.
- Webhooks von WHOOP statt Abruf alle zwei Stunden.

## Arbeitsweise

- Zweig pro Stufe, Pull Request mit CHANGELOG, Peter mergt. Tests: `npm run typecheck`, `npm run test:unit`, `npm run build && npm run test:e2e` (braucht Postgres auf Port 5433, siehe `playwright.config.ts`). Die Attrappe `tests/e2e/mock-claude.mjs` spielt Claude, WHOOP und Open Food Facts.
- Auf Peters Mac ist `NODE_ENV=production` gesetzt. Deshalb dort `NODE_ENV=development npm ci --include=dev`, sonst fehlen TypeScript und Playwright.
- Aufspielen vom Mac: `bash deploy/deploy.sh life-server vX.Y.Z` (2× Touch ID) oder im Notfall `--build` (3× Touch ID). Die Arbeit macht `deploy/aufspielen.sh` auf dem Server: Sicherung vorher, Update, Warten auf `/api/health`. Zurück nach `--build`: auf dem Server `docker tag life-app:prev life-app:local && docker compose up -d app`.
- Geheimnisse trägt nur Peter auf dem Server ein. Claude liest die `.env` nicht.
- Arbeitet Claude aus einer Cloud-Sitzung, kommt der Code per `git bundle` auf den Mac und von dort zu GitHub, weil die Cloud nicht auf das Repo schreiben darf. Die e2e-Tests laufen in der Cloud mit eigenem Postgres auf Port 5433, auf dem Mac gibt es kein Postgres.

## Sicherung und Wiederherstellung

- Jede Nacht um 3:15 Uhr schreibt `deploy/backup.sh` einen geprüften Dump nach `/opt/life/deploy/backups/life-JJJJ-MM-TT.sql.gz` (30 Tage). Vor jedem Update läuft dieselbe Sicherung.
- Am 1. jedes Monats spielt `deploy/restore-test.sh` den neuesten Dump in eine Wegwerf-Datenbank ein. Von Hand: `bash /opt/life/deploy/restore-test.sh`. Protokoll in `backups/backup.log`.
- `/api/health` liefert 503, wenn die Sicherung älter als 26 Stunden ist oder der Test gescheitert ist.
- **Ernstfall, Datenbank zurückholen** (auf dem Server, ersetzt alle Daten seit dem Dump, deshalb nur nach Rückfrage):
  1. `cd /opt/life/deploy && docker compose stop app`
  2. `bash backup.sh` (Sicherung des kaputten Stands, falls noch etwas zu retten ist)
  3. `docker compose exec -T db psql -U life -d postgres -c 'drop database life' -c 'create database life owner life'`
  4. `gunzip -c backups/life-JJJJ-MM-TT.sql.gz | docker compose exec -T db psql -U life -d life -v ON_ERROR_STOP=1`
  5. `docker compose start app`, dann `/api/health` prüfen.
- Ist der ganze Server weg: in der Hetzner-Konsole aus dem Server-Backup wiederherstellen.

## Bekannte Grenzen

- Neue Namen erreichen Claude beim ersten Mal im Klartext. Abhilfe: Namen vorab unter Einstellungen eintragen.
- WHOOP-Zonen sind eine Näherung für Zone 2 nach Attia.
- Der Zeitplan läuft im App-Prozess. Startet der Container neu, holt Life verpasste Mitteilungen bis zu zwei Stunden später nach. Hängt er länger als fünf Minuten, meldet `/api/health` 503.
- Mitteilungen auf dem iPhone nur für die App vom Home-Bildschirm, ab iOS 16.4.
- Kamera und Wake Lock hängen von der iOS-Version ab. Barcode geht immer auch per Nummer.
