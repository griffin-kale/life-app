# Life – Regeln für die Arbeit am Projekt

Stand, Entscheidungen und Fahrplan stehen in `docs/UEBERGABE.md`. Die Datei bei jeder Stufe aktuell halten.

Life ist eine App der Griffin & Kale GmbH, gebaut zuerst für Peter persönlich: Gedanken, Aufgaben, Zitate, Videos und Bücher festhalten, von Claude einordnen und priorisieren lassen, daraus lernen. Ein Nutzer, Bedienung vor allem auf dem iPhone. Später eine Familienversion und vielleicht ein Produkt.

## Feste Grenzen (nie verhandeln)

1. **Daten bleiben in Deutschland, Claude bekommt nur Pseudonyme.** Server bei Hetzner (Nürnberg/Falkenstein). Claude läuft über die Anthropic-API (Entscheidung Peter, 25.10.2026, statt Bedrock). Jeder Aufruf geht durch `askJson` in `lib/claude.ts` und damit durch `lib/pseudonym.ts`: Namen von Personen, Firmen und Orten, E-Mails, Telefonnummern und IBANs gehen nur als Platzhalter raus. Gesundheitswerte (Schlaf, Puls, Training) gehen nur zusammengefasst raus, ohne Datum und Uhrzeit. Prompts nennen nur den Wochentag, Fristen relativ („morgen“, „in 3 Tagen“, `fristRelativ` in `lib/zeit.ts`). Kalendertitel laufen durch `schutzTitel` (`lib/kalender-regeln.ts`): Gesundheit, Behörden, Geld werden „Termin privat“, unbekannte Namen nach „mit/bei“ werden „jemandem“. Bons schneidet Peter im Browser zu, bevor sie rausgehen (`app/bon-zuschnitt.tsx`). Nie direkt am Pseudonymisieren vorbei aufrufen. Keine weiteren Dienste, die Einträge sehen. Open Food Facts bekommt nur Barcode-Nummern.
2. **Keine externen Ressourcen.** Keine Fonts, Skripte, Bilder, Analytics oder CDNs von außen, keine Links nach außen in der Oberfläche (außer der Quelle eines Eintrags, die Peter selbst festgehalten hat). Schriften liegen im Projekt.
3. **Life gehört der Griffin & Kale GmbH.** Repo (`griffin-kale/life-app`), Server und Verträge mit Hetzner und Anthropic laufen über die Firma, damit Life später auch als Produkt vertrieben werden kann. Life ist trotzdem keine EHRENBEHÖRDE-Marke: Farbe ist Imperial Blue (Pantone 2768 C, `#001D51`), das EB-Royalblau `#3338CC` kommt nicht vor.
4. **Peters Einträge sind privat.** Sie liegen nur in der Datenbank auf dem Server, nie im Repo, in Tests, Logs, Screenshots im Pull Request oder Fehlermeldungen. Testdaten sind erfunden.
5. **Geheimnisse nie ins Repo und nie in den Chat.** Schlüssel trägt Peter selbst auf dem Server in `/opt/life/deploy/.env` ein. `.env` ist in `.gitignore`.
6. **Dark Mode ist Standard.** Hell und „Wie das iPhone“ wählt man in den Einstellungen (Cookie `life-thema`, `lib/thema.ts`). Farben nur über die Tokens oben in `app/globals.css`, nie als feste Werte in Komponenten. Ausnahme: Verlaufskarten (Coach, Ruhe), die laufende Ruhe-Sitzung und Deep Work bleiben in beiden Modi dunkel.

## Skills, die bei der Arbeit gelten

| Wann | Skill |
|---|---|
| Jede Änderung am Code | `git-workflow-and-versioning` |
| Eingaben, Anmeldung, Datenbank, Links abrufen, Claude-Aufrufe, neue Abhängigkeiten, personenbezogene Daten | `security-and-hardening` |
| CI ändern, Release, Deployment | `ci-cd-and-launch` |
| Oberfläche | `apple-design`, `frontend-design` |
| Immer | `karpathy-guidelines` – mit einer Ausnahme: Sicherheitslücken im angefassten Code werden behoben, auch wenn sie „daneben“ liegen |

## Ablauf jeder Änderung

