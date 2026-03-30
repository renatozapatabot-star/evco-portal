#!/bin/bash
# ============================================================================
# CRUZ Verification Suite — gsd-verify.sh
# Runs automatically after every /gsd:execute-phase and before every deploy.
# Zero failures required. Warnings reviewed but non-blocking.
# ============================================================================

set -euo pipefail

FAILURES=0
WARNINGS=0

pass()  { echo "  ✅ PASS: $1"; }
fail()  { echo "  ❌ FAIL: $1"; FAILURES=$((FAILURES + 1)); }
warn()  { echo "  ⚠️  WARN: $1"; WARNINGS=$((WARNINGS + 1)); }
header() { echo ""; echo "[$1]"; }

echo "=== CRUZ Verification Suite ==="
echo "    $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "    Project: CRUZ — Cross-Border Intelligence"
echo "    Patente: 3596 · Aduana: 240"

# --------------------------------------------------------------------------
# 1. TypeScript Strict
# --------------------------------------------------------------------------
header "TypeScript"
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript strict — zero errors"
else
  fail "TypeScript errors found — run 'npm run typecheck' for details"
fi

# --------------------------------------------------------------------------
# 2. ESLint
# --------------------------------------------------------------------------
header "ESLint"
if npm run lint --silent 2>/dev/null; then
  pass "ESLint — zero errors"
else
  fail "ESLint errors found — run 'npm run lint' for details"
fi

# --------------------------------------------------------------------------
# 3. Build
# --------------------------------------------------------------------------
header "Build"
if npm run build --silent 2>/dev/null; then
  pass "Production build succeeds"
else
  fail "Production build failed"
fi

# --------------------------------------------------------------------------
# 4. Tests
# --------------------------------------------------------------------------
header "Tests"
if npm run test --silent 2>/dev/null; then
  pass "All test suites pass"
else
  fail "Test failures detected — run 'npm run test' for details"
fi

