#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-audit}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${PROJECT:-eclipcity}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMEOUT_SECONDS="${SSM_COMMAND_TIMEOUT_SECONDS:-900}"

if [[ "${MODE}" != "audit" && "${MODE}" != "stamp" ]]; then
  echo "Usage: run-database-baseline-audit.sh [audit|stamp]" >&2
  exit 2
fi

for command_name in aws base64 jq tr; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
AUDIT_SCRIPT="${SCRIPT_DIR}/audit-database-baseline.py"
if [[ ! -r "${AUDIT_SCRIPT}" ]]; then
  echo "Missing database audit script: ${AUDIT_SCRIPT}" >&2
  exit 1
fi

instance_id="$(
  aws ssm get-parameter \
    --region "${AWS_REGION}" \
    --name "/${PROJECT}/${ENVIRONMENT}/cicd/backend-instance-id" \
    --query Parameter.Value \
    --output text
)"
if [[ ! "${instance_id}" =~ ^i-[0-9a-f]+$ ]]; then
  echo "Backend SSM parameter did not contain a valid EC2 instance ID." >&2
  exit 1
fi

payload="$(base64 <"${AUDIT_SCRIPT}" | tr -d '\n')"
remote_command="set -Eeuo pipefail; audit_path=\$(mktemp /tmp/eclipcity-database-audit.XXXXXX); trap 'rm -f \"\$audit_path\"' EXIT; printf '%s' '${payload}' | base64 --decode >\"\$audit_path\"; cd /opt/eclipcity/backend; release_file=release.env.candidate; if [[ ! -r \"\$release_file\" ]]; then release_file=current.env; fi; docker compose --env-file \"\$release_file\" --file compose.yaml run --rm --no-deps -T migration python - <\"\$audit_path\""
if [[ "${MODE}" == "stamp" ]]; then
  remote_command+=" && docker compose --env-file \"\$release_file\" --file compose.yaml run --rm --no-deps migration alembic stamp 20260717_0001 && docker compose --env-file \"\$release_file\" --file compose.yaml run --rm --no-deps migration alembic current"
fi
ssm_parameters="$(jq -nc --arg command "${remote_command}" '{commands:[$command]}')"

command_id="$(
  aws ssm send-command \
    --region "${AWS_REGION}" \
    --instance-ids "${instance_id}" \
    --document-name AWS-RunShellScript \
    --comment "Eclipcity database baseline ${MODE}" \
    --parameters "${ssm_parameters}" \
    --query Command.CommandId \
    --output text
)"

echo "Started database baseline ${MODE} ${command_id} on ${instance_id}."
started_at="${SECONDS}"

while ((SECONDS - started_at < TIMEOUT_SECONDS)); do
  if ! invocation="$(
    aws ssm get-command-invocation \
      --region "${AWS_REGION}" \
      --command-id "${command_id}" \
      --instance-id "${instance_id}" \
      --output json 2>/dev/null
  )"; then
    sleep 5
    continue
  fi

  status="$(printf '%s' "${invocation}" | jq -r '.Status')"
  case "${status}" in
    Success)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      echo "Database baseline ${MODE} succeeded."
      exit 0
      ;;
    Failed|Cancelled|TimedOut|Cancelling)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      printf '%s' "${invocation}" | jq -r '.StandardErrorContent' >&2
      echo "Database baseline ${MODE} failed with status ${status}." >&2
      exit 1
      ;;
    Pending|InProgress|Delayed)
      sleep 5
      ;;
    *)
      echo "Unexpected SSM command status: ${status}" >&2
      exit 1
      ;;
  esac
done

echo "Database baseline ${MODE} exceeded ${TIMEOUT_SECONDS} seconds." >&2
exit 1
