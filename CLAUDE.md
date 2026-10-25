# Life – Regeln für die Arbeit am Projekt

Life ist Peters private App: Gedanken, Aufgaben, Zitate, Videos und Bücher festhalten, von Claude einordnen und priorisieren lassen, daraus lernen. Ein Nutzer, Bedienung vor allem auf dem iPhone. Später eine Familienversion.

## Feste Grenzen (nie verhandeln)

1. **Daten bleiben in Deutschland.** Server bei Hetzner (Nürnberg/Falkenstein). Claude nur über Amazon Bedrock mit EU-Profil aus `eu-central-1`. Keine weiteren Dienste, die Einträge sehen.
2. **Keine externen Ressourcen.** Keine Fonts, Skripte, Bilder, Analytics oder CDNs von außen, keine Links nach außen in der Oberfläche (außer der Quelle eines Eintrags, die Peter selbst festgehalten hat). Schriften liegen im Projekt.
3. **Peter und EHRENBEHÖRDE sind getrennt.** Keine EB-Infrastruktur, keine EB-Konten. Farbe für Peter ist Imperial Blue (Pantone 2768 C, `#001D51`). Das EB-Royalblau `#3338CC` kommt hier nie vor.
4. **Geheimnisse nie ins Repo und nie in den Chat.** Schlüssel trägt Peter selbst auf dem Server in `/opt/life/deploy/.env` ein. `.env` ist in `.gitignore`.
5. **Dark Mode ist Standard.**

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

- **Datenbank:** Änderungen nur additiv in `lib/db.ts` (`add column if not exists`). Spalten erst entfernen, wenn eine ältere Version sie nicht mehr braucht, und nie im selben Release.
- **Abruf fremder URLs nur über `lib/safefetch.ts`.** Nie direkt `fetch` mit einer Adresse aus einem Eintrag.
- **Neue offene Endpunkte** (ohne Sitzung) bekommen `begrenzt()` aus `lib/ratelimit.ts` und kommen in `OPEN` in `middleware.ts` nur nach Rückfrage.
- **Claude-Antworten sind unsichere Eingaben.** Immer gegen feste Listen prüfen (siehe `lib/enrich.ts`, `lib/priorisieren.ts`), nie als HTML ausgeben, kein `dangerouslySetInnerHTML`.
- **Abhängigkeiten:** neue nur nach Prüfung (Herkunft, Pflege, Alter, Installationsskripte). `.npmrc` verbietet Installationsskripte.
- **CSP** in `next.config.mjs` nur verschärfen, nie lockern.

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

- Funktionen der alten Tageslage übernehmen (Engpass-Woche, Beirat, 5 Types of Wealth, Kompass), sobald Life zwei Wochen im Alltag läuft.
- YouTube-Transkripte für Wissenseinträge.
- Kalender: Blöcke für „Jetzt dran“ eintragen. Welcher Kalender, ist noch offen.
- Familienversion.
