#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-central-1}"
SECRET_ID="${SECRET_ID:-eclipcity/prod/backend}"
OUTPUT_FILE="${OUTPUT_FILE:-/opt/eclipcity/env/backend.env}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root so the output remains root-owned." >&2
  exit 1
fi

for command_name in aws jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

output_directory="$(dirname "${OUTPUT_FILE}")"
install -d -o root -g root -m 700 "${output_directory}"

temporary_file="$(mktemp "${output_directory}/backend.env.XXXXXX")"
trap 'rm -f "${temporary_file}"' EXIT
chmod 600 "${temporary_file}"

secret_json="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${SECRET_ID}" \
    --query SecretString \
    --output text
)"

printf '%s' "${secret_json}" | jq -e '
  type == "object"
  and (.POSTGRES_HOST | type == "string" and length > 0)
  and (.POSTGRES_DB | type == "string" and length > 0)
  and (.POSTGRES_USER | type == "string" and length > 0)
  and (.POSTGRES_PASSWORD | type == "string" and length > 0)
  and (.FRONTEND_BASE_URL | type == "string" and length > 0)
  and (.BACKEND_PUBLIC_URL | type == "string" and length > 0)
  and (.SESSION_SECRET_KEY | type == "string" and length >= 32)
  and (.GOOGLE_CLIENT_ID | type == "string" and length > 0)
  and (.GOOGLE_CLIENT_SECRET | type == "string" and length > 0)
  and (.SMTP_HOST | type == "string" and length > 0)
  and (.SMTP_USERNAME | type == "string" and length > 0)
  and (.SMTP_PASSWORD | type == "string" and length > 0)
  and (.SMTP_FROM_EMAIL | type == "string" and length > 0)
' >/dev/null

printf '%s' "${secret_json}" | jq -r '
  to_entries
  | sort_by(.key)[]
  | select(.value != null)
  | "\(.key)=\(.value | tostring | @json)"
' > "${temporary_file}"

unset secret_json
chown root:root "${temporary_file}"
chmod 600 "${temporary_file}"
mv -f "${temporary_file}" "${OUTPUT_FILE}"
trap - EXIT

echo "Backend environment written to ${OUTPUT_FILE}."
