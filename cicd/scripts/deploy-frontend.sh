#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

FRONTEND_IMAGE="${1:-}"
NGINX_IMAGE="${2:-}"
CERTBOT_IMAGE="${3:-}"
RELEASE_ID="${4:-}"
BACKEND_UPSTREAM="${5:-}"
PUBLIC_DOMAIN="${6:-}"
CERTBOT_EMAIL="${7:-}"
COMPOSE_DIR="/opt/eclipcity/frontend"
COMPOSE_FILE="${COMPOSE_DIR}/compose.yaml"
COMPOSE_TLS_FILE="${COMPOSE_DIR}/compose-tls.yaml"
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
for image_uri in "${FRONTEND_IMAGE}" "${NGINX_IMAGE}" "${CERTBOT_IMAGE}"; do
  if [[ ! "${image_uri}" =~ ${image_pattern} ]]; then
    echo "Frontend, nginx, and certbot images must be immutable ECR digest URIs." >&2
    exit 2
  fi
done

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

if [[ ! "${CERTBOT_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Certbot contact email is invalid." >&2
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
for image_uri in "${NGINX_IMAGE}" "${CERTBOT_IMAGE}"; do
  if [[ "${image_uri%%/*}" != "${registry}" ]]; then
    echo "Frontend, nginx, and certbot images must use the same ECR registry." >&2
    exit 1
  fi
done

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${registry}" >/dev/null
docker pull "${FRONTEND_IMAGE}"
docker pull "${NGINX_IMAGE}"
docker pull "${CERTBOT_IMAGE}"

install -d -o root -g root -m 0755 "${COMPOSE_DIR}"
if [[ ! -r "${COMPOSE_FILE}" || ! -r "${COMPOSE_TLS_FILE}" ]]; then
  echo "Deployment bundle did not install both frontend Compose files." >&2
  exit 1
fi

if [[ -f "${CURRENT_RELEASE}" ]]; then
  cp -f "${CURRENT_RELEASE}" "${PREVIOUS_RELEASE}"
fi

printf 'FRONTEND_IMAGE=%s\nNGINX_IMAGE=%s\nCERTBOT_IMAGE=%s\nRELEASE_ID=%s\nBACKEND_UPSTREAM=%s\nPUBLIC_DOMAIN=%s\nCERTBOT_EMAIL=%s\n' \
  "${FRONTEND_IMAGE}" "${NGINX_IMAGE}" "${CERTBOT_IMAGE}" "${RELEASE_ID}" \
  "${BACKEND_UPSTREAM}" "${PUBLIC_DOMAIN}" "${CERTBOT_EMAIL}" \
  >"${CANDIDATE_RELEASE}"
chmod 0600 "${CANDIDATE_RELEASE}"

wait_for_http() {
  local env_file="$1"
  local container_id health
  local -a compose=(docker compose --env-file "${env_file}" --file "${COMPOSE_FILE}")

  container_id="$("${compose[@]}" ps --quiet nginx)"
  [[ -n "${container_id}" ]] || return 1

  for _attempt in $(seq 1 60); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
    if [[ "${health}" == "healthy" ]] \
      && curl --noproxy '*' --fail --silent --show-error --max-time 10 http://127.0.0.1/healthz >/dev/null; then
      return 0
    fi
    if [[ "${health}" == "unhealthy" || "${health}" == "exited" || "${health}" == "dead" ]]; then
      return 1
    fi
    sleep 5
  done

  return 1
}

wait_for_https() {
  local env_file="$1"
  local container_id health
  local -a compose=(
    docker compose --env-file "${env_file}"
    --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
  )

  container_id="$("${compose[@]}" ps --quiet nginx)"
  [[ -n "${container_id}" ]] || return 1

  for _attempt in $(seq 1 60); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
    if [[ "${health}" == "healthy" ]] \
      && curl --noproxy '*' --fail --silent --show-error --max-time 10 \
        --resolve "${PUBLIC_DOMAIN}:443:127.0.0.1" "https://${PUBLIC_DOMAIN}/healthz" >/dev/null; then
      return 0
    fi
    if [[ "${health}" == "unhealthy" || "${health}" == "exited" || "${health}" == "dead" ]]; then
      return 1
    fi
    sleep 5
  done

  return 1
}

certificate_exists() {
  local env_file="$1"
  local certificate_directory="/etc/letsencrypt/live/${PUBLIC_DOMAIN}"
  local -a compose=(
    docker compose --env-file "${env_file}"
    --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
  )

  "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
    -c 'test -s "$1/fullchain.pem" && test -s "$1/privkey.pem"' _ "${certificate_directory}" \
    >/dev/null 2>&1
}

fix_certificate_permissions() {
  local env_file="$1"
  local -a compose=(
    docker compose --env-file "${env_file}"
    --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
  )

  "${compose[@]}" run --rm --no-deps \
    --entrypoint /usr/local/bin/certbot-fix-permissions certbot
}

restore_previous_release() {
  local -a compose

  if [[ ! -f "${PREVIOUS_RELEASE}" ]]; then
    echo "No previous frontend release is available for rollback." >&2
    return
  fi

  echo "Restoring previous frontend release." >&2
  if grep -q '^CERTBOT_IMAGE=' "${PREVIOUS_RELEASE}" && certificate_exists "${PREVIOUS_RELEASE}"; then
    compose=(
      docker compose --env-file "${PREVIOUS_RELEASE}"
      --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
    )
    "${compose[@]}" up --detach --remove-orphans frontend nginx certbot
  else
    compose=(docker compose --env-file "${PREVIOUS_RELEASE}" --file "${COMPOSE_FILE}")
    "${compose[@]}" up --detach --remove-orphans frontend nginx
  fi
}

base_compose=(docker compose --env-file "${CANDIDATE_RELEASE}" --file "${COMPOSE_FILE}")
tls_compose=(
  docker compose --env-file "${CANDIDATE_RELEASE}"
  --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
)

"${base_compose[@]}" config --quiet
"${tls_compose[@]}" config --quiet

if ! certificate_exists "${CANDIDATE_RELEASE}"; then
  echo "Starting HTTP bootstrap for the first ACME challenge."
  if ! "${base_compose[@]}" up --detach --remove-orphans frontend nginx || ! wait_for_http "${CANDIDATE_RELEASE}"; then
    echo "HTTP bootstrap failed before certificate issuance." >&2
    restore_previous_release
    exit 1
  fi

  echo "Requesting or recovering the certificate for ${PUBLIC_DOMAIN}."
  if ! "${tls_compose[@]}" run --rm --no-deps --entrypoint certbot certbot \
    certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --work-dir /tmp/certbot-work \
    --logs-dir /tmp/certbot-logs \
    --cert-name "${PUBLIC_DOMAIN}" \
    --domain "${PUBLIC_DOMAIN}" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    --preferred-challenges http \
    --key-type ecdsa; then
    echo "Certbot could not issue the certificate." >&2
    restore_previous_release
    exit 1
  fi
fi

if ! fix_certificate_permissions "${CANDIDATE_RELEASE}"; then
  echo "Could not make the certificate readable by unprivileged nginx." >&2
  restore_previous_release
  exit 1
fi

echo "Updating frontend, nginx, and certbot to release ${RELEASE_ID}."
if ! "${tls_compose[@]}" up --detach --remove-orphans frontend nginx certbot; then
  echo "Docker Compose could not start frontend release ${RELEASE_ID}." >&2
  restore_previous_release
  exit 1
fi

if wait_for_https "${CANDIDATE_RELEASE}"; then
  mv -f "${CANDIDATE_RELEASE}" "${CURRENT_RELEASE}"
  echo "Frontend release ${RELEASE_ID} is healthy over HTTPS."
  exit 0
fi

echo "Frontend release ${RELEASE_ID} failed HTTPS health checks." >&2
restore_previous_release
exit 1