1. Eigener Zweig von `main`: `feature/…`, `fix/…`, `chore/…`.
2. Kleine Commits, Nachricht im Format `typ: kurz und warum` (feat, fix, refactor, test, docs, chore, ci).
3. Vor jedem Commit: `npm run typecheck`, `npm run test:unit`. Vor dem Pull Request zusätzlich `npm run build && npm run test:e2e`.
4. Pull Request mit Screenshots auf 390 px Breite, Eintrag in `CHANGELOG.md` im selben PR, Version in `package.json` nach SemVer.
5. CI muss grün sein. Peter gibt mit „Merge“ frei.
6. Release: Tag `vX.Y.Z` auf `main`. GitHub baut das Paket. Aufspielen mit `bash deploy/deploy.sh <server-ip> vX.Y.Z`, zurück mit der vorherigen Version.

## Technische Regeln

- **Zeit:** Datum und Uhrzeit in Berlin nur über `lib/zeit.ts` (`heuteBerlin`, `jetztBerlin`, `tagesbeginn`), nie feste Versätze wie `+01:00` und nie `getDay()` oder `getHours()` auf dem Server.
- **Datenbank:** Änderungen nur additiv. Neues kommt ab 0.24 als nummerierter Schritt ans Ende von `MIGRATIONEN` in `lib/migrationen.ts` (eigene Transaktion, `schema_version`, Sperre gegen zwei Instanzen). Schritte nie ändern oder umnummerieren. Das Grundschema in `lib/db.ts` bleibt stehen. Spalten erst entfernen, wenn eine ältere Version sie nicht mehr braucht, und nie im selben Release.
- **Abruf fremder URLs nur über `lib/safefetch.ts`.** Nie direkt `fetch` mit einer Adresse aus einem Eintrag.
- **Zwei Riegel:** Die Middleware prüft die Signatur der Sitzung und die Herkunft (`Origin`) jeder schreibenden Anfrage. Jede API-Route beginnt zusätzlich mit `const { aus, uid } = await mitNutzer(); if (aus) return aus;` (`lib/sitzung.ts`, prüft gegen die Tabelle `sitzungen` und liefert den Menschen der Sitzung). Routen ohne Bezug zu einem Menschen dürfen `ohneSitzung()` nehmen. `tests/unit/riegel.test.ts` prüft das für jede Route.
- **Neue offene Endpunkte** (ohne Sitzung) bekommen `begrenzt()` aus `lib/ratelimit.ts` und kommen als genauer Pfad (kein Präfix) in `OPEN` in `middleware.ts`, nur nach Rückfrage.
- **Fehlermeldungen:** An die Oberfläche und in die Datenbank gehen nur eigene Texte (`oeffentlich()` und `Hinweis` aus `lib/fehler.ts`), nie Texte aus Bibliotheken oder fremden Diensten.
- **Der Coach ändert nur über geprüfte Aktionen** (`lib/coach-aktion.ts`): feste Liste, Life führt aus und bestätigt selbst. Neue Aktionen nur mit Prüfung und Test, nie freie SQL- oder Feldnamen von Claude. Sein Gedächtnis ist nur der Merkzettel (`coach_merken`, ab 0.29), für Peter unter Einstellungen sichtbar und löschbar, dazu das Gespräch der letzten sieben Tage.
- **Modelle:** Haiku (`MODEL_FAST`) zum Einordnen, Sonnet (`MODEL`) als Standard, Opus (`MODEL_DEEP`, `askJsonTief`) nur für entscheidende Momente und wenn Peter im Coach „Expertenmeinung“ drückt (ab 0.29).
- **Claude-Antworten sind unsichere Eingaben.** Immer gegen feste Listen prüfen (siehe `lib/enrich.ts`, `lib/priorisieren.ts`), nie als HTML ausgeben, kein `dangerouslySetInnerHTML`.
- **Abhängigkeiten:** neue nur nach Prüfung (Herkunft, Pflege, Alter, Installationsskripte). `.npmrc` verbietet Installationsskripte.
- **CSP** in `middleware.ts` (pro Anfrage eine Nonce, `'strict-dynamic'`, kein `'unsafe-inline'` für Skripte) nur verschärfen, nie lockern. Freigegebene Ausnahmen (Peter, 25.10.2026): Kamera für Barcode und Essensfoto (`camera=(self)`), `worker-src 'self'` für den Service Worker der Mitteilungen, `blob:` für Bilder und Video. `/sw.js` ist offen, weil iOS die Datei auch nach Ablauf der Sitzung lädt.
- **Feste Fremddienste** (kein Eintragstext, kein Name): WHOOP (`lib/whoop.ts`, OAuth), Open Food Facts (nur Barcode-Nummer), Push-Dienste von Apple und Co. (Inhalt verschlüsselt), GitHub-Issues für Rückmeldungen (Namen als Platzhalter), iCloud CalDAV nur lesend (`lib/caldav.ts`, nur `caldav.icloud.com`, Zugang aus der .env). YouTube oEmbed nur mit der Video-ID (`lib/youtube.ts`, Peter 26.10.2026), ohne Zeitmarken und Tracking-Parameter.
- **Ziele kommen aus der Saison (ab 0.26):** Wer Ziele braucht, nimmt `zieleText(uid)` oder `aktuelleSaison(uid)` aus `lib/saison.ts`, nie direkt die Einstellung `ziele`. Ohne laufende Saison liefert `zieleText` die alte Liste.
- **Musik nur mit Freigabe (ab 0.27):** In `public/musik` liegen nur Aufnahmen, die ausdrücklich gemeinfrei oder CC0 sind, jede mit Quelle und Prüfsumme in `public/musik/QUELLEN.md`. Keine Katalogmusik von Diensten wie Artlist, Spotify oder YouTube. Musik wird nie von außen geladen.
- **Fragen an Peter sind klickbar.** In der App gibt es keine Freitext-Pflichtfelder: Antworten zum Antippen (`lib/fragen.ts`, `app/fragebogen.tsx`), dazu immer „Etwas dazu sagen“ für eigene Worte.
- **Mehrere Menschen (ab 0.24):** Der Mensch kommt immer aus der Sitzung (`uid`), nie als fester Name. Bibliotheksfunktionen bekommen `userId` als Pflichtparameter, ohne Standard. Jede Abfrage filtert nach `user_id` (Geld nach `haushalt_id`). Einstellungen pro Mensch heißen `schluessel:uid` (`proNutzer` in `lib/db.ts`). Haushalt-weit bleiben nur die Namen zum Schützen (`namen`, `namen_auto`), damit alle Namen bei allen pseudonymisiert werden. Passwort, Code, Einrichtungscode und Kurzbefehl gehören `ERSTER_NUTZER`. `tests/unit/riegel.test.ts` verbietet `'peter'` in Routen, e2e prüft zwei Menschen. Neue Tabellen bekommen `user_id` von Anfang an.
- **Anmeldung:** Passkey ist der bevorzugte Weg. Passwort und Code (`lib/zweifaktor.ts`) sind die Ausweichlösung und fliegen raus, sobald Passkeys auf Peters Geräten gehen. Der Einrichtungscode (`SETUP_TOKEN`) gilt nur, solange weder Passkey noch Passwort existieren. Weitere Geräte richtet man angemeldet ein. Gespeicherte Geheimnisse (Code-Schlüssel, WHOOP, Push) sind mit `ENCRYPTION_KEY` verschlüsselt (`zuschliessen`/`aufschliessen` in `lib/passwort-core.ts`), ohne ihn noch mit `SESSION_SECRET`. `SESSION_SECRET` wechseln beendet nur alle Sitzungen. `ENCRYPTION_KEY` nie entfernen oder wechseln.

