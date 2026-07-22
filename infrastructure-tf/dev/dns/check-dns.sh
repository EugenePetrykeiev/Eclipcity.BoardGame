#!/usr/bin/env bash
set -euo pipefail

for command_name in terraform dig; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(dirname -- "${SCRIPT_DIR}")"
DOMAIN_NAME="${DOMAIN_NAME:-dev.eclipcity.digitee.space}"
EXPECTED_IP="$(terraform -chdir="${DEV_DIR}" output -raw frontend_public_ip)"
ACTUAL_IP="$(dig +short A "${DOMAIN_NAME}" | tail -n 1)"

if [[ "${ACTUAL_IP}" != "${EXPECTED_IP}" ]]; then
  echo "DNS mismatch: ${DOMAIN_NAME} resolves to '${ACTUAL_IP:-nothing}', expected '${EXPECTED_IP}'." >&2
  exit 1
fi

echo "DNS is ready: ${DOMAIN_NAME} -> ${ACTUAL_IP}"
