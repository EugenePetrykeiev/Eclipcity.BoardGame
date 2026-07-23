#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-plan}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
DATABASE_INSTANCE_ID="${DATABASE_INSTANCE_ID:-i-02bf5a28818374a1c}"
DEV_SECRET_ARN="${DEV_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/backend-UCILpp}"
DATABASE_NAME="${DATABASE_NAME:-userdb_prod}"
BACKEND_CIDR="${BACKEND_CIDR:-10.30.1.0/24}"
TIMEOUT_SECONDS="${SSM_TIMEOUT_SECONDS:-600}"

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Usage: create-prod-database.sh [plan|apply]" >&2
  exit 2
fi

for command_name in aws base64 jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_SCRIPT="${SCRIPT_DIR}/create-prod-database-remote.sh"

database_owner="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${DEV_SECRET_ARN}" \
    --query SecretString \
    --output text \
    | jq -er '.POSTGRES_USER | select(type == "string" and length > 0)'
)"

if [[ ! "${database_owner}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "POSTGRES_USER in the dev secret is not a valid PostgreSQL role." >&2
  exit 1
fi

script_base64="$(base64 <"${REMOTE_SCRIPT}" | tr -d '\n')"
commands="$(
  jq -nc \
    --arg script "${script_base64}" \
    --arg mode "${MODE}" \
    --arg database "${DATABASE_NAME}" \
    --arg owner "${database_owner}" \
    --arg cidr "${BACKEND_CIDR}" '
    {
      commands: [
        "set -Eeuo pipefail",
        "temporary_script=$(mktemp)",
        "trap '\''rm -f \"$temporary_script\"'\'' EXIT",
        ("printf %s " + ($script | @sh) + " | base64 --decode >\"$temporary_script\""),
        "chmod 0700 \"$temporary_script\"",
        ("\"$temporary_script\" " + ($mode | @sh) + " " + ($database | @sh) + " " + ($owner | @sh) + " " + ($cidr | @sh))
      ]
    }'
)"

command_id="$(
  aws ssm send-command \
    --region "${AWS_REGION}" \
    --instance-ids "${DATABASE_INSTANCE_ID}" \
    --document-name AWS-RunShellScript \
    --comment "Eclipcity prod database ${MODE}" \
    --parameters "${commands}" \
    --query Command.CommandId \
    --output text
)"

started_at="${SECONDS}"
while ((SECONDS - started_at < TIMEOUT_SECONDS)); do
  if ! invocation="$(
    aws ssm get-command-invocation \
      --region "${AWS_REGION}" \
      --command-id "${command_id}" \
      --instance-id "${DATABASE_INSTANCE_ID}" \
      --output json 2>/dev/null
  )"; then
    sleep 3
    continue
  fi

  status="$(printf '%s' "${invocation}" | jq -r '.Status')"
  case "${status}" in
    Success)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      exit 0
      ;;
    Failed|Cancelled|TimedOut|Cancelling)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      printf '%s' "${invocation}" | jq -r '.StandardErrorContent' >&2
      exit 1
      ;;
    Pending|InProgress|Delayed)
      sleep 3
      ;;
    *)
      echo "Unexpected SSM command status: ${status}" >&2
      exit 1
      ;;
  esac
done

echo "Database SSM command exceeded ${TIMEOUT_SECONDS} seconds." >&2
exit 1
