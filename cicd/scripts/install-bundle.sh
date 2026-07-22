#!/bin/sh
set -eu

role="${1:-}"
target="/target"

case "${role}" in
  backend|frontend)
    ;;
  *)
    echo "Usage: install-bundle backend|frontend" >&2
    exit 2
    ;;
esac

if [ ! -d "${target}" ]; then
  echo "Deployment target volume is not mounted at ${target}." >&2
  exit 1
fi

mkdir -p "${target}/${role}" "${target}/bin"
cp "/bundle/compose/${role}.yaml" "${target}/${role}/compose.yaml"
if [ "${role}" = "frontend" ]; then
  cp "/bundle/compose/frontend-tls.yaml" "${target}/${role}/compose-tls.yaml"
  chmod 0644 "${target}/${role}/compose-tls.yaml"
fi
cp "/bundle/bin/deploy-${role}" "${target}/bin/deploy-${role}"
chmod 0644 "${target}/${role}/compose.yaml"
chmod 0755 "${target}/bin/deploy-${role}"
