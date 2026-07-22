#!/bin/sh
set -eu

terminate=0
trap 'terminate=1' INT TERM

while [ "${terminate}" -eq 0 ]; do
  certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --work-dir /tmp/certbot-work \
    --logs-dir /tmp/certbot-logs \
    --quiet \
    --deploy-hook /usr/local/bin/certbot-fix-permissions

  elapsed=0
  while [ "${terminate}" -eq 0 ] && [ "${elapsed}" -lt 43200 ]; do
    sleep 60 &
    wait "$!" || true
    elapsed=$((elapsed + 60))
  done
done
