#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

FRONTEND_IMAGE="${1:-}"
NGINX_IMAGE="${2:-}"
RELEASE_ID="${3:-}"
BACKEND_UPSTREAM="${4:-}"
PUBLIC_DOMAIN="${5:-}"
COMPOSE_DIR="/opt/eclipcity/frontend"
COMPOSE_FILE="${COMPOSE_DIR}/compose.yaml"
CURRENT_RELEASE="${COMPOSE_DIR}/current.env"
PREVIOUS_RELEASE="${COMPOSE_DIR}/previous.env"
CANDIDATE_RELEASE="${COMPOSE_DIR}/release.env.candidate"

registry=""

cleanup() {
  if [[ -n "${registry}" ]]; then
    docker logout "${registry}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

image_pattern='^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/.+@sha256:[a-f0-9]{64}$'
if [[ ! "${FRONTEND_IMAGE}" =~ ${image_pattern} || ! "${NGINX_IMAGE}" =~ ${image_pattern} ]]; then
  echo "Frontend and nginx images must be immutable ECR digest URIs." >&2
  exit 2
fi

if [[ ! "${RELEASE_ID}" =~ ^[A-Za-z0-9._-]{7,160}$ ]]; then
  echo "Release ID contains unsupported characters." >&2
  exit 2
fi

if [[ ! "${BACKEND_UPSTREAM}" =~ ^[A-Za-z0-9.-]+:[0-9]{2,5}$ ]]; then
  echo "Backend upstream must use hostname:port format." >&2
  exit 2
fi

if [[ ! "${PUBLIC_DOMAIN}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Public domain contains unsupported characters." >&2
  exit 2
fi

if [[ ! -r /etc/eclipcity-node.conf ]]; then
  echo "Missing /etc/eclipcity-node.conf." >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/eclipcity-node.conf

if [[ "${ECLIPCITY_ROLE:-}" != "frontend" ]]; then
  echo "Refusing frontend deployment on node role ${ECLIPCITY_ROLE:-unknown}." >&2
  exit 1
fi

for command_name in aws curl docker; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

docker compose version >/dev/null

registry="${FRONTEND_IMAGE%%/*}"
if [[ "${NGINX_IMAGE%%/*}" != "${registry}" ]]; then
  echo "Frontend and nginx images must use the same ECR registry." >&2
  exit 1
fi

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${registry}" >/dev/null
docker pull "${FRONTEND_IMAGE}"
docker pull "${NGINX_IMAGE}"

install -d -o root -g root -m 0755 "${COMPOSE_DIR}"
if [[ -f "${CURRENT_RELEASE}" ]]; then
  cp -f "${CURRENT_RELEASE}" "${PREVIOUS_RELEASE}"
fi

printf 'FRONTEND_IMAGE=%s\nNGINX_IMAGE=%s\nRELEASE_ID=%s\nBACKEND_UPSTREAM=%s\nPUBLIC_DOMAIN=%s\n' \
  "${FRONTEND_IMAGE}" "${NGINX_IMAGE}" "${RELEASE_ID}" "${BACKEND_UPSTREAM}" "${PUBLIC_DOMAIN}" \
  >"${CANDIDATE_RELEASE}"
chmod 0600 "${CANDIDATE_RELEASE}"

wait_for_frontend() {
  local env_file="$1"
  local container_id health
  local -a compose=(docker compose --env-file "${env_file}" --file "${COMPOSE_FILE}")

  container_id="$("${compose[@]}" ps --quiet nginx)"
  [[ -n "${container_id}" ]] || return 1

  for attempt in $(seq 1 60); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
    if [[ "${health}" == "healthy" ]] && curl --fail --silent http://127.0.0.1/healthz >/dev/null; then
      return 0
    fi
    if [[ "${health}" == "unhealthy" || "${health}" == "exited" || "${health}" == "dead" ]]; then
      return 1
    fi
    sleep 5
  done

  return 1
}

restore_previous_release() {
  if [[ -f "${PREVIOUS_RELEASE}" ]]; then
    echo "Restoring previous frontend release." >&2
    docker compose --env-file "${PREVIOUS_RELEASE}" --file "${COMPOSE_FILE}" \
      up --detach --remove-orphans frontend nginx
  else
    echo "No previous frontend release is available for rollback." >&2
  fi
}

compose=(docker compose --env-file "${CANDIDATE_RELEASE}" --file "${COMPOSE_FILE}")
"${compose[@]}" config --quiet
echo "Updating frontend and nginx to release ${RELEASE_ID}."
if ! "${compose[@]}" up --detach --remove-orphans frontend nginx; then
  echo "Docker Compose could not start frontend release ${RELEASE_ID}." >&2
  restore_previous_release
  exit 1
fi

if wait_for_frontend "${CANDIDATE_RELEASE}"; then
  mv -f "${CANDIDATE_RELEASE}" "${CURRENT_RELEASE}"
  docker image prune --force >/dev/null
  echo "Frontend release ${RELEASE_ID} is healthy."
  exit 0
fi

echo "Frontend release ${RELEASE_ID} failed health checks." >&2
restore_previous_release
exit 1
