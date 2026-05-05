#!/usr/bin/env bash
# scripts/test/cross-tenant-probe.sh
#
# Production smoke probe for the /api/data cross-tenant escalation
# fence (sec/api-data-tenant-fence-2026-05-05). Runs against any
# deployed environment — provide BASE_URL + a CLIENT_SESSION cookie
# captured from a fresh evco2026 (or any client-role) login.
#
# Expected outcomes when the fence is intact:
#
#   1. ?company_id=mafesa   → HTTP 403, body {"error":"Forbidden"}
#   2. ?cve_cliente=4598    → HTTP 403, body {"error":"Forbidden"}
#   3. ?clave_cliente=4598  → HTTP 403, body {"error":"Forbidden"}  (on a clave-bearing table)
#   4. (no escalation)      → HTTP 200, body has rows scoped to session
#
# A 200 on cases 1-3 means the fence is broken — page Renato IV + Tito
# immediately. A 401 means the session expired; capture a fresh cookie.
#
# Usage:
#   BASE_URL=https://portal.renatozapata.com \
#   CLIENT_SESSION='abc123...' \
#   bash scripts/test/cross-tenant-probe.sh
#
# Run after every prod deploy that touches src/app/api/data/route.ts
# or its tests. Exit 0 when all four checks pass; non-zero otherwise.

set -euo pipefail

BASE_URL="${BASE_URL:-https://portal.renatozapata.com}"
SESSION="${CLIENT_SESSION:-}"

if [ -z "$SESSION" ]; then
  echo "✗ CLIENT_SESSION env var is required (the portal_session cookie value from a client login)"
  echo "  Capture from DevTools → Application → Cookies → portal_session"
  exit 2
fi

PASS=0
FAIL=0

probe() {
  local label="$1"
  local url="$2"
  local expect_status="$3"
  local expect_body_contains="$4"

  local response
  response=$(curl -s -o /tmp/cross-tenant-probe-body.json -w "%{http_code}" \
    -H "Cookie: portal_session=$SESSION" \
    "$url")
  local body
  body=$(cat /tmp/cross-tenant-probe-body.json)

  if [ "$response" = "$expect_status" ] && echo "$body" | grep -q "$expect_body_contains"; then
    echo "✓ $label · $response"
    PASS=$((PASS + 1))
  else
    echo "✗ $label · expected $expect_status containing '$expect_body_contains', got $response: $body"
    FAIL=$((FAIL + 1))
  fi
}

echo "Probing $BASE_URL with client session..."

# 1. Cross-tenant via ?company_id=
probe "company_id escalation refused" \
  "$BASE_URL/api/data?table=traficos&limit=3&company_id=mafesa" \
  "403" "Forbidden"

# 2. Cross-tenant via ?cve_cliente=
probe "cve_cliente escalation refused" \
  "$BASE_URL/api/data?table=traficos&limit=3&cve_cliente=4598" \
  "403" "Forbidden"

# 3. Cross-tenant via ?clave_cliente= (on a clave-bearing table)
probe "clave_cliente escalation refused" \
  "$BASE_URL/api/data?table=aduanet_facturas&limit=3&clave_cliente=4598" \
  "403" "Forbidden"

# 4. Default scoping still works (200, session.companyId applied)
probe "default scoping returns 200" \
  "$BASE_URL/api/data?table=traficos&limit=3" \
  "200" "data"

echo ""
echo "Results: $PASS passed, $FAIL failed"

rm -f /tmp/cross-tenant-probe-body.json

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
