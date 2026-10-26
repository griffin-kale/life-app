#!/usr/bin/env bash
# Update vom Mac aus.
#   bash deploy/deploy.sh <server-ip> v0.4.0   fertiges Paket dieser Version von GitHub holen (Standard)
#   bash deploy/deploy.sh <server-ip> v0.3.0   genauso zurück auf eine ältere Version
#   bash deploy/deploy.sh <server-ip> --build  Notweg: Code hochladen und auf dem Server bauen
set -euo pipefail
# Caddy startet bei jedem Update neu, damit eine geänderte Caddyfile greift (rsync ersetzt die Datei, der alte Mount sähe sie nicht).
HOST="${1:?Server-IP fehlt}"
MODE="${2:?Version wie v0.4.0 oder --build angeben}"
cd "$(dirname "$0")/.."
SSH="ssh -o StrictHostKeyChecking=accept-new root@$HOST"

rsync -az deploy/docker-compose.yml deploy/Caddyfile "root@$HOST:/opt/life/deploy/"

if [ "$MODE" = "--build" ]; then
  rsync -az --delete --exclude node_modules --exclude .next --exclude .git --exclude test-results --exclude playwright-report \
    --exclude 'deploy/.env' --exclude 'deploy/backups' ./ "root@$HOST:/opt/life/"
  $SSH 'cd /opt/life/deploy && sed -i "s/^LIFE_VERSION=.*/LIFE_VERSION=local/" .env && docker compose up -d --build && docker compose up -d --force-recreate caddy && docker image prune -f >/dev/null'
else
  [[ "$MODE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version im Format v1.2.3 angeben"; exit 1; }
  $SSH "cd /opt/life/deploy && sed -i 's/^LIFE_VERSION=.*/LIFE_VERSION=$MODE/' .env && docker compose pull app && docker compose up -d && docker compose up -d --force-recreate caddy && docker image prune -f >/dev/null"
fi

# Erst fertig, wenn die App antwortet
for i in $(seq 1 30); do
  if $SSH 'cd /opt/life/deploy && docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health' 2>/dev/null | grep -q '"ok":true'; then
    echo "Läuft: $MODE"; exit 0
  fi
  sleep 3
done
echo "Die App antwortet nicht. Logs: ssh root@$HOST 'cd /opt/life/deploy && docker compose logs --tail 50 app'"
exit 1
