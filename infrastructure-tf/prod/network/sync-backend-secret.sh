#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

MODE="${1:-plan}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
DEV_SECRET_ARN="${DEV_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/backend-UCILpp}"
PROD_SECRET_ARN="${PROD_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/prod/backend-hfocIf}"
PROD_DOMAIN="${PROD_DOMAIN:-eclipcity.digitee.space}"
PROD_DATABASE_NAME="${PROD_DATABASE_NAME:-userdb_prod}"
PROD_DATABASE_HOST="${PROD_DATABASE_HOST:-postgres.internal.eclipcity.digitee.space}"

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Usage: sync-backend-secret.sh [plan|apply]" >&2
  exit 2
fi

for command_name in aws jq sha256sum; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

dev_secret=""
prod_secret=""
candidate_file=""

cleanup() {
  unset dev_secret prod_secret
  if [[ -n "${candidate_file}" ]]; then
    rm -f "${candidate_file}"
  fi
}
trap cleanup EXIT

dev_secret="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${DEV_SECRET_ARN}" \
    --query SecretString \
    --output text
)"
prod_response="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${PROD_SECRET_ARN}" \
    --output json
)"
prod_secret="$(printf '%s' "${prod_response}" | jq -er '.SecretString')"
prod_version="$(printf '%s' "${prod_response}" | jq -er '.VersionId')"
unset prod_response

if ! printf '%s' "${dev_secret}" | jq -e '
  . as $root
  | type == "object"
    and all([
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD"
    ][]; ($root[.] | type == "string" and length > 0))
' >/dev/null; then
  echo "Dev secret does not contain all required database credentials." >&2
  exit 1
fi

if ! printf '%s' "${prod_secret}" | jq -e '
  . as $root
  | type == "object"
    and all([
      "SESSION_SECRET_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USERNAME",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL"
    ][]; ($root[.] | type == "string" and length > 0))
    and ($root.SESSION_SECRET_KEY | length) >= 32
' >/dev/null; then
  echo "Prod secret is missing prod-only session, Google OAuth, or SMTP/SES credentials; refusing to copy these from dev." >&2
  exit 1
fi

candidate_file="$(mktemp)"
chmod 0600 "${candidate_file}"

jq -n \
  --argjson dev "${dev_secret}" \
  --argjson prod "${prod_secret}" \
  --arg postgres_host "${PROD_DATABASE_HOST}" \
  --arg postgres_db "${PROD_DATABASE_NAME}" \
  --arg frontend_url "https://${PROD_DOMAIN}" \
  --arg backend_url "https://${PROD_DOMAIN}/api" \
  --arg google_redirect_uri "https://${PROD_DOMAIN}/api/auth/google/callback" '
  $prod
  + {
      POSTGRES_HOST: $postgres_host,
      POSTGRES_PORT: $dev.POSTGRES_PORT,
      POSTGRES_DB: $postgres_db,
      POSTGRES_USER: $dev.POSTGRES_USER,
      POSTGRES_PASSWORD: $dev.POSTGRES_PASSWORD,
      POSTGRES_SSL_MODE: "require",
      FRONTEND_BASE_URL: $frontend_url,
      BACKEND_PUBLIC_URL: $backend_url,
      CORS_ORIGINS: $frontend_url,
      SESSION_COOKIE_SECURE: "true",
      GOOGLE_REDIRECT_URI: $google_redirect_uri,
      SMTP_USE_TLS: "true"
    }
' >"${candidate_file}"

changed_keys="$(
  jq -n \
    --argjson current "${prod_secret}" \
    --slurpfile candidate "${candidate_file}" '
    (($current | keys_unsorted) + ($candidate[0] | keys_unsorted))
    | unique
    | map(select($current[.] != $candidate[0][.]))
    | .[]
  ' -r
)"

if [[ -z "${changed_keys}" ]]; then
  echo "Prod backend secret already matches the production contract."
  exit 0
fi

echo "Secret fields that will change (values are intentionally hidden):"
printf '%s\n' "${changed_keys}" | sed 's/^/  - /'

if [[ "${MODE}" == "plan" ]]; then
  echo "Plan only; no secret version was written."
  exit 0
fi

current_version="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${PROD_SECRET_ARN}" \
    --query VersionId \
    --output text
)"
if [[ "${current_version}" != "${prod_version}" ]]; then
  echo "Prod secret changed after planning; rerun to avoid overwriting a concurrent update." >&2
  exit 1
fi

aws secretsmanager put-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "${PROD_SECRET_ARN}" \
  --secret-string "file://${candidate_file}" \
  --query VersionId \
  --output text >/dev/null

echo "Prod backend secret updated. Secrets Manager retained the previous version for rollback."
