# Life

Peters App für Gedanken, Aufgaben und Wissen. Festhalten per Text, Diktat oder Kurzbefehl. Claude ordnet jeden Eintrag ein, priorisiert die Aufgaben gegen den Engpass und hält bei Wissen die Kernidee und eine Frage fest.

Läuft komplett in Deutschland auf einem eigenen Hetzner-Server. Claude kommt über Amazon Bedrock mit EU-Profil, aufgerufen in Frankfurt; die Verarbeitung bleibt in EU-Rechenzentren. Life gehört der Griffin & Kale GmbH. Regeln für die Arbeit am Projekt stehen in [CLAUDE.md](CLAUDE.md), alle Versionen in [CHANGELOG.md](CHANGELOG.md).

## Was drin ist

- **Erfassen:** Textfeld mit Mikrofon (wo der Browser es kann) oder Tastatur-Diktat. Auf dem iPhone zusätzlich per Kurzbefehl über Aktionstaste und Teilen-Menü (`POST /api/capture`).
- **Heute:** oben der Engpass, darunter „Jetzt dran“ mit höchstens drei Aufgaben. Jede lässt sich abhaken, auf eine Uhrzeit legen oder mit „Nicht heute“ in die Woche schieben. Beides lässt sich rückgängig machen.
- **Priorisieren:** Claude gibt jeder Aufgabe Ziel, Hebel auf den Engpass (0 bis 3), Aufwand, Frist und Zuständigkeit. Beim ersten Öffnen am Tag sortiert Claude alle offenen Aufgaben gemeinsam in Jetzt, Diese Woche, Delegieren, Geparkt und Streichen vorgeschlagen, mit einer Zeile Begründung. Doppelte Einträge führt Claude zusammen. Neue Aufgaben ordnet Claude gleich ein, ohne die Jetzt-Liste umzuwerfen.
- **Lernen:** Jede Verschiebung von dir landet als Korrektur in der Datenbank. Die letzten 20 gehen beim nächsten Sortieren mit. Was du binnen zwei Minuten rückgängig machst, zählt nicht.
- **Woche:** Ziele mit offenen und erledigten Aufgaben, alle Stapel, Verschieben per Auswahlrad, Streichvorschläge annehmen oder behalten.
- **Einordnen:** Typ (Gedanke, Zitat, Video, Buch, Artikel), Kategorie (Engpass, Entscheidung, Aufgabe, Projekt, Privat, Notiz, Idee, Wissen), Art von Wohlstand nach Sahil Bloom, nächster Schritt. Ideen werden 72 Stunden geparkt.
- **Links:** YouTube-Titel über oEmbed, bei anderen Seiten Titel und Textauszug. Nur öffentliche Adressen werden abgerufen.
- **Logbuch:** Filter nach Typ, Erledigt und Archiviert, Suche.
- **Export:** alles als eine Markdown-Datei (`/api/export`).
- **Anmeldung:** nur per Passkey (Face ID). Einrichten mit einmaligem Code unter `/setup`.
- **Gestaltung:** nach Apples Gestaltungsregeln fürs Web: Schrift folgt der iPhone-Textgröße, Feedback beim Drücken, durchscheinende Leisten mit Scroll-Kante, Zurück-Navigation, Meldungen kommen und gehen auf demselben Weg, Rücksicht auf „Bewegung reduzieren“, „Transparenz reduzieren“ und „Kontrast erhöhen“.

## Aufbau

| Teil | Technik |
|---|---|
| App | Next.js 15, TypeScript, keine externen Skripte oder Schriften (Instrument Serif liegt im Projekt) |
| Datenbank | PostgreSQL 16 im selben Server |
| HTTPS | Caddy, Zertifikat automatisch |
| Claude | `@anthropic-ai/bedrock-sdk`, Modelle `eu.anthropic.claude-haiku-5-5` und `eu.anthropic.claude-sonnet-5-5` |
| Prüfung | GitHub Actions: Typen, Einheitstests, `npm audit`, Build, Playwright-Tests auf iPhone-Breite |
| Auslieferung | Versions-Tag baut ein Paket bei GitHub (ghcr.io, privat), der Server holt es ab |

## Inbetriebnahme

