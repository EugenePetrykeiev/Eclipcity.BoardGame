#!/bin/sh
set -eu

certificate_root="/etc/letsencrypt"
reload_marker="/var/run/certbot/reload.request"
nginx_group="${NGINX_CERTIFICATE_GROUP:-101}"

for directory in "${certificate_root}" "${certificate_root}/live" "${certificate_root}/archive"; do
  if [ -d "${directory}" ]; then
    chmod 0755 "${directory}"
  fi
done

for directory in "${certificate_root}/live" "${certificate_root}/archive"; do
  if [ -d "${directory}" ]; then
    find "${directory}" -mindepth 1 -type d -exec chgrp "${nginx_group}" {} +
    find "${directory}" -mindepth 1 -type d -exec chmod 0750 {} +
    find "${directory}" -type f -exec chgrp "${nginx_group}" {} +
    find "${directory}" -type f -exec chmod 0640 {} +
  fi
done

install -d -m 0755 "$(dirname "${reload_marker}")"
touch "${reload_marker}"
chmod 0644 "${reload_marker}"
