#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  cat <<'EOF'
Usage: sync-database-secret.sh [plan|apply]

plan   Check whether POSTGRES_HOST needs to change without writing the secret.
apply  Update only POSTGRES_HOST in the existing backend secret.

Environment overrides:
  AWS_REGION
  BACKEND_SECRET_ARN
  DATABASE_PRIVATE_HOSTNAME
EOF
  exit 0
fi

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be 'plan' or 'apply'." >&2
  exit 2
fi

AWS_REGION="${AWS_REGION:-eu-central-1}"
BACKEND_SECRET_ARN="${BACKEND_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/backend-UCILpp}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(dirname -- "${SCRIPT_DIR}")"

for command_name in aws jq terraform; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

if [[ -n "${DATABASE_PRIVATE_HOSTNAME:-}" ]]; then
  target_hostname="${DATABASE_PRIVATE_HOSTNAME}"
else
  target_hostname="$(terraform -chdir="${DEV_DIR}" output -raw database_private_hostname)"
fi

if [[ -z "${target_hostname}" ]]; then
  echo "The database private hostname is empty." >&2
  exit 1
fi

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

current_hostname="$(printf '%s' "${secret_value}" | jq -r '.POSTGRES_HOST // ""')"

if [[ "${current_hostname}" == "${target_hostname}" ]]; then
  echo "OK: POSTGRES_HOST already points to ${target_hostname}."
  exit 0
fi

echo "UPDATE: POSTGRES_HOST will point to ${target_hostname}."

if [[ "${MODE}" == "plan" ]]; then
  echo "No secret changes were made. Review, then run: $0 apply"
  exit 0
fi

temporary_secret="$(mktemp)"
chmod 600 "${temporary_secret}"
trap 'rm -f "${temporary_secret}"; unset secret_value current_hostname' EXIT

printf '%s' "${secret_value}" \
  | jq --arg hostname "${target_hostname}" '.POSTGRES_HOST = $hostname' \
  >"${temporary_secret}"

aws secretsmanager put-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "${BACKEND_SECRET_ARN}" \
  --secret-string "file://${temporary_secret}" \
  --query '{ARN:ARN,VersionId:VersionId}' \
  --output table

echo "Updated only POSTGRES_HOST in the backend secret."

