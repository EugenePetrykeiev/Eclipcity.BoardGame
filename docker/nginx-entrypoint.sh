#!/bin/sh
set -eu

reload_marker="${NGINX_RELOAD_MARKER:-/var/run/certbot/reload.request}"

/docker-entrypoint.sh nginx -g "daemon off;" &
nginx_pid="$!"

stop_nginx() {
  kill -TERM "${nginx_pid}" 2>/dev/null || true
  wait "${nginx_pid}" 2>/dev/null || true
  exit 0
}

trap stop_nginx INT TERM

marker_mtime=""
while kill -0 "${nginx_pid}" 2>/dev/null; do
  if [ -f "${reload_marker}" ]; then
    current_mtime="$(stat -c %Y "${reload_marker}" 2>/dev/null || true)"
    if [ -n "${marker_mtime}" ] && [ -n "${current_mtime}" ] && [ "${current_mtime}" != "${marker_mtime}" ]; then
      nginx -s reload
    fi
    marker_mtime="${current_mtime}"
  fi
  sleep 30 &
  wait "$!"
done

wait "${nginx_pid}"
