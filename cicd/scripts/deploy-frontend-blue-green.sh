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
ACTIVE_SLOT_FILE="${COMPOSE_DIR}/active-slot"

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

if [[ "${ECLIPCITY_ROLE:-}" != "frontend" || "${ECLIPCITY_ENVIRONMENT:-}" != "prod" ]]; then
  echo "Refusing production frontend deployment on role/environment ${ECLIPCITY_ROLE:-unknown}/${ECLIPCITY_ENVIRONMENT:-unknown}." >&2
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
if [[ ! -r "${COMPOSE_FILE}" || ! -r "${COMPOSE_TLS_FILE}" || ! -r "${COMPOSE_DIR}/frontend.conf.template" ]]; then
  echo "Production deployment bundle is incomplete." >&2
  exit 1
fi

active_slot=""
if [[ -f "${ACTIVE_SLOT_FILE}" ]]; then
  active_slot="$(<"${ACTIVE_SLOT_FILE}")"
fi
if [[ -n "${active_slot}" && "${active_slot}" != "blue" && "${active_slot}" != "green" ]]; then
  echo "Active frontend slot state is invalid." >&2
  exit 1
fi

if [[ "${active_slot}" == "blue" ]]; then
  candidate_slot="green"
else
  candidate_slot="blue"
fi
candidate_service="frontend-${candidate_slot}"

blue_image="${FRONTEND_IMAGE}"
green_image="${FRONTEND_IMAGE}"
if [[ -f "${CURRENT_RELEASE}" ]]; then
  blue_image="$(sed -n 's/^FRONTEND_BLUE_IMAGE=//p' "${CURRENT_RELEASE}" | tail -n 1)"
  green_image="$(sed -n 's/^FRONTEND_GREEN_IMAGE=//p' "${CURRENT_RELEASE}" | tail -n 1)"
  blue_image="${blue_image:-${FRONTEND_IMAGE}}"
  green_image="${green_image:-${FRONTEND_IMAGE}}"
  cp -f "${CURRENT_RELEASE}" "${PREVIOUS_RELEASE}"
fi

if [[ "${candidate_slot}" == "blue" ]]; then
  blue_image="${FRONTEND_IMAGE}"
else
  green_image="${FRONTEND_IMAGE}"
fi

printf 'FRONTEND_BLUE_IMAGE=%s\nFRONTEND_GREEN_IMAGE=%s\nFRONTEND_ACTIVE_SERVICE=%s\nNGINX_IMAGE=%s\nCERTBOT_IMAGE=%s\nRELEASE_ID=%s\nBACKEND_UPSTREAM=%s\nPUBLIC_DOMAIN=%s\nCERTBOT_EMAIL=%s\n' \
  "${blue_image}" "${green_image}" "${candidate_service}" "${NGINX_IMAGE}" \
  "${CERTBOT_IMAGE}" "${RELEASE_ID}" "${BACKEND_UPSTREAM}" "${PUBLIC_DOMAIN}" \
  "${CERTBOT_EMAIL}" >"${CANDIDATE_RELEASE}"
chmod 0600 "${CANDIDATE_RELEASE}"

base_compose=(docker compose --env-file "${CANDIDATE_RELEASE}" --file "${COMPOSE_FILE}")
tls_compose=(
  docker compose --env-file "${CANDIDATE_RELEASE}"
  --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
)

"${base_compose[@]}" config --quiet
"${tls_compose[@]}" config --quiet

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
  local previous_active previous_service
  local -a previous_compose

  if [[ ! -f "${PREVIOUS_RELEASE}" || -z "${active_slot}" ]]; then
    echo "No previous frontend slot is available for rollback." >&2
    return
  fi

  previous_active="${active_slot}"
  previous_service="frontend-${previous_active}"
  previous_compose=(
    docker compose --env-file "${PREVIOUS_RELEASE}"
    --file "${COMPOSE_FILE}" --file "${COMPOSE_TLS_FILE}"
  )
  echo "Restoring frontend ${previous_active} slot." >&2
  "${previous_compose[@]}" up --detach --no-deps "${previous_service}" nginx certbot || true
}

echo "Starting frontend ${candidate_slot} candidate for release ${RELEASE_ID}."
if ! "${base_compose[@]}" up --detach --no-deps "${candidate_service}"; then
  restore_previous_release
  exit 1
fi

container_id="$("${base_compose[@]}" ps --quiet "${candidate_service}")"
if [[ -z "${container_id}" ]]; then
  echo "Frontend candidate container was not created." >&2
  restore_previous_release
  exit 1
fi

health=""
for _attempt in $(seq 1 60); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
  if [[ "${health}" == "healthy" ]]; then
    break
  fi
  if [[ "${health}" == "unhealthy" || "${health}" == "exited" || "${health}" == "dead" ]]; then
    echo "Frontend candidate entered state ${health}." >&2
    restore_previous_release
    exit 1
  fi
  sleep 5
done

if [[ "${health}" != "healthy" ]]; then
  echo "Frontend candidate did not become healthy within 300 seconds." >&2
  restore_previous_release
  exit 1
fi

if ! certificate_exists "${CANDIDATE_RELEASE}"; then
  echo "Starting HTTP bootstrap for the first production ACME challenge."
  if ! "${base_compose[@]}" up --detach --no-deps nginx; then
    restore_previous_release
    exit 1
  fi

  http_ready="false"
  for _attempt in $(seq 1 60); do
    if curl --noproxy '*' --fail --silent --show-error --max-time 5 \
      http://127.0.0.1/healthz >/dev/null; then
      http_ready="true"
      break
    fi
    sleep 5
  done
  if [[ "${http_ready}" != "true" ]]; then
    echo "HTTP bootstrap did not become ready for the ACME challenge." >&2
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
    echo "Certbot could not issue the production certificate." >&2
    restore_previous_release
    exit 1
  fi
fi

if ! fix_certificate_permissions "${CANDIDATE_RELEASE}"; then
  echo "Could not make the certificate readable by unprivileged nginx." >&2
  restore_previous_release
  exit 1
fi

echo "Switching the stable edge to frontend ${candidate_slot}."
if ! "${tls_compose[@]}" up --detach --no-deps nginx certbot; then
  restore_previous_release
  exit 1
fi

for _attempt in $(seq 1 60); do
  if curl --noproxy '*' --fail --silent --show-error --max-time 10 \
    --resolve "${PUBLIC_DOMAIN}:443:127.0.0.1" "https://${PUBLIC_DOMAIN}/healthz" >/dev/null \
    && curl --noproxy '*' --fail --silent --show-error --max-time 10 \
    --resolve "${PUBLIC_DOMAIN}:443:127.0.0.1" "https://${PUBLIC_DOMAIN}/api/ready" >/dev/null; then
    mv -f "${CANDIDATE_RELEASE}" "${CURRENT_RELEASE}"
    printf '%s\n' "${candidate_slot}" >"${ACTIVE_SLOT_FILE}"
    chmod 0600 "${ACTIVE_SLOT_FILE}"
    if [[ -n "${active_slot}" ]]; then
      docker compose --env-file "${CURRENT_RELEASE}" --file "${COMPOSE_FILE}" \
        stop "frontend-${active_slot}" >/dev/null || true
    fi
    docker image prune --force >/dev/null
    echo "Frontend release ${RELEASE_ID} is active in the ${candidate_slot} slot."
    exit 0
  fi
  sleep 5
done

echo "Production HTTPS checks failed after switching to ${candidate_slot}." >&2
restore_previous_release
exit 1
