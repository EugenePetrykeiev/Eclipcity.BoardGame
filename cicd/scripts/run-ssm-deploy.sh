#!/usr/bin/env bash
set -Eeuo pipefail

ROLE="${1:-}"
shift || true

AWS_REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${PROJECT:-eclipcity}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMEOUT_SECONDS="${SSM_DEPLOY_TIMEOUT_SECONDS:-900}"

if [[ "${ROLE}" != "backend" && "${ROLE}" != "frontend" ]]; then
  echo "Usage: run-ssm-deploy.sh backend IMAGE BUNDLE_IMAGE RELEASE_ID" >&2
  echo "   or: run-ssm-deploy.sh backend IMAGE NGINX_IMAGE BUNDLE_IMAGE RELEASE_ID" >&2
  echo "   or: run-ssm-deploy.sh frontend FRONTEND_IMAGE NGINX_IMAGE CERTBOT_IMAGE BUNDLE_IMAGE RELEASE_ID" >&2
  exit 2
fi

for command_name in aws jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

parameter_name="/${PROJECT}/${ENVIRONMENT}/cicd/${ROLE}-instance-id"
document_name="${PROJECT}-${ENVIRONMENT}-deploy-${ROLE}"
instance_id="$(
  aws ssm get-parameter \
    --region "${AWS_REGION}" \
    --name "${parameter_name}" \
    --query Parameter.Value \
    --output text
)"

if [[ ! "${instance_id}" =~ ^i-[0-9a-f]+$ ]]; then
  echo "Parameter ${parameter_name} did not contain a valid EC2 instance ID." >&2
  exit 1
fi

if [[ "${ROLE}" == "backend" ]]; then
  image_uri="${1:-}"
  if [[ "$#" -eq 4 ]]; then
    nginx_image_uri="${2:-}"
    bundle_image_uri="${3:-}"
    release_id="${4:-}"
    parameters="$(
      jq -nc \
        --arg image "${image_uri}" \
        --arg nginx "${nginx_image_uri}" \
        --arg bundle "${bundle_image_uri}" \
        --arg release "${release_id}" \
        '{ImageUri:[$image],NginxImageUri:[$nginx],BundleImageUri:[$bundle],ReleaseId:[$release]}'
    )"
  else
    bundle_image_uri="${2:-}"
    release_id="${3:-}"
    parameters="$(
      jq -nc \
        --arg image "${image_uri}" \
        --arg bundle "${bundle_image_uri}" \
        --arg release "${release_id}" \
        '{ImageUri:[$image],BundleImageUri:[$bundle],ReleaseId:[$release]}'
    )"
  fi
else
  frontend_image_uri="${1:-}"
  nginx_image_uri="${2:-}"
  certbot_image_uri="${3:-}"
  bundle_image_uri="${4:-}"
  release_id="${5:-}"
  parameters="$(
    jq -nc \
      --arg frontend "${frontend_image_uri}" \
      --arg nginx "${nginx_image_uri}" \
      --arg certbot "${certbot_image_uri}" \
      --arg bundle "${bundle_image_uri}" \
      --arg release "${release_id}" \
      '{FrontendImageUri:[$frontend],NginxImageUri:[$nginx],CertbotImageUri:[$certbot],BundleImageUri:[$bundle],ReleaseId:[$release]}'
  )"
fi

command_id="$(
  aws ssm send-command \
    --region "${AWS_REGION}" \
    --instance-ids "${instance_id}" \
    --document-name "${document_name}" \
    --comment "GitHub release ${release_id}" \
    --parameters "${parameters}" \
    --query Command.CommandId \
    --output text
)"

echo "Started ${ROLE} deployment command ${command_id} on ${instance_id}."
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
      echo "${ROLE} deployment succeeded."
      exit 0
      ;;
    Failed|Cancelled|TimedOut|Cancelling)
      printf '%s' "${invocation}" | jq -r '.StandardOutputContent'
      printf '%s' "${invocation}" | jq -r '.StandardErrorContent' >&2
      echo "${ROLE} deployment failed with status ${status}." >&2
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

echo "${ROLE} deployment exceeded ${TIMEOUT_SECONDS} seconds." >&2
exit 1
