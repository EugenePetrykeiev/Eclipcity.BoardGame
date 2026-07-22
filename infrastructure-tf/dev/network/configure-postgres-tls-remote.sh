#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-plan}"
DATABASE_NAME="${2:-userdb}"
DATABASE_USER="${3:-giant_adm}"
BACKEND_CIDR="${4:-10.20.1.0/24}"
DATABASE_HOSTNAME="${5:-postgres.internal.dev.eclipcity.digitee.space}"

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be plan or apply." >&2
  exit 2
fi

if [[ ! "${DATABASE_NAME}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Database name contains unsupported characters." >&2
  exit 2
fi

if [[ ! "${DATABASE_USER}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Database user contains unsupported characters." >&2
  exit 2
fi

if [[ ! "${BACKEND_CIDR}" =~ ^10\.20\.[0-9]{1,3}\.0/24$ ]]; then
  echo "Backend CIDR must be a dev /24 subnet." >&2
  exit 2
fi

if [[ ! "${DATABASE_HOSTNAME}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Database hostname contains unsupported characters." >&2
  exit 2
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must run as root through SSM." >&2
  exit 1
fi

for command_name in awk basename chmod chown cmp cp date grep hostname install mktemp mv openssl pg_isready psql readlink rm seq sleep sudo systemctl timeout xargs; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

POSTGRES_SERVICE="postgresql"
if ! systemctl is-active --quiet "${POSTGRES_SERVICE}"; then
  echo "PostgreSQL service is not active before the change." >&2
  exit 1
fi

PGDATA="$(sudo -iu postgres psql -X -A -t -c 'SHOW data_directory' | xargs)"
HBA_FILE="$(sudo -iu postgres psql -X -A -t -c 'SHOW hba_file' | xargs)"
CONFIG_FILE="$(sudo -iu postgres psql -X -A -t -c 'SHOW config_file' | xargs)"
PRIVATE_IP="$(hostname -I | awk '{print $1}')"
TLS_CONFIG="${PGDATA}/eclipcity-tls.conf"
CERTIFICATE_FILE="${PGDATA}/server.crt"
PRIVATE_KEY_FILE="${PGDATA}/server.key"
HBA_RULE="hostssl ${DATABASE_NAME} ${DATABASE_USER} ${BACKEND_CIDR} scram-sha-256"
LEGACY_HBA_RULE="host ${DATABASE_NAME} ${DATABASE_USER} 95.91.245.200/32 scram-sha-256"
INCLUDE_RULE="include_if_exists = 'eclipcity-tls.conf'"

if [[ "${HBA_FILE}" != "${PGDATA}/pg_hba.conf" || "${CONFIG_FILE}" != "${PGDATA}/postgresql.conf" ]]; then
  echo "PostgreSQL configuration paths are outside the expected data directory." >&2
  exit 1
fi

if [[ ! "${PRIVATE_IP}" =~ ^172\.31\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "Unexpected database private IPv4 address: ${PRIVATE_IP}" >&2
  exit 1
fi

if [[ "$(sudo -iu postgres psql -X -A -t -c "SELECT count(*) FROM pg_database WHERE datname = '${DATABASE_NAME}'")" != "1" ]]; then
  echo "Expected database does not exist: ${DATABASE_NAME}" >&2
  exit 1
fi

if [[ "$(sudo -iu postgres psql -X -A -t -c "SELECT count(*) FROM pg_roles WHERE rolname = '${DATABASE_USER}'")" != "1" ]]; then
  echo "Expected database role does not exist: ${DATABASE_USER}" >&2
  exit 1
fi

current_ssl="$(sudo -iu postgres psql -X -A -t -c 'SHOW ssl' | xargs)"
if grep -Fxq "${HBA_RULE}" "${HBA_FILE}"; then
  hba_state="present"
else
  hba_state="missing"
fi
if grep -Fxq "${LEGACY_HBA_RULE}" "${HBA_FILE}"; then
  legacy_hba_state="present"
else
  legacy_hba_state="absent"
fi

echo "PostgreSQL service: ${POSTGRES_SERVICE}"
echo "PostgreSQL data directory: ${PGDATA}"
echo "PostgreSQL SSL: ${current_ssl}"
echo "Managed hostssl rule: ${hba_state}"
echo "Legacy public HBA rule: ${legacy_hba_state}"
echo "Certificate files present: $(test -s "${CERTIFICATE_FILE}" && test -s "${PRIVATE_KEY_FILE}" && echo yes || echo no)"

if [[ "${MODE}" == "plan" ]]; then
  if [[ "${current_ssl}" == "on" && "${hba_state}" == "present" \
    && "${legacy_hba_state}" == "absent" \
    && -s "${CERTIFICATE_FILE}" && -s "${PRIVATE_KEY_FILE}" ]]; then
    echo "PLAN: PostgreSQL TLS and the managed hostssl rule are already present."
  else
    echo "PLAN: enable TLSv1.2+, install a certificate for ${DATABASE_HOSTNAME}, and authorize ${BACKEND_CIDR}."
  fi
  echo "No PostgreSQL files were changed."
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${PGDATA}/eclipcity-config-backups/${timestamp}"
backup_ready=0

rollback() {
  local exit_code="$?"
  trap - ERR
  set +e

  if [[ "${backup_ready}" -eq 1 ]]; then
    echo "ERROR: restoring PostgreSQL configuration from ${BACKUP_DIR}." >&2
    cp -a "${BACKUP_DIR}/postgresql.conf" "${CONFIG_FILE}"
    cp -a "${BACKUP_DIR}/pg_hba.conf" "${HBA_FILE}"

    for filename in eclipcity-tls.conf server.crt server.key; do
      if [[ -e "${BACKUP_DIR}/${filename}" ]]; then
        cp -a "${BACKUP_DIR}/${filename}" "${PGDATA}/${filename}"
      else
        rm -f "${PGDATA:?}/${filename}"
      fi
    done

    systemctl restart "${POSTGRES_SERVICE}"
  fi

  exit "${exit_code}"
}
trap rollback ERR

install -d -o root -g root -m 0700 "${BACKUP_DIR}"
cp -a "${CONFIG_FILE}" "${BACKUP_DIR}/postgresql.conf"
cp -a "${HBA_FILE}" "${BACKUP_DIR}/pg_hba.conf"
for source_file in "${TLS_CONFIG}" "${CERTIFICATE_FILE}" "${PRIVATE_KEY_FILE}"; do
  if [[ -e "${source_file}" ]]; then
    cp -a "${source_file}" "${BACKUP_DIR}/$(basename "${source_file}")"
  fi
done
backup_ready=1

generate_certificate() {
  local temporary_directory
  temporary_directory="$(mktemp -d)"
  openssl req \
    -new \
    -newkey rsa:3072 \
    -x509 \
    -sha256 \
    -days 397 \
    -nodes \
    -subj "/CN=${DATABASE_HOSTNAME}" \
    -addext "subjectAltName=DNS:${DATABASE_HOSTNAME},IP:${PRIVATE_IP}" \
    -keyout "${temporary_directory}/server.key" \
    -out "${temporary_directory}/server.crt"

  install -o postgres -g postgres -m 0600 "${temporary_directory}/server.key" "${PRIVATE_KEY_FILE}"
  install -o postgres -g postgres -m 0644 "${temporary_directory}/server.crt" "${CERTIFICATE_FILE}"
  rm -rf "${temporary_directory}"
}

if [[ -e "${CERTIFICATE_FILE}" || -e "${PRIVATE_KEY_FILE}" ]]; then
  if [[ ! -s "${CERTIFICATE_FILE}" || ! -s "${PRIVATE_KEY_FILE}" ]]; then
    echo "Only one of the PostgreSQL certificate files exists; refusing to overwrite it." >&2
    false
  fi

  if ! openssl x509 -in "${CERTIFICATE_FILE}" -noout -ext subjectAltName \
    | grep -Fq "DNS:${DATABASE_HOSTNAME}"; then
    echo "Existing PostgreSQL certificate does not contain the expected DNS SAN." >&2
    false
  fi

  certificate_public_key="$(mktemp)"
  private_key_public_key="$(mktemp)"
  openssl x509 -in "${CERTIFICATE_FILE}" -noout -pubkey >"${certificate_public_key}"
  openssl pkey -in "${PRIVATE_KEY_FILE}" -pubout >"${private_key_public_key}"
  if ! cmp --silent "${certificate_public_key}" "${private_key_public_key}"; then
    echo "Existing PostgreSQL certificate and private key do not match." >&2
    rm -f "${certificate_public_key}" "${private_key_public_key}"
    false
  fi
  rm -f "${certificate_public_key}" "${private_key_public_key}"

  if ! openssl x509 -in "${CERTIFICATE_FILE}" -noout -checkend 2592000 >/dev/null; then
    echo "Rotating PostgreSQL certificate because it expires within 30 days."
    generate_certificate
  fi
else
  generate_certificate
fi

temporary_tls_config="$(mktemp "${PGDATA}/.eclipcity-tls.conf.XXXXXX")"
cat >"${temporary_tls_config}" <<'EOF'
# Managed by infrastructure-tf/dev/network/configure-postgres-tls.sh
ssl = on
ssl_min_protocol_version = 'TLSv1.2'
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
EOF
chown postgres:postgres "${temporary_tls_config}"
chmod 0644 "${temporary_tls_config}"
mv -f "${temporary_tls_config}" "${TLS_CONFIG}"

if ! grep -Fxq "${INCLUDE_RULE}" "${CONFIG_FILE}"; then
  printf '\n# Eclipcity managed TLS settings\n%s\n' "${INCLUDE_RULE}" >>"${CONFIG_FILE}"
fi

if ! grep -Fxq "${HBA_RULE}" "${HBA_FILE}"; then
  printf '\n# Eclipcity backend over private VPC peering\n%s\n' "${HBA_RULE}" >>"${HBA_FILE}"
fi

if grep -Fxq "${LEGACY_HBA_RULE}" "${HBA_FILE}"; then
  temporary_hba="$(mktemp "${PGDATA}/.pg_hba.conf.XXXXXX")"
  awk -v legacy_rule="${LEGACY_HBA_RULE}" '$0 != legacy_rule { print }' \
    "${HBA_FILE}" >"${temporary_hba}"
  install -o postgres -g postgres -m 0600 "${temporary_hba}" "${HBA_FILE}"
  rm -f "${temporary_hba}"
fi

postgres_main_pid="$(systemctl show --property MainPID --value "${POSTGRES_SERVICE}")"
if [[ ! "${postgres_main_pid}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Could not determine the active PostgreSQL process ID." >&2
  false
fi

postgres_binary="$(readlink -f "/proc/${postgres_main_pid}/exe")"
if [[ ! -x "${postgres_binary}" ]]; then
  echo "PostgreSQL server binary is not executable: ${postgres_binary}" >&2
  false
fi

if [[ "$(sudo -iu postgres "${postgres_binary}" -D "${PGDATA}" -C ssl)" != "on" ]]; then
  echo "PostgreSQL did not parse ssl=on from the updated configuration." >&2
  false
fi

systemctl restart "${POSTGRES_SERVICE}"

for _attempt in $(seq 1 60); do
  if sudo -iu postgres pg_isready --quiet; then
    break
  fi
  sleep 1
done

if ! sudo -iu postgres pg_isready --quiet; then
  echo "PostgreSQL did not become ready after restart." >&2
  false
fi

tls_handshake="$(
  timeout 15 openssl s_client \
    -starttls postgres \
    -connect 127.0.0.1:5432 \
    -servername "${DATABASE_HOSTNAME}" \
    -brief \
    </dev/null 2>&1 || true
)"
tls_protocol="$(printf '%s\n' "${tls_handshake}" | awk -F': ' '/Protocol version:/ {print $2; exit}')"
if [[ ! "${tls_protocol}" =~ ^TLSv1\.[23]$ ]]; then
  echo "PostgreSQL local TLS handshake failed." >&2
  printf '%s\n' "${tls_handshake}" >&2
  false
fi

configured_fingerprint="$(openssl x509 -in "${CERTIFICATE_FILE}" -noout -fingerprint -sha256)"
served_fingerprint="$(
  timeout 15 openssl s_client \
    -starttls postgres \
    -connect 127.0.0.1:5432 \
    -servername "${DATABASE_HOSTNAME}" \
    -showcerts \
    </dev/null 2>/dev/null \
    | openssl x509 -noout -fingerprint -sha256
)"
if [[ "${served_fingerprint}" != "${configured_fingerprint}" ]]; then
  echo "PostgreSQL served a certificate other than the configured certificate." >&2
  false
fi

if [[ "$(sudo -iu postgres psql -X -A -t -c 'SHOW ssl' | xargs)" != "on" ]]; then
  echo "PostgreSQL SHOW ssl did not return on after restart." >&2
  false
fi

hba_error_count="$(
  sudo -iu postgres psql -X -A -t -c \
    "SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL" \
    | xargs
)"
if [[ "${hba_error_count}" != "0" ]]; then
  echo "PostgreSQL reports an invalid pg_hba.conf rule after restart:" >&2
  sudo -iu postgres psql -X -A -t -F '|' -c \
    "SELECT line_number, error FROM pg_hba_file_rules WHERE error IS NOT NULL" >&2
  false
fi

trap - ERR
backup_ready=0
echo "APPLIED: PostgreSQL TLS is enabled and the backend hostssl rule is active."
echo "Backup: ${BACKUP_DIR}"
echo "Local TLS protocol: ${tls_protocol}"
echo "Served certificate: ${served_fingerprint}"
