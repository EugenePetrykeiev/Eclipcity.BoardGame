#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-plan}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
DATABASE_INSTANCE_ID="${DATABASE_INSTANCE_ID:-i-02bf5a28818374a1c}"
DATABASE_NAME="${DATABASE_NAME:-userdb}"
DATABASE_USER="${DATABASE_USER:-giant_adm}"
BACKEND_CIDR="${BACKEND_CIDR:-10.20.1.0/24}"
DATABASE_HOSTNAME="${DATABASE_HOSTNAME:-postgres.internal.dev.eclipcity.digitee.space}"
TIMEOUT_SECONDS="${SSM_COMMAND_TIMEOUT_SECONDS:-900}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  cat <<'EOF'
Usage: configure-postgres-tls.sh [plan|apply]

plan   Audit the PostgreSQL TLS/HBA state without changing it.
apply  Back up configuration, enable TLS, add the backend hostssl rule, restart,
       and verify a local TLS connection. Automatic rollback runs on failure.

Environment overrides:
  AWS_REGION
  DATABASE_INSTANCE_ID
  DATABASE_NAME
  DATABASE_USER
  BACKEND_CIDR
  DATABASE_HOSTNAME
  SSM_COMMAND_TIMEOUT_SECONDS
EOF
  exit 0
fi

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be plan or apply." >&2
  exit 2
fi

for command_name in aws base64 jq tr; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! "${DATABASE_INSTANCE_ID}" =~ ^i-[0-9a-f]+$ ]]; then
  echo "DATABASE_INSTANCE_ID is invalid." >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_SCRIPT="${SCRIPT_DIR}/configure-postgres-tls-remote.sh"
if [[ ! -r "${REMOTE_SCRIPT}" ]]; then
  echo "Missing remote script: ${REMOTE_SCRIPT}" >&2
  exit 1
fi

payload="$(base64 <"${REMOTE_SCRIPT}" | tr -d '\n')"
remote_command="script_path=\$(mktemp /tmp/eclipcity-postgres-tls.XXXXXX); trap 'rm -f \"\$script_path\"' EXIT; printf '%s' '${payload}' | base64 --decode >\"\$script_path\"; chmod 0700 \"\$script_path\"; \"\$script_path\" '${MODE}' '${DATABASE_NAME}' '${DATABASE_USER}' '${BACKEND_CIDR}' '${DATABASE_HOSTNAME}'"
parameters="$(jq -nc --arg command "${remote_command}" '{commands:[$command]}')"

command_id="$(
  aws ssm send-command \
    --region "${AWS_REGION}" \
    --instance-ids "${DATABASE_INSTANCE_ID}" \
    --document-name AWS-RunShellScript \
    --comment "Eclipcity PostgreSQL TLS ${MODE}" \
    --parameters "${parameters}" \
    --query Command.CommandId \
    --output text
)"

echo "Started PostgreSQL TLS ${MODE} command ${command_id}."
started_at="${SECONDS}"

while ((SECONDS - started_at < TIMEOUT_SECONDS)); do
  if ! invocation="$(
    aws ssm get-command-invocation \
      --region "${AWS_REGION}" \
      --command-id "${command_id}" \
      --instance-id "${DATABASE_INSTANCE_ID}" \
      --output json 2>/dev/null
  )"; then
    sleep 5
    continue
  fi

  command_status="$(printf '%s' "${invocation}" | jq -r '.Status')"
  case "${command_status}" in
    Success)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      echo "PostgreSQL TLS ${MODE} succeeded."
      exit 0
      ;;
    Failed|Cancelled|TimedOut|Cancelling)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      printf '%s' "${invocation}" | jq -r '.StandardErrorContent' >&2
      echo "PostgreSQL TLS ${MODE} failed with status ${command_status}." >&2
      exit 1
      ;;
    Pending|InProgress|Delayed)
      sleep 5
      ;;
    *)
      echo "Unexpected SSM command status: ${command_status}" >&2
      exit 1
      ;;
  esac
done

echo "PostgreSQL TLS ${MODE} exceeded ${TIMEOUT_SECONDS} seconds." >&2
exit 1
