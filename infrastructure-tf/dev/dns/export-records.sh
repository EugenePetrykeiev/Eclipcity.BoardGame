#!/usr/bin/env bash
set -euo pipefail

for command_name in terraform jq; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(dirname -- "${SCRIPT_DIR}")"

terraform -chdir="${DEV_DIR}" output -json dns_records \
  | jq -r '["TYPE", "NAME", "TTL", "VALUE"], (.[] | [.type, .name, (.ttl | tostring), .value]) | @tsv'
