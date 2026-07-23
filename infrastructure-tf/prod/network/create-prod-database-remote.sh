#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-plan}"
DATABASE_NAME="${2:-userdb_prod}"
DATABASE_OWNER="${3:-}"
BACKEND_CIDR="${4:-10.30.1.0/24}"

if [[ "${MODE}" != "plan" && "${MODE}" != "apply" ]]; then
  echo "Mode must be plan or apply." >&2
  exit 2
fi

if [[ ! "${DATABASE_NAME}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Database name is invalid." >&2
  exit 2
fi

if [[ ! "${DATABASE_OWNER}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Database owner is invalid." >&2
  exit 2
fi

if [[ ! "${BACKEND_CIDR}" =~ ^10\.[0-9]{1,3}\.[0-9]{1,3}\.0/24$ ]]; then
  echo "Backend CIDR must be a private /24 network." >&2
  exit 2
fi

for command_name in psql sed sudo; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

role_exists="$(
  sudo -u postgres psql --no-psqlrc --tuples-only --no-align \
    --dbname postgres \
    --command "SELECT 1 FROM pg_roles WHERE rolname = '${DATABASE_OWNER}';"
)"
if [[ "${role_exists}" != "1" ]]; then
  echo "Existing PostgreSQL role ${DATABASE_OWNER} was not found; refusing to create another login." >&2
  exit 1
fi

database_owner="$(
  sudo -u postgres psql --no-psqlrc --tuples-only --no-align \
    --dbname postgres \
    --command "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '${DATABASE_NAME}';"
)"

hba_file="$(
  sudo -u postgres psql --no-psqlrc --tuples-only --no-align \
    --dbname postgres \
    --command "SHOW hba_file;"
)"
managed_rule="hostssl ${DATABASE_NAME} ${DATABASE_OWNER} ${BACKEND_CIDR} scram-sha-256"

if grep -Fqx "${managed_rule}" "${hba_file}"; then
  hba_action="unchanged"
else
  hba_action="add"
fi

if [[ -z "${database_owner}" ]]; then
  database_action="create"
elif [[ "${database_owner}" == "${DATABASE_OWNER}" ]]; then
  database_action="unchanged"
else
  database_action="change-owner-from-${database_owner}"
fi

echo "Database action: ${database_action}"
echo "pg_hba.conf action: ${hba_action}"

if [[ "${MODE}" == "plan" ]]; then
  echo "Plan only; PostgreSQL was not changed."
  exit 0
fi

hba_backup="${hba_file}.eclipcity-prod.$(date -u +%Y%m%dT%H%M%SZ).bak"
cp --preserve=mode,ownership,timestamps "${hba_file}" "${hba_backup}"

rollback_hba() {
  cp --preserve=mode,ownership,timestamps "${hba_backup}" "${hba_file}"
  sudo -u postgres psql --no-psqlrc --dbname postgres --command "SELECT pg_reload_conf();" >/dev/null || true
}
trap rollback_hba ERR

if [[ "${hba_action}" == "add" ]]; then
  printf '\n# eclipcity production backend via private VPC peering\n%s\n' "${managed_rule}" >>"${hba_file}"
fi

sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --dbname postgres \
  --set=db_name="${DATABASE_NAME}" \
  --set=owner="${DATABASE_OWNER}" <<'SQL'
SELECT format(
  'CREATE DATABASE %I WITH OWNER %I TEMPLATE template0 ENCODING %L',
  :'db_name',
  :'owner',
  'UTF8'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'db_name'
)
\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'owner')
\gexec
SQL

sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --dbname "${DATABASE_NAME}" \
  --set=owner="${DATABASE_OWNER}" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'owner')
\gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'owner')
\gexec
SQL

sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --dbname postgres \
  --command "SELECT pg_reload_conf();" >/dev/null

hba_error_count="$(
  sudo -u postgres psql --no-psqlrc --tuples-only --no-align \
    --dbname postgres \
    --command "SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;"
)"
if [[ "${hba_error_count}" != "0" ]]; then
  echo "PostgreSQL reported invalid pg_hba.conf rules." >&2
  exit 1
fi

verified_owner="$(
  sudo -u postgres psql --no-psqlrc --tuples-only --no-align \
    --dbname postgres \
    --command "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '${DATABASE_NAME}';"
)"
if [[ "${verified_owner}" != "${DATABASE_OWNER}" ]]; then
  echo "Database owner verification failed." >&2
  exit 1
fi

trap - ERR
echo "Production database and private TLS access rule are ready."
