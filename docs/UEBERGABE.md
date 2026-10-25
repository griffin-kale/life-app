# Life – Übergabe und Stand

Diese Datei hält fest, was gebaut ist, warum es so gebaut ist und was als Nächstes kommt. Sie ergänzt `CLAUDE.md` (feste Regeln) und `CHANGELOG.md` (jede Version im Detail). Wer an Life weiterarbeitet, liest zuerst `CLAUDE.md`, dann diese Datei.

Stand: 25. Oktober 2026, Version 0.7.0.

## Worum es geht

Life ist Peters persönliche App für die fünf Konten nach Sahil Bloom: Zeit, Sozial, Mental, Körper, Geld. Ein Eingang für alles (Aktionstaste, Satz, Foto), Claude sortiert, ein Coach meldet sich morgens und abends. Bedient wird Life fast nur auf dem iPhone als Web-App vom Home-Bildschirm. Life gehört der Griffin & Kale GmbH und soll später für Peters Familie und vielleicht als Produkt taugen.

## Was läuft

| Bereich | Stand | Wo im Code |
|---|---|---|
| Erfassen per Text, Mikrofon, Kurzbefehl, Teilen-Menü | läuft seit 0.1 | `app/page.tsx`, `app/api/capture`, `lib/enrich.ts` |
| Einordnen und Priorisieren mit Engpass, „Jetzt dran“ (3), Stapel, Lernen aus Korrekturen | läuft seit 0.3 | `lib/priorisieren.ts`, `app/woche` |
| Anmeldung per Passkey, ersatzweise Passwort und Einmal-Code | 0.5 | `lib/webauthn.ts`, `lib/zweifaktor.ts`, `lib/totp-core.ts` |
| Claude über die Anthropic-API mit Pseudonymisierung | 0.6 | `lib/claude.ts`, `lib/pseudonym.ts` |
| Coach morgens und abends, Warnsignale | 0.6, erweitert in 0.7 | `lib/coach.ts`, `lib/coach-regeln.ts`, `app/coach.tsx` |
| Fragebögen: Morgen, Abend, Woche mit WHO-5 | 0.6 | `lib/fragen.ts`, `app/fragebogen.tsx` |
| Haushalte und mehrere Menschen im Datenmodell | 0.6, sichtbar nur Peter | `lib/db.ts` (`haushalte`, `nutzer`, `user_id`) |
| WHOOP über OAuth | 0.7 | `lib/whoop.ts`, `app/api/whoop` |
| Training wie RP Hypertrophy, für zu Hause | 0.7 | `lib/training.ts`, `app/koerper/training` |
| Essen per Barcode, Foto, Satz | 0.7 | `lib/essen.ts`, `app/koerper/essen.tsx` |
| Mitteilungen aufs iPhone (Web Push) mit Zeitplan | 0.7 | `lib/push.ts`, `lib/zeitplan.ts`, `instrumentation.ts`, `public/sw.js` |

Live unter `https://life.gneuss.xyz`. Server: Hetzner CPX02 in Nürnberg (1 vCPU, 1 GB RAM, 2 GB Swap, Ubuntu 24.04), Docker Compose mit App, Postgres und Caddy.

## Was Peter noch tun muss

1. **Anthropic-Schlüssel** in der Console der Griffin & Kale GmbH anlegen, Ausgabenlimit setzen, Auftragsverarbeitungsvertrag annehmen, Schlüssel in `/opt/life/deploy/.env` als `ANTHROPIC_API_KEY=` eintragen, dann `docker compose up -d --force-recreate app`. Ohne Schlüssel sortiert nichts und der Coach schweigt.
2. **WHOOP-App** auf developer.whoop.com registrieren. Weiterleitung `https://life.gneuss.xyz/api/whoop/callback`, Scopes: offline, read:recovery, read:cycles, read:sleep, read:workout, read:body_measurement. `WHOOP_CLIENT_ID` und `WHOOP_CLIENT_SECRET` in die `.env`, App neu starten, in Life unter Körper „WHOOP verbinden“.
3. **Pull Requests** `feature/fundament` und `feature/koerper` nach `main` mergen, danach Tag `v0.7.0`. Bis dahin läuft auf dem Server der Stand aus dem Zweig (Notweg `deploy.sh --build`).
4. **Mitteilungen einschalten:** Life vom Home-Bildschirm öffnen, Einstellungen, „Mitteilungen einschalten“, „Probe schicken“.
5. **`SETUP_TOKEN` leeren**, sobald alle Geräte eingerichtet sind.
6. Später: ui-ux-pro-max-Skill in den Einstellungen entfernen, alte SSH-Schlüssel auf dem Mac löschen, Schlüssel „Peters Mac“ bei Hetzner entfernen.

