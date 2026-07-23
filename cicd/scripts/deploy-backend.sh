#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

IMAGE_URI="${1:-}"
RELEASE_ID="${2:-}"
PUBLIC_DOMAIN="${3:-}"
COMPOSE_DIR="/opt/eclipcity/backend"
COMPOSE_FILE="${COMPOSE_DIR}/compose.yaml"
CURRENT_RELEASE="${COMPOSE_DIR}/current.env"
PREVIOUS_RELEASE="${COMPOSE_DIR}/previous.env"
CANDIDATE_RELEASE="${COMPOSE_DIR}/release.env.candidate"
RUNTIME_DIR="/run/eclipcity"
BACKEND_ENV="${RUNTIME_DIR}/backend.env"

secret_json=""
temporary_env=""
registry=""

cleanup() {
  unset secret_json
  if [[ -n "${temporary_env}" ]]; then
    rm -f "${temporary_env}"
  fi
  if [[ -n "${registry}" ]]; then
    docker logout "${registry}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ ! "${IMAGE_URI}" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/.+@sha256:[a-f0-9]{64}$ ]]; then
  echo "Backend image must be an immutable ECR digest URI." >&2
  exit 2
fi

if [[ ! "${RELEASE_ID}" =~ ^[A-Za-z0-9._-]{7,160}$ ]]; then
  echo "Release ID contains unsupported characters." >&2
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

if [[ "${ECLIPCITY_ROLE:-}" != "backend" ]]; then
  echo "Refusing backend deployment on node role ${ECLIPCITY_ROLE:-unknown}." >&2
  exit 1
fi

if [[ -z "${AWS_REGION:-}" || -z "${BACKEND_SECRET_ARN:-}" ]]; then
  echo "Node configuration is missing AWS_REGION or BACKEND_SECRET_ARN." >&2
  exit 1
fi

for command_name in aws curl docker jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

docker compose version >/dev/null

registry="${IMAGE_URI%%/*}"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${registry}" >/dev/null
docker pull "${IMAGE_URI}"

secret_json="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${BACKEND_SECRET_ARN}" \
    --query SecretString \
    --output text
)"

if ! printf '%s' "${secret_json}" | jq -e \
  --arg frontend_url "https://${PUBLIC_DOMAIN}" \
  --arg backend_url "https://${PUBLIC_DOMAIN}/api" \
  --arg google_redirect_uri "https://${PUBLIC_DOMAIN}/api/auth/google/callback" '
  . as $root
  | type == "object"
    and all([
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_DB",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_SSL_MODE",
      "FRONTEND_BASE_URL",
      "BACKEND_PUBLIC_URL",
      "CORS_ORIGINS",
      "SESSION_SECRET_KEY",
      "SESSION_COOKIE_SECURE",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USERNAME",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL",
      "SMTP_USE_TLS"
    ][]; ($root[.] | type == "string" and length > 0))
    and (($root.SESSION_SECRET_KEY | length) >= 32)
    and ($root.POSTGRES_SSL_MODE == "require")
    and ($root.FRONTEND_BASE_URL == $frontend_url)
    and ($root.BACKEND_PUBLIC_URL == $backend_url)
    and ($root.CORS_ORIGINS == $frontend_url)
    and ($root.GOOGLE_REDIRECT_URI == $google_redirect_uri)
    and (($root.SESSION_COOKIE_SECURE | ascii_downcase) == "true")
    and (($root.SMTP_USE_TLS | ascii_downcase) == "true")
' >/dev/null; then
  echo "Backend secret is incomplete or its dev URLs/TLS flags do not match ${PUBLIC_DOMAIN}." >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${RUNTIME_DIR}"
temporary_env="$(mktemp "${RUNTIME_DIR}/backend.env.XXXXXX")"

printf '%s' "${secret_json}" | jq -r '
  def dotenv:
    tostring
    | gsub("\\\\"; "\\\\\\\\")
    | gsub("\""; "\\\"")
    | gsub("\\r"; "\\r")
    | gsub("\\n"; "\\n");
  [
    "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD",
    "POSTGRES_SSL_MODE",
    "FRONTEND_BASE_URL", "BACKEND_PUBLIC_URL", "POST_AUTH_REDIRECT_PATH", "CORS_ORIGINS",
    "SESSION_SECRET_KEY", "SESSION_COOKIE_NAME", "SESSION_COOKIE_MAX_AGE", "SESSION_COOKIE_SECURE",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL",
    "SMTP_FROM_NAME", "SMTP_USE_TLS"
  ] as $allowed
  | to_entries[]
  | select(.key as $key | $allowed | index($key))
  | "\(.key)=\"\(.value | dotenv)\""
' >"${temporary_env}"

chmod 0600 "${temporary_env}"
mv -f "${temporary_env}" "${BACKEND_ENV}"
temporary_env=""
unset secret_json

imds_token="$(
  curl --fail --silent --show-error \
    --request PUT \
    --header "X-aws-ec2-metadata-token-ttl-seconds: 60" \
    http://169.254.169.254/latest/api/token
)"
backend_bind_ip="$(
  curl --fail --silent --show-error \
    --header "X-aws-ec2-metadata-token: ${imds_token}" \
    http://169.254.169.254/latest/meta-data/local-ipv4
)"
unset imds_token

if [[ ! "${backend_bind_ip}" =~ ^10\.20\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "Unexpected backend private IPv4 address: ${backend_bind_ip}" >&2
  exit 1
fi

install -d -o root -g root -m 0755 "${COMPOSE_DIR}"
if [[ -f "${CURRENT_RELEASE}" ]]; then
  cp -f "${CURRENT_RELEASE}" "${PREVIOUS_RELEASE}"
fi

printf 'BACKEND_IMAGE=%s\nBACKEND_BIND_IP=%s\nRELEASE_ID=%s\n' \
  "${IMAGE_URI}" "${backend_bind_ip}" "${RELEASE_ID}" \
  >"${CANDIDATE_RELEASE}"
chmod 0600 "${CANDIDATE_RELEASE}"

compose=(docker compose --env-file "${CANDIDATE_RELEASE}" --file "${COMPOSE_FILE}")
"${compose[@]}" config --quiet

echo "Running Alembic migrations for release ${RELEASE_ID}."
"${compose[@]}" run --rm --no-deps migration

echo "Updating backend container to release ${RELEASE_ID}."
"${compose[@]}" up --detach --no-deps --remove-orphans backend

container_id="$("${compose[@]}" ps --quiet backend)"
if [[ -z "${container_id}" ]]; then
  echo "Backend container was not created." >&2
  exit 1
fi

for attempt in $(seq 1 60); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
  if [[ "${health}" == "healthy" ]]; then
    mv -f "${CANDIDATE_RELEASE}" "${CURRENT_RELEASE}"
    docker image prune --force >/dev/null
    echo "Backend release ${RELEASE_ID} is healthy."
    exit 0
  fi

  if [[ "${health}" == "unhealthy" || "${health}" == "exited" || "${health}" == "dead" ]]; then
    echo "Backend release ${RELEASE_ID} entered state ${health}." >&2
    exit 1
  fi

  sleep 5
done

echo "Backend release ${RELEASE_ID} did not become healthy within 300 seconds." >&2
exit 1
