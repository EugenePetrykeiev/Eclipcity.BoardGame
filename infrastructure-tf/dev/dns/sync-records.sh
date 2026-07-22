#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  cat <<'EOF'
Usage: sync-records.sh [plan|apply]

plan   Compare Terraform DNS outputs with adm.tools without changing records.
apply  Create or update only records below dev.eclipcity.digitee.space.

Environment overrides:
  AWS_REGION
  ADMTOOLS_SECRET_ARN
  ADMTOOLS_ZONE_NAME
  ADMTOOLS_DOMAIN_ID
  MANAGED_DOMAIN_NAME
  DNS_RECORDS_FILE       Read desired records from a JSON file instead of Terraform.
EOF
  exit 0
fi

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be 'plan' or 'apply'." >&2
  exit 2
fi

AWS_REGION="${AWS_REGION:-eu-central-1}"
ADMTOOLS_SECRET_ARN="${ADMTOOLS_SECRET_ARN:-arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/dns-PfFhVn}"
ADMTOOLS_ZONE_NAME="${ADMTOOLS_ZONE_NAME:-digitee.space}"
ADMTOOLS_DOMAIN_ID="${ADMTOOLS_DOMAIN_ID:-1579290}"
MANAGED_DOMAIN_NAME="${MANAGED_DOMAIN_NAME:-dev.eclipcity.digitee.space}"
ADMTOOLS_API_BASE="https://adm.tools/action/dns"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(dirname -- "${SCRIPT_DIR}")"

for command_name in aws curl jq terraform; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

api_post() {
  local endpoint="$1"
  local payload="${2:-}"
  local response

  if [[ -n "${payload}" ]]; then
    if ! response="$(
      curl --silent --show-error --fail-with-body \
        --request POST \
        "${ADMTOOLS_API_BASE}/${endpoint}/" \
        --header "Authorization: Bearer ${ADMTOOLS_TOKEN}" \
        --header "Accept: application/json" \
        --header "Content-Type: application/json" \
        --data "${payload}"
    )"; then
      echo "adm.tools request failed: ${endpoint}" >&2
      return 1
    fi
  else
    if ! response="$(
      curl --silent --show-error --fail-with-body \
        --request POST \
        "${ADMTOOLS_API_BASE}/${endpoint}/" \
        --header "Authorization: Bearer ${ADMTOOLS_TOKEN}" \
        --header "Accept: application/json" \
        --header "Content-Type: application/json"
    )"; then
      echo "adm.tools request failed: ${endpoint}" >&2
      return 1
    fi
  fi

  if ! printf '%s' "${response}" | jq -e 'type == "object" and .result == true' >/dev/null; then
    echo "adm.tools rejected request: ${endpoint}" >&2
    printf '%s' "${response}" | jq -c '{result, messages}' >&2 || true
    return 1
  fi

  printf '%s' "${response}"
}

secret_value="$(
  aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${ADMTOOLS_SECRET_ARN}" \
    --query SecretString \
    --output text
)"

if admtools_token="$(
  printf '%s' "${secret_value}" \
    | jq -er 'if type == "object" then (.adm_api // .token // .api_token // empty) elif type == "string" then . else empty end' 2>/dev/null
)"; then
  ADMTOOLS_TOKEN="${admtools_token}"
else
  ADMTOOLS_TOKEN="${secret_value}"
fi

unset admtools_token secret_value
trap 'unset ADMTOOLS_TOKEN' EXIT

if [[ -z "${ADMTOOLS_TOKEN}" ]]; then
  echo "adm.tools token is empty in ${ADMTOOLS_SECRET_ARN}." >&2
  exit 1
fi

zones_response="$(api_post "list")"
discovered_domain_id="$(
  printf '%s' "${zones_response}" \
    | jq -er --arg zone "${ADMTOOLS_ZONE_NAME}" '.response.list[$zone].domain_id | tostring'
)"

if [[ "${discovered_domain_id}" != "${ADMTOOLS_DOMAIN_ID}" ]]; then
  echo "adm.tools domain ID mismatch: discovered ${discovered_domain_id}, expected ${ADMTOOLS_DOMAIN_ID}." >&2
  exit 1
fi

if [[ -n "${DNS_RECORDS_FILE:-}" ]]; then
  desired_records="$(jq -c '.' "${DNS_RECORDS_FILE}")"
else
  desired_records="$(terraform -chdir="${DEV_DIR}" output -json dns_records)"
fi

if ! printf '%s' "${desired_records}" | jq -e '
  type == "array"
  and all(.[]; (.name | type == "string") and (.type | type == "string") and (.value | type == "string"))
' >/dev/null; then
  echo "Desired DNS records are not a valid Terraform DNS manifest." >&2
  exit 1
fi

records_payload="$(jq -nc --arg domain_id "${discovered_domain_id}" '{domain_id:$domain_id}')"
records_response="$(api_post "records_list" "${records_payload}")"
current_records="$(printf '%s' "${records_response}" | jq -c '.response.list // []')"

