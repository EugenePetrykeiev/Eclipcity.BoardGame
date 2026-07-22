#!/usr/bin/env bash
set -Eeuo pipefail

python_bin="${PYTHON_BIN:-}"
if [[ -z "${python_bin}" ]]; then
  python_bin="$(command -v python || command -v python3)"
fi

if [[ -z "${python_bin}" ]]; then
  echo "Python 3 is required." >&2
  exit 1
fi

venv_dir="$(mktemp -d "${TMPDIR:-/tmp}/eclipcity-backend-ci.XXXXXX")"
trap 'rm -rf "${venv_dir}"' EXIT

"${python_bin}" -m venv "${venv_dir}"
"${venv_dir}/bin/python" -m pip install \
  --disable-pip-version-check \
  -r src/backend/requirements.txt

export DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:5432/eclipcity_test"
export FRONTEND_BASE_URL="http://127.0.0.1:8080"
export SESSION_SECRET_KEY="test-secret-key-with-at-least-32-characters"

"${venv_dir}/bin/python" -m unittest discover -s tests/backend -p 'test_*.py'
