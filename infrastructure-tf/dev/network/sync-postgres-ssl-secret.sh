#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-plan}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
BACKEND_SECRET_ARN="${BACKEND_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/backend-UCILpp}"
TARGET_SSL_MODE="require"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  cat <<'EOF'
Usage: sync-postgres-ssl-secret.sh [plan|apply]

plan   Check POSTGRES_SSL_MODE without writing the secret.
apply  Create a new secret version with only POSTGRES_SSL_MODE set to require.

Environment overrides:
  AWS_REGION
  BACKEND_SECRET_ARN
EOF
  exit 0
fi

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be 'plan' or 'apply'." >&2
  exit 2
fi

for command_name in aws jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

secret_value="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${BACKEND_SECRET_ARN}" \
    --query SecretString \
    --output text
)"

if ! printf '%s' "${secret_value}" | jq -e 'type == "object"' >/dev/null; then
  echo "The backend secret must contain a JSON object." >&2
  exit 1
fi

current_ssl_mode="$(printf '%s' "${secret_value}" | jq -r '.POSTGRES_SSL_MODE // "missing"')"
if [[ "${current_ssl_mode}" == "${TARGET_SSL_MODE}" ]]; then
  echo "OK: POSTGRES_SSL_MODE is already require."
  exit 0
fi

echo "UPDATE: POSTGRES_SSL_MODE will change from ${current_ssl_mode} to require."
if [[ "${MODE}" == "plan" ]]; then
  echo "No secret changes were made. Review, then run: $0 apply"
  exit 0
fi

temporary_secret="$(mktemp)"
chmod 0600 "${temporary_secret}"
trap 'rm -f "${temporary_secret}"; unset secret_value current_ssl_mode' EXIT

printf '%s' "${secret_value}" \
  | jq --arg mode "${TARGET_SSL_MODE}" '.POSTGRES_SSL_MODE = $mode' \
  >"${temporary_secret}"

aws secretsmanager put-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "${BACKEND_SECRET_ARN}" \
  --secret-string "file://${temporary_secret}" \
  --query '{ARN:ARN,VersionId:VersionId}' \
  --output table

echo "Created a new backend secret version with only POSTGRES_SSL_MODE changed."
