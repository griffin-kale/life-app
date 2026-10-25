#!/usr/bin/env bash
# Einmalig auf einem frischen Hetzner-Server (Ubuntu 24.04) als root ausführen:
#   bash setup-server.sh life.deinedomain.de
set -euo pipefail
DOMAIN="${1:?Domain fehlt, z. B. life.deinedomain.de}"
export DEBIAN_FRONTEND=noninteractive

apt-get update && apt-get -y upgrade
apt-get -y install docker.io docker-compose-v2 ufw unattended-upgrades openssl rsync

# 2 GB Auslagerungsspeicher, damit der Build auch auf kleinen Servern durchläuft
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Automatische Sicherheitsupdates
dpkg-reconfigure -f noninteractive unattended-upgrades

# Firewall: nur SSH und Web
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443
ufw --force enable

# SSH nur mit Schlüssel. Eigene Datei mit 00-, damit sie vor Vorgaben von cloud-init gilt
# (bei sshd gewinnt der erste Treffer).
cat > /etc/ssh/sshd_config.d/00-life.conf <<'EOT'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
AllowAgentForwarding no
EOT
mkdir -p /run/sshd && sshd -t
# Ubuntu 24.04 startet sshd über ssh.socket je Verbindung neu, ein Reload ist dann nicht nötig.
systemctl reload ssh 2>/dev/null || true

mkdir -p /opt/life/deploy/backups
ENV=/opt/life/deploy/.env
if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<EOT
DOMAIN=$DOMAIN
PUBLIC_ORIGIN=https://$DOMAIN
# Fertige Pakete von GitHub, z. B. ghcr.io/deinname/life-app. Leer lassen, solange mit --build gebaut wird.
GHCR_IMAGE=
LIFE_VERSION=local
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
SETUP_TOKEN=$(openssl rand -hex 16)
CAPTURE_TOKEN=$(openssl rand -hex 24)
# Claude über die Anthropic-API. Den Schlüssel trägt Peter selbst ein.
ANTHROPIC_API_KEY=
CLAUDE_MODEL_FAST=claude-haiku-5-5
CLAUDE_MODEL=claude-sonnet-5-5
# WHOOP: eigene App auf developer.whoop.com, Weiterleitung https://$DOMAIN/api/whoop/callback
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
# Rückmeldungen als GitHub-Aufgaben: Fine-grained Token, nur Issues auf griffin-kale/life-app
GITHUB_ISSUES_TOKEN=
EOT
fi

# Tägliche Datenbanksicherung um 3:15 Uhr, 30 Tage aufbewahren
cat > /etc/cron.d/life-backup <<'EOT'
15 3 * * * root cd /opt/life/deploy && docker compose exec -T db pg_dump -U life life | gzip > backups/life-$(date +\%F).sql.gz && find backups -name 'life-*.sql.gz' -mtime +30 -delete
EOT
echo "Fertig. Jetzt ANTHROPIC_API_KEY in $ENV eintragen und deploy.sh vom Mac aus starten."
echo "Für fertige Pakete von GitHub einmalig: docker login ghcr.io -u <github-name> (Token nur mit read:packages)."
