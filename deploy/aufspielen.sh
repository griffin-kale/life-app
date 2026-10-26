#!/usr/bin/env bash
# Läuft auf dem Server, gestartet von deploy.sh mit einer einzigen SSH-Verbindung (eine Touch ID).
#   bash /opt/life/deploy/aufspielen.sh v0.17.0   fertiges Paket holen
#   bash /opt/life/deploy/aufspielen.sh --build   Notweg: auf dem Server bauen
set -euo pipefail
MODE="${1:?Version oder --build}"
cd /opt/life/deploy

# Zeitplan für Sicherung und Wiederherstellungstest (ersetzt die Zeile aus setup-server.sh)
cat > /etc/cron.d/life-backup <<'EOT'
15 3 * * * root bash /opt/life/deploy/backup.sh >> /opt/life/deploy/backups/backup.log 2>&1
30 4 1 * * root bash /opt/life/deploy/restore-test.sh >> /opt/life/deploy/backups/backup.log 2>&1
EOT
chmod 644 /etc/cron.d/life-backup

# Vor jedem Update sichern, solange die Datenbank läuft
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  bash backup.sh >> backups/backup.log 2>&1 || { echo "Sicherung vor dem Update fehlgeschlagen, Update abgebrochen. Siehe backups/backup.log"; exit 1; }
fi

if [ "$MODE" = "--build" ]; then
  # Rückweg: das laufende Image bleibt als life-app:prev stehen
  docker image inspect life-app:local >/dev/null 2>&1 && docker tag life-app:local life-app:prev
  sed -i "s/^LIFE_VERSION=.*/LIFE_VERSION=local/" .env
  docker compose pull db caddy
  docker compose up -d --build
else
  [[ "$MODE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version im Format v1.2.3 angeben"; exit 1; }
  sed -i "s/^LIFE_VERSION=.*/LIFE_VERSION=$MODE/" .env
  docker compose pull
  docker compose up -d
fi
# Caddy neu, damit eine geänderte Caddyfile greift (rsync ersetzt die Datei, der alte Mount sähe sie nicht)
docker compose up -d --force-recreate caddy
# Entfernt nur Images ohne Namen. life-app:prev bleibt.
docker image prune -f >/dev/null

# Erst fertig, wenn die App antwortet
for _ in $(seq 1 40); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"ok":true'; then
    echo "Läuft: $MODE"
    # Einmalig testen, ob sich die Sicherung einspielen lässt, falls das noch nie passiert ist
    [ -f backups/status-restore ] || bash restore-test.sh >> backups/backup.log 2>&1 || echo "Hinweis: Wiederherstellungstest fehlgeschlagen, siehe backups/backup.log"
    docker compose images --format '{{.Repository}}:{{.Tag}} {{.ID}}' 2>/dev/null || true
    exit 0
  fi
  sleep 3
done
echo "Die App antwortet nicht. Logs: docker compose logs --tail 50 app"
echo "Zurück zum vorigen Stand: docker tag life-app:prev life-app:local && docker compose up -d app (nach --build) oder deploy.sh mit der vorigen Version"
exit 1
