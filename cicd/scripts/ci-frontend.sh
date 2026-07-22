#!/usr/bin/env bash
set -Eeuo pipefail

npm ci
npm run test:frontend
npm run build