## Entscheidungen und Gründe

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

## Fahrplan

### Stufe 3: Ruhe (Meditation)
Peters Wahl: Vorlagen 5, 10 und 20 Minuten, Gong am Anfang und Ende, Wochenstatistik, Runterfahren am Abend. Dazu NSDR (Yoga Nidra), Wim-Hof-Atmung und „normale“ Meditation.

- Stille mit Gongs, geführte Atem-Meditation, NSDR geführt mit Sprachausgabe des iPhones (Web Speech, keine fremden Dateien), Wim Hof in drei Runden mit Atemtakt und Stoppuhr für das Anhalten.
- Wim Hof nur nach Sicherheitsbestätigung: sitzen oder liegen, nie im oder am Wasser, nie beim Fahren.
- Gongs werden im Browser erzeugt (Web Audio). Bildschirm bleibt an (Wake Lock). Bei gesperrtem iPhone laufen Ton und Sprache nicht zuverlässig.
- Runterfahren am Abend: Atmung, dann direkt die Abendfragen.
- Minuten pro Woche auf „Körper“ und im Coach.

### Stufe 4: Geld für die Familie
Peters Wahl: wenige Töpfe pro Woche, Ausgaben per Sprache und Foto vom Kassenbon, Alltag, feste Kosten, Sparziele, ganze Familie mit Taschengeld, Familieneinkommen dabei. Stufenplan nach Studienlage, angelehnt an Dave Ramseys Baby Steps und die Verbraucherzentrale.

- Töpfe pro Woche, Anzeige als Spanne gegen Ende der Woche (genaue Restbeträge erhöhen laut Studie die Ausgaben).
- Stufen: Überblick und Einnahmen über Ausgaben, Notgroschen (Selbstständige 6 Monate), Konsumschulden weg, Puffer bis 12 Monate, Sparrate automatisch, Vermögensaufbau.
- Peters Frau kommt als zweite Person in den Haushalt. Davor muss jede Abfrage nach `user_id` filtern und die Anmeldung pro Person laufen.
- Kein Bankzugang. CSV-Import der Bank ist eine spätere Option.

### Stufe 5: Menschen und Zeit
Peters Wahl: Personen aus Einträgen erkennen, letzter Kontakt mit Erinnerung, Familienzeit zählen, Geburtstage, Stunden mit Freunden schätzen, Kreise Familie, Freunde, Team, Netzwerk. Für die Zeit: Wenn-dann-Plan zu jeder Top-Aufgabe, Energie-Bilanz nach Terminen, Ablenkungs-Parkplatz, Liste „Zeit kaufen“. Der Coach schlägt täglich eine kleine Geste vor.

## Arbeitsweise

- Zweig pro Stufe, Pull Request mit CHANGELOG, Peter mergt. Tests: `npm run typecheck`, `npm run test:unit`, `npm run build && npm run test:e2e` (braucht Postgres auf Port 5433, siehe `playwright.config.ts`). Die Attrappe `tests/e2e/mock-claude.mjs` spielt Claude, WHOOP und Open Food Facts.
- Aufspielen vom Mac: `bash deploy/deploy.sh life-server vX.Y.Z` oder im Notfall `--build`. Jede SSH-Verbindung fragt Touch ID ab.
- Geheimnisse trägt nur Peter auf dem Server ein. Claude liest die `.env` nicht.
- Arbeitet Claude aus einer Cloud-Sitzung, kommt der Code per `git bundle` auf den Mac und von dort zu GitHub, weil die Cloud nicht auf das Repo schreiben darf.

## Bekannte Grenzen

- Neue Namen erreichen Claude beim ersten Mal im Klartext. Abhilfe: Namen vorab unter Einstellungen eintragen.
- WHOOP-Zonen sind eine Näherung für Zone 2 nach Attia.
- Der Zeitplan läuft im App-Prozess. Startet der Container neu, holt Life verpasste Mitteilungen bis zu zwei Stunden später nach.
- Mitteilungen auf dem iPhone nur für die App vom Home-Bildschirm, ab iOS 16.4.
- Kamera und Wake Lock hängen von der iOS-Version ab. Barcode geht immer auch per Nummer.