1. Hetzner Cloud: Server **CPX02** oder größer, Ubuntu 24.04, Nürnberg oder Falkenstein, SSH-Schlüssel vom Mac, Backups an.
2. DNS bei Hetzner: A- und AAAA-Eintrag `life.gneuss.xyz` auf die Server-Adressen.
3. Server einrichten:
   ```sh
   scp deploy/setup-server.sh root@SERVER-IP:/root/
   ssh root@SERVER-IP 'bash /root/setup-server.sh life.gneuss.xyz'
   ```
   Das richtet Firewall, Anmeldung nur per Schlüssel, automatische Sicherheitsupdates, Swap und das tägliche Datenbank-Backup ein und erzeugt alle Geheimnisse in `/opt/life/deploy/.env`.
4. AWS: IAM-Benutzer nur mit `bedrock:InvokeModel` für die EU-Profile anlegen. Peter trägt die Schlüssel selbst ein: `ssh root@SERVER-IP`, dann `nano /opt/life/deploy/.env`.
5. Für fertige Pakete von GitHub einmalig auf dem Server: `docker login ghcr.io -u GITHUB-NAME` mit einem Token, das nur `read:packages` darf. In der `.env` `GHCR_IMAGE=ghcr.io/GITHUB-NAME/life-app` setzen.
6. Vom Mac: `bash deploy/deploy.sh SERVER-IP v0.4.0` (oder `--build`, solange es noch kein Paket gibt).
7. Auf dem iPhone `https://life.gneuss.xyz/setup` öffnen, `SETUP_TOKEN` aus der `.env` eingeben, Passkey anlegen. In Safari: Teilen → „Zum Home-Bildschirm“.
8. Kurzbefehl einrichten (Anleitung in der App unter Einstellungen) mit dem `CAPTURE_TOKEN`.

## Updates und Versionen

1. Jede Änderung kommt als Pull Request. GitHub Actions prüft sie, Peter gibt mit „Merge“ frei.
2. Release: Tag setzen, zum Beispiel `git tag -a v0.4.1 -m "…" && git push origin v0.4.1`. GitHub baut das Paket.
3. Aufspielen: `bash deploy/deploy.sh SERVER-IP v0.4.1`. Das Skript wartet, bis `/api/health` antwortet.
4. Zurück: `bash deploy/deploy.sh SERVER-IP v0.4.0`. Datenbankänderungen sind immer nur Ergänzungen, deshalb passt auch eine ältere Version zu den Daten.

## Betrieb

- **Sicherheitsupdates des Systems:** laufen automatisch (unattended-upgrades).
- **Abhängigkeiten:** Dependabot meldet Updates als Pull Request.
- **Datensicherung:** täglich 3:15 Uhr nach `/opt/life/deploy/backups`, 30 Tage, dazu die Hetzner-Backups des ganzen Servers.
- **Lebenszeichen:** `https://life.gneuss.xyz/api/health`
- **Neues Gerät:** `/setup` mit dem `SETUP_TOKEN` öffnen und einen weiteren Passkey anlegen.
- **Handy verloren:** `SESSION_SECRET` in der `.env` ändern und neu starten. Damit sind alle Geräte abgemeldet. Danach den Passkey des verlorenen Geräts in den iCloud-Einstellungen löschen.

## Sicherheit

Geschützt ist: Anmeldung nur per Passkey, Sitzung im `httpOnly`-Cookie, alle Daten hinter der Anmeldung, Kurzbefehl mit eigenem Schlüssel, Begrenzung der Anfragen, strenge Sicherheits-Header (CSP ohne fremde Quellen), Abruf fremder Links ohne Zugriff auf interne Adressen, Claude-Antworten nur gegen feste Listen übernommen, keine Installationsskripte von Abhängigkeiten.

Bekannte Grenzen, bewusst in Kauf genommen:
- Die CSP erlaubt Inline-Skripte, weil Next.js sie ohne Nonces braucht. Fremde Quellen bleiben gesperrt.
- Die Begrenzung zählt im Arbeitsspeicher. Das passt, solange genau ein App-Prozess läuft.
- Eine Sitzung gilt 30 Tage. Einzeln widerrufen geht noch nicht, alle zusammen über `SESSION_SECRET`.
- Das tägliche Datenbank-Backup liegt auf demselben Server. Die Hetzner-Backups liegen getrennt davon.

## Lokal entwickeln

```sh
cp .env.example .env.local   # Werte eintragen, DATABASE_URL auf eine lokale Postgres zeigen lassen
npm ci && npm run dev
npm run typecheck && npm run test:unit
npm run build && npm run test:e2e   # Postgres und Bedrock-Attrappe, siehe playwright.config.ts
```
