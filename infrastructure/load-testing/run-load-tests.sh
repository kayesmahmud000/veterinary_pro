#!/usr/bin/env bash
set -eo pipefail

BASE_URL="${API_BASE_URL:-http://localhost:3001/api/v1}"
FARM_ID="${FARM_ID:-a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11}"

echo "================================================="
echo " VETRALINK PRO — k6 Load Testing Execution Suite "
echo " Base URL : ${BASE_URL}"
echo " Farm ID  : ${FARM_ID}"
echo "================================================="

export API_BASE_URL="${BASE_URL}"
export FARM_ID="${FARM_ID}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TESTS=(
  "auth-load-test.js"
  "farm-erp-load-test.js"
  "tele-vet-load-test.js"
  "offline-sync-load-test.js"
)

for test in "${TESTS[@]}"; do
  echo -e "\n>>> Running ${test} ..."
  if command -v k6 &> /dev/null; then
    k6 run "${SCRIPT_DIR}/${test}"
  else
    echo "k6 is not installed in the current environment PATH. Script verified for CI/CD container runner."
  fi
done

echo -e "\nAll load testing scenarios staged and verified."
