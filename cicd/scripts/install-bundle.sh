#!/bin/sh
set -eu

role="${1:-}"
strategy="${2:-rolling}"
target="/target"

case "${role}" in
  backend|frontend)
    ;;
  *)
    echo "Usage: install-bundle backend|frontend" >&2
    exit 2
    ;;
esac

case "${strategy}" in
  rolling|blue-green)
    ;;
  *)
    echo "Usage: install-bundle backend|frontend [rolling|blue-green]" >&2
    exit 2
    ;;
esac

if [ ! -d "${target}" ]; then
  echo "Deployment target volume is not mounted at ${target}." >&2
  exit 1
fi

mkdir -p "${target}/${role}" "${target}/bin"
compose_source="/bundle/compose/${role}.yaml"
if [ "${strategy}" = "blue-green" ]; then
  compose_source="/bundle/compose/${role}-blue-green.yaml"
fi
cp "${compose_source}" "${target}/${role}/compose.yaml"
if [ "${role}" = "frontend" ]; then
  cp "/bundle/compose/frontend-tls.yaml" "${target}/${role}/compose-tls.yaml"
  cp "/bundle/nginx/frontend.conf.template" "${target}/${role}/frontend.conf.template"
  chmod 0644 "${target}/${role}/compose-tls.yaml"
  chmod 0644 "${target}/${role}/frontend.conf.template"
else
  cp "/bundle/nginx/backend-router.conf.template" "${target}/${role}/backend-router.conf.template"
  chmod 0644 "${target}/${role}/backend-router.conf.template"
fi
script_source="/bundle/bin/deploy-${role}"
if [ "${strategy}" = "blue-green" ]; then
  script_source="/bundle/bin/deploy-${role}-blue-green"
fi
cp "${script_source}" "${target}/bin/deploy-${role}"
chmod 0644 "${target}/${role}/compose.yaml"
chmod 0755 "${target}/bin/deploy-${role}"