## Texte in der App

Deutsch, du-Form. Peters Schreibregeln: aktiv mit konkreten Subjekten, kurze und lange Sätze mischen, keine Substantivierungen, keine rhetorischen Fragen, kein „nicht X, sondern Y“, keine leeren Floskeln. Knöpfe sagen, was passiert („Festhalten“, „Nicht heute“).

## Befehle

```sh
npm ci                 # ohne Installationsskripte, siehe .npmrc
npm run dev            # lokal, braucht DATABASE_URL in .env.local
npm run typecheck
npm run test:unit
npm run build && npm run test:e2e   # braucht Postgres, siehe playwright.config.ts
```

## Offene Punkte

- Ausbau in Stufen, jede einzeln live: 1 Fundament (0.6), 2 Körper (0.7) mit WHOOP, Training wie RP für zu Hause, Barcode-Ernährung, 3 Ruhe (0.8) mit NSDR, Wim Hof und Stille, 4 Geld für die Familie (0.9), 5 Menschen und Zeit (0.11), dazu Kompass (0.10). Konzept: Artefakte „Life 1.0 Konzept“ und „Life Bauplan-Fragen“.
- YouTube-Transkripte für Wissenseinträge.
- Kalender: iCloud privat und Familie lesen ist gebaut (0.15). Offen: Arbeitskalender (Microsoft 365) lesend, Blöcke für „Jetzt dran“ eintragen.
- Familienversion, danach Produkt: mehrere Nutzer mit sauber getrennten Daten pro Nutzer (jede Abfrage nach Nutzer filtern), Export und Löschen pro Nutzer.
- Auftragsverarbeitungsverträge mit Hetzner und Anthropic (in der Console annehmen) über Griffin & Kale abschließen.
