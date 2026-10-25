#!/usr/bin/env bash
# Einmalig auf einem frischen Hetzner-Server (Ubuntu 24.04) als root ausführen:
#   bash setup-server.sh lage.deinedomain.de
set -euo pipefail
DOMAIN="${1:?Domain fehlt, z. B. lage.deinedomain.de}"
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

# SSH nur mit Schlüssel
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication .*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

mkdir -p /opt/lage/deploy/backups
ENV=/opt/lage/deploy/.env
if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<EOT
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
SETUP_TOKEN=$(openssl rand -hex 16)
CAPTURE_TOKEN=$(openssl rand -hex 24)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
CLAUDE_MODEL_FAST=eu.anthropic.claude-haiku-5-5
CLAUDE_MODEL=eu.anthropic.claude-sonnet-5-5
EOT
fi

# Tägliche Datenbanksicherung um 3:15 Uhr, 30 Tage aufbewahren
cat > /etc/cron.d/lage-backup <<'EOT'
15 3 * * * root cd /opt/lage/deploy && docker compose exec -T db pg_dump -U lage lage | gzip > backups/lage-$(date +\%F).sql.gz && find backups -name 'lage-*.sql.gz' -mtime +30 -delete
EOT
echo "Fertig. Jetzt die AWS-Schlüssel in $ENV eintragen und deploy.sh vom Mac aus starten."