# --------------------------------------------------------------------------
# 5. RLS Check (requires SUPABASE_DB_URL env var)
# --------------------------------------------------------------------------
header "Supabase RLS"
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  TABLES_WITHOUT_RLS=$(psql "$SUPABASE_DB_URL" -t -c "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('schema_migrations', 'extensions')
    AND tablename NOT IN (
      SELECT c.relname FROM pg_class c
      WHERE c.relrowsecurity = true
    );
  " 2>/dev/null | tr -d '[:space:]')
  if [ -n "$TABLES_WITHOUT_RLS" ]; then
    fail "Tables missing RLS: $TABLES_WITHOUT_RLS"
  else
    pass "All public tables have RLS enabled"
  fi
else
  warn "SUPABASE_DB_URL not set — skipping RLS check (set in .env.local for local verification)"
fi

# --------------------------------------------------------------------------
# 6. No Hardcoded Colors
# --------------------------------------------------------------------------
header "Design System — Colors"
HARDCODED_COLORS=$(grep -rn '#[0-9A-Fa-f]\{6\}' src/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v 'designSystem\|design-system\|tailwind\|config' \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// allowed-color' \
  | grep -v '// design-token' \
  || true)
if [ -n "$HARDCODED_COLORS" ]; then
  fail "Hardcoded hex colors found outside design system:"
  echo "$HARDCODED_COLORS" | head -10
else
  pass "No hardcoded colors outside design system"
fi

# --------------------------------------------------------------------------
# 7. No Hardcoded Financial Rates
# --------------------------------------------------------------------------
header "Financial — Rates"
HARDCODED_RATES=$(grep -rn 'exchangeRate\s*=\s*[0-9]\|DTA_RATE\s*=\s*[0-9]\|IGI_RATE\s*=\s*[0-9]\|IVA.*=\s*0\.16' src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v 'lib/rates' \
  | grep -v '// test-value' \
  || true)
if [ -n "$HARDCODED_RATES" ]; then
  fail "Hardcoded financial rates found (must use lib/rates.ts):"
  echo "$HARDCODED_RATES" | head -5
else
  pass "No hardcoded financial rates"
fi

# --------------------------------------------------------------------------
# 8. Touch Targets ≥ 60px
# --------------------------------------------------------------------------
header "Accessibility — Touch Targets"
# Check for suspiciously small interactive elements (Tailwind classes)
SMALL_TARGETS=$(grep -rn 'h-[0-7]\b\|w-[0-7]\b\|min-h-\[2\|min-h-\[3\|min-w-\[2\|min-w-\[3\|p-[01]\b' src/ \
  --include="*.tsx" \
  | grep -iE 'button|click|tap|action|link|href|onClick|onPress' \
  || true)
if [ -n "$SMALL_TARGETS" ]; then
  warn "Potential sub-60px touch targets (verify manually):"
  echo "$SMALL_TARGETS" | head -5
else
  pass "No obvious small touch targets on interactive elements"
fi

# --------------------------------------------------------------------------
# 9. Bilingual String Coverage
# --------------------------------------------------------------------------
header "i18n — Bilingual Coverage"
EN_FILES=$(find src/ -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs grep -l "'en'" 2>/dev/null | wc -l || echo 0)
ES_FILES=$(find src/ -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs grep -l "'es'" 2>/dev/null | wc -l || echo 0)
if [ "$EN_FILES" -ne "$ES_FILES" ] && [ "$EN_FILES" -gt 0 ]; then
  warn "English string files ($EN_FILES) vs Spanish ($ES_FILES) — check bilingual coverage"
else
  pass "Bilingual string coverage appears balanced ($EN_FILES en / $ES_FILES es)"
fi

# --------------------------------------------------------------------------
# 10. AI Audit Logging
# --------------------------------------------------------------------------
header "CRUZ AI — Audit Logging"
AI_CALLS=$(grep -rn 'anthropic\|claude\|completions\|cruz-ai' src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules\|\.test\.\|__tests__\|types\/' \
  || true)
AI_LOGS=$(grep -rn 'audit_log\|auditLog\|logAiInteraction\|audit\.ts' src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  || true)
if [ -n "$AI_CALLS" ] && [ -z "$AI_LOGS" ]; then
  fail "AI API calls found but no audit logging detected — all AI interactions must be logged"
else
  pass "AI audit logging present"
fi

# --------------------------------------------------------------------------
# 11. No "CRUD" String
# --------------------------------------------------------------------------
header "Brand — CRUD Check"
CRUD_FOUND=$(grep -rn 'CRUD' src/ \
  --include="*.ts" --include="*.tsx" --include="*.md" \
  | grep -v 'node_modules' \
  || true)
if [ -n "$CRUD_FOUND" ]; then
  fail "\"CRUD\" found in codebase — CRUZ, never CRUD:"
  echo "$CRUD_FOUND" | head -5
else
  pass "No 'CRUD' string in codebase"
fi

# --------------------------------------------------------------------------
# 12. No Hardcoded Client Identifiers
# --------------------------------------------------------------------------
header "Multi-Tenant — Client Isolation"
HARDCODED_CLIENT=$(grep -rn "'9254'\|\"9254\"\|'EVCO'\|\"EVCO\"" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// test-fixture' \
  | grep -v 'client-config' \
  || true)
if [ -n "$HARDCODED_CLIENT" ]; then
  fail "Hardcoded client identifiers in production code (must use getClientCode()):"
  echo "$HARDCODED_CLIENT" | head -5
else
  pass "No hardcoded client identifiers (9254/EVCO) in production code"
fi

# --------------------------------------------------------------------------
# 13. No console.log in Production
# --------------------------------------------------------------------------
header "Code Quality — Console Logs"
CONSOLE_LOGS=$(grep -rn 'console\.log' src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// debug-ok' \
  || true)
if [ -n "$CONSOLE_LOGS" ]; then
  fail "console.log found in production code (use structured logger or remove):"
  echo "$CONSOLE_LOGS" | head -5
else
  pass "No console.log in production code"
fi

# --------------------------------------------------------------------------
# 14. No Untyped 'any'
# --------------------------------------------------------------------------
header "Code Quality — Type Safety"
ANY_TYPES=$(grep -rn ': any\b\|as any\b' src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// any-ok:' \
  || true)
if [ -n "$ANY_TYPES" ]; then
  ANY_COUNT=$(echo "$ANY_TYPES" | wc -l)
  warn "'any' type used $ANY_COUNT times — each must have '// any-ok: [issue-link]' comment"
else
  pass "No untyped 'any' in production code"
fi

# --------------------------------------------------------------------------
# 15. Bundle Size Check
# --------------------------------------------------------------------------
header "Performance — Bundle Size"
if [ -d ".next" ]; then
  # Check if any page bundle exceeds 200KB
  LARGE_BUNDLES=$(find .next/static/chunks -name "*.js" -size +200k 2>/dev/null || true)
  if [ -n "$LARGE_BUNDLES" ]; then
    warn "JS chunks > 200KB found (review for code splitting opportunities):"
    echo "$LARGE_BUNDLES" | head -5 | while read -r f; do
      SIZE=$(du -h "$f" | cut -f1)
      echo "    $SIZE  $(basename "$f")"
    done
  else
    pass "All JS chunks under 200KB"
  fi
else
  warn "No .next build directory — run 'npm run build' first for bundle analysis"
fi

# --------------------------------------------------------------------------
# Results
# --------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  CRUZ Verification Results"
echo "  Failures: $FAILURES"
echo "  Warnings: $WARNINGS"
echo "============================================"

if [ $FAILURES -gt 0 ]; then
  echo ""
  echo "  ❌ BLOCKED — fix all failures before deploy"
  echo ""
  exit 1
else
  if [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "  ✅ PASSED with $WARNINGS warning(s) — review before deploy"
    echo ""
  else
    echo ""
    echo "  ✅ CLEAN — ready to deploy"
    echo "  Patente 3596 honrada."
    echo ""
  fi
  exit 0
fi