create_count=0
update_count=0
noop_count=0

while IFS= read -r desired_record; do
  fqdn="$(printf '%s' "${desired_record}" | jq -er '.name')"
  record_type="$(printf '%s' "${desired_record}" | jq -er '.type | ascii_upcase')"
  record_value="$(printf '%s' "${desired_record}" | jq -er '.value')"

  if [[ "${fqdn}" != "${MANAGED_DOMAIN_NAME}" && "${fqdn}" != *."${MANAGED_DOMAIN_NAME}" ]]; then
    echo "Refusing to manage record outside ${MANAGED_DOMAIN_NAME}: ${fqdn}" >&2
    exit 1
  fi

  if [[ "${fqdn}" == "${ADMTOOLS_ZONE_NAME}" ]]; then
    relative_name="@"
  elif [[ "${fqdn}" == *."${ADMTOOLS_ZONE_NAME}" ]]; then
    relative_name="${fqdn%.${ADMTOOLS_ZONE_NAME}}"
  else
    echo "Record does not belong to adm.tools zone ${ADMTOOLS_ZONE_NAME}: ${fqdn}" >&2
    exit 1
  fi

  priority=0
  record_data="${record_value}"
  if [[ "${record_type}" == "MX" ]]; then
    priority="${record_value%% *}"
    record_data="${record_value#* }"
    if [[ ! "${priority}" =~ ^[0-9]+$ || "${record_data}" == "${record_value}" ]]; then
      echo "Invalid MX value for ${fqdn}; expected '<priority> <host>'." >&2
      exit 1
    fi
  fi

  matches="$(
    printf '%s' "${current_records}" \
      | jq -c --arg name "${relative_name}" --arg type "${record_type}" \
        '[.[] | select(.record == $name and (.type | ascii_upcase) == $type)]'
  )"
  match_count="$(printf '%s' "${matches}" | jq -r 'length')"

  cname_conflict_count="$(
    printf '%s' "${current_records}" \
      | jq -r --arg name "${relative_name}" --arg type "${record_type}" '
          [.[] | select(
            .record == $name
            and (.type | ascii_upcase) != $type
            and (((.type | ascii_upcase) == "CNAME") or $type == "CNAME")
          )] | length
        '
  )"

  if [[ "${cname_conflict_count}" -gt 0 ]]; then
    echo "Refusing to create a DNS-invalid CNAME conflict at ${fqdn}." >&2
    exit 1
  fi

  if [[ "${match_count}" -gt 1 ]]; then
    echo "Refusing to choose between duplicate ${record_type} records at ${fqdn}." >&2
    exit 1
  fi

  if [[ "${match_count}" -eq 0 ]]; then
    printf 'CREATE %-5s %s -> %s\n' "${record_type}" "${fqdn}" "${record_value}"
    create_count=$((create_count + 1))

    if [[ "${MODE}" == "apply" ]]; then
      add_payload="$(
        jq -nc \
          --arg domain_id "${discovered_domain_id}" \
          --arg type "${record_type}" \
          --arg record "${relative_name}" \
          --arg data "${record_data}" \
          --argjson priority "${priority}" \
          '{domain_id:$domain_id,type:$type,record:$record,data:$data,priority:$priority}'
      )"
      api_post "record_add" "${add_payload}" >/dev/null
    fi

    continue
  fi

  current_id="$(printf '%s' "${matches}" | jq -er '.[0].id | tostring')"
  current_data="$(printf '%s' "${matches}" | jq -r '.[0].data // ""')"
  current_priority="$(printf '%s' "${matches}" | jq -r '.[0].prioritet // .[0].priority // 0 | tonumber')"

  if [[ "${current_data}" == "${record_data}" && "${current_priority}" -eq "${priority}" ]]; then
    printf 'OK     %-5s %s\n' "${record_type}" "${fqdn}"
    noop_count=$((noop_count + 1))
    continue
  fi

  printf 'UPDATE %-5s %s: %s -> %s\n' "${record_type}" "${fqdn}" "${current_data}" "${record_value}"
  update_count=$((update_count + 1))

  if [[ "${MODE}" == "apply" ]]; then
    edit_payload="$(
      jq -nc \
        --arg subdomain_id "${current_id}" \
        --arg data "${record_data}" \
        --argjson priority "${priority}" \
        '{subdomain_id:$subdomain_id,data:$data,priority:$priority}'
    )"
    api_post "record_edit" "${edit_payload}" >/dev/null
  fi
done < <(printf '%s' "${desired_records}" | jq -c '.[]')

printf '\nSummary: create=%d update=%d unchanged=%d mode=%s\n' \
  "${create_count}" "${update_count}" "${noop_count}" "${MODE}"

if [[ "${MODE}" == "plan" && $((create_count + update_count)) -gt 0 ]]; then
  echo "Review the actions, then run: $0 apply"
fi
