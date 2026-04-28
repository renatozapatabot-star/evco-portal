#!/usr/bin/env bash
# Tenant isolation regression suite.
#
# Closes the loop on the P0 remediation in
# ~/Desktop/audit-tenant-isolation-2026-04-28.md. Run weekly (or as
# part of gsd-verify) to catch any regression that re-introduces
# anon read/write privileges, USING(true) policies on tenant tables,
# or cookie-tenant route patterns.
#
# Exit non-zero on any finding. Wire into ship.sh as a post-deploy
# check OR run as a pre-commit ratchet.
#
# Requires:
#   SUPABASE_ACCESS_TOKEN (Supabase Management API token)
#   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in env
#     OR available via .env.local in the repo root
#   jq, curl, grep, find, node

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load env from .env.local if not already in environment
if [ -f "$ROOT/.env.local" ]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      var="${BASH_REMATCH[1]}"
      if [ -z "${!var:-}" ]; then
        # shellcheck disable=SC2163
        export "$line"
      fi
    fi
  done < "$ROOT/.env.local"
fi

TOKEN="${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN required (Supabase Management API)}"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY required}"
URL="${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL required}"
REF="$(echo "$URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')"

q() {
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "https://api.supabase.com/v1/projects/$REF/database/query" \
    -d "{\"query\": $(jq -Rs . <<<"$1")}"
}

failures=0
fail() { echo "  FAIL: $1"; failures=$((failures+1)); }
pass() { echo "  PASS: $1"; }

echo "== Check 1: tenant tables with anon SELECT grant =="
out=$(q "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND EXISTS(SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=c.relname
                  AND column_name IN ('company_id','clave_cliente','tenant_id','cve_cliente','client_id'))" \
   | jq -r '.[] | .relname' || true)
if [ -z "$out" ]; then
  pass "no tenant table grants anon SELECT"
else
  fail "$(echo "$out" | wc -l | tr -d ' ') tenant tables grant anon SELECT:"
  echo "$out" | sed 's/^/    /'
fi

echo
echo "== Check 2: USING(true) read policies on tenant tables targeting anon/PUBLIC =="
out=$(q "SELECT c.relname || '::' || p.polname as match FROM pg_policy p
   JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND (pg_get_expr(p.polqual,p.polrelid)='true' OR pg_get_expr(p.polqual,p.polrelid) IS NULL)
     AND (p.polcmd='r' OR p.polcmd='*')
     AND EXISTS(SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=c.relname
                  AND column_name IN ('company_id','clave_cliente','tenant_id','cve_cliente'))
     AND (NOT EXISTS (SELECT 1 FROM unnest(p.polroles) r WHERE r > 0)
          OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname = 'anon'))" \
   | jq -r '.[] | .match' || true)
if [ -z "$out" ]; then
  pass "no permissive read policies on tenant tables target PUBLIC/anon"
else
  fail "$(echo "$out" | wc -l | tr -d ' ') permissive read policies on tenant tables:"
  echo "$out" | sed 's/^/    /'
fi

echo
echo "== Check 3: anon write privileges anywhere in public =="
out=$(q "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
     AND (has_table_privilege('anon', c.oid, 'INSERT')
          OR has_table_privilege('anon', c.oid, 'UPDATE')
          OR has_table_privilege('anon', c.oid, 'DELETE'))" \
   | jq -r '.[] | .relname' || true)
if [ -z "$out" ]; then
  pass "no anon write privileges in public schema"
else
  fail "$(echo "$out" | wc -l | tr -d ' ') tables grant anon write:"
  echo "$out" | sed 's/^/    /'
fi

echo
echo "== Check 4: routes reading ANY tenant identifier cookie outside resolveTenantScope =="
# Catches every tenant-scoped cookie name observed across the codebase as
# of 2026-04-28: company_id, company_clave, company_name, company_rfc,
# clave_cliente, tenant_id, cve_cliente, org_id. If a future PR introduces
# a new cookie that carries tenant identity, add it here.
#
# Two layers of safety reduce false positives:
#   - File must NOT use `resolveTenantScope` (the canonical helper).
#   - File must NOT have an explicit `session.role === 'client'` branch
#     that forces session.companyId for client role (the legacy
#     view-as-safe pattern).
#
# Result: only files that read a tenant cookie AND use it without
# either fence are flagged. Audit-only — does not modify code.
cd "$ROOT"
TENANT_COOKIE_NAMES='company_id|company_clave|company_name|company_rfc|clave_cliente|tenant_id|cve_cliente|org_id'
violations=$(grep -rlE "(request|req)\.cookies\.get\(['\"](${TENANT_COOKIE_NAMES})['\"]\)|cookies\(\)\.get\(['\"](${TENANT_COOKIE_NAMES})['\"]\)" src/app/api 2>/dev/null \
  | grep -v __tests__ | grep -v .test. \
  | xargs grep -L "resolveTenantScope" 2>/dev/null \
  | xargs grep -LE "session\.role[[:space:]]*===[[:space:]]*['\"]client['\"]" 2>/dev/null || true)
# Whitelist: routes whose cookie read is intentional (sets the cookie
# itself, or reads dead-code variable). Audited 2026-04-28.
ALLOW_LIST=(
  "src/app/api/auth/view-as/route.ts"   # admin-only; sets these cookies in POST, reads in DELETE
  "src/app/api/data/route.ts"           # cookieClave is dead-code; URL params drive filtering
)
for allowed in "${ALLOW_LIST[@]}"; do
  violations=$(echo "$violations" | grep -v "^${allowed}$" || true)
done
violations=$(echo "$violations" | grep -v "^[[:space:]]*$" || true)
if [ -z "$violations" ]; then
  pass "no API routes read tenant-id cookies for tenant filter (outside helper or role-branch)"
else
  fail "$(echo "$violations" | wc -l | tr -d ' ') API routes reading tenant cookies without fence:"
  echo "$violations" | sed 's/^/    /'
fi

echo
echo "== Check 5: live anon-key probe — tenant tables reject the bundled key =="
fence_failures=0
for tbl in tenants partidas globalpc_facturas oca_database compliance_events globalpc_partidas; do
  rc=$(curl -s -o /dev/null -w "%{http_code}" "$URL/rest/v1/$tbl?limit=1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
  if [ "$rc" = "401" ] || [ "$rc" = "403" ] || [ "$rc" = "404" ]; then
    pass "anon GET /rest/v1/$tbl → $rc (denied)"
  elif [ "$rc" = "200" ] || [ "$rc" = "206" ]; then
    fail "anon GET /rest/v1/$tbl → $rc (LEAKING — should be 401/403/404)"
    fence_failures=$((fence_failures+1))
  else
    echo "  WARN: anon GET /rest/v1/$tbl → $rc (unexpected status)"
  fi
done

echo
echo "== Check 6: silent SERVICE_ROLE → ANON downgrade pattern =="
downgrade=$(grep -rln "SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY" src/ 2>/dev/null | grep -v __tests__ | grep -v .test. || true)
if [ -z "$downgrade" ]; then
  pass "no silent service-role → anon downgrade in src/"
else
  fail "silent service-role downgrade present in:"
  echo "$downgrade" | sed 's/^/    /'
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "TENANT ISOLATION REGRESSION — $failures check(s) failed"
  exit 1
fi
echo "ALL CHECKS PASSED"
