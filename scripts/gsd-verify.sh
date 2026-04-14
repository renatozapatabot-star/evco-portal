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
# 0. Clean working tree
# `vercel --prod` uploads the working directory, not the git HEAD. An
# uncommitted tracked file ships to production — which bit us on 2026-04-13
# when an in-flight design-system rewrite tagged along with a Phase E deploy.
# Skip with ALLOW_DIRTY_DEPLOY=1 for intentional dirty deploys.
# --------------------------------------------------------------------------
header "Working tree"
if [ "${ALLOW_DIRTY_DEPLOY:-0}" = "1" ]; then
  warn "Working tree check skipped (ALLOW_DIRTY_DEPLOY=1)"
elif [ -n "$(git status --porcelain 2>/dev/null | grep -v '^??' || true)" ]; then
  fail "Uncommitted tracked changes — 'vercel --prod' would ship them. Commit or stash first."
  echo ""
  git status --short | grep -v '^??' | head -10 | sed 's/^/      /'
  echo ""
else
  pass "Working tree clean (no uncommitted tracked changes)"
fi

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
# Design invariant 1 — opaque glass cards outside components/aguila (ratchet)
# Baseline captured 2026-04-13 = 182 (inline rgba(9,9,11,0.75) etc).
# Goal: number trends to 0. Fail only if count GROWS past baseline.
# --------------------------------------------------------------------------
INVARIANT_1_BASELINE=185
header "Invariant 1 — Opaque glass ratchet"
INV1_COUNT=$(grep -rnE "background.*'#(111111|222222|1A1A1A|1a2338)'|background.*rgba\(9,9,11" src/app src/components 2>/dev/null | grep -v "components/aguila/" | wc -l | tr -d ' ')
if [ "$INV1_COUNT" -gt "$INVARIANT_1_BASELINE" ]; then
  fail "Opaque glass violations: $INV1_COUNT (baseline $INVARIANT_1_BASELINE). New drift introduced — compose from <GlassCard>."
elif [ "$INV1_COUNT" -lt "$INVARIANT_1_BASELINE" ]; then
  pass "Opaque glass violations: $INV1_COUNT (baseline $INVARIANT_1_BASELINE, improving ✓). Update INVARIANT_1_BASELINE in this script."
else
  warn "Opaque glass violations: $INV1_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# Design invariant 26 — inline glass chrome outside components/aguila (ratchet)
# Baseline captured 2026-04-13 = 111 (inline rgba(255,255,255,0.04) + blur).
# --------------------------------------------------------------------------
INVARIANT_26_BASELINE=13
header "Invariant 26 — Inline glass chrome ratchet"
INV26_COUNT=$(grep -rnE "background: *['\"]\?rgba\(255,255,255,0\.04\b|backdrop-filter: *blur\(20" src/app src/components 2>/dev/null | grep -v "components/aguila/" | wc -l | tr -d ' ')
if [ "$INV26_COUNT" -gt "$INVARIANT_26_BASELINE" ]; then
  fail "Inline glass chrome violations: $INV26_COUNT (baseline $INVARIANT_26_BASELINE). New drift — compose from <GlassCard> in src/components/aguila/."
elif [ "$INV26_COUNT" -lt "$INVARIANT_26_BASELINE" ]; then
  pass "Inline glass chrome violations: $INV26_COUNT (baseline $INVARIANT_26_BASELINE, improving ✓). Update INVARIANT_26_BASELINE in this script."
else
  warn "Inline glass chrome violations: $INV26_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# Design invariant 27 — hardcoded fontSize in src/app (ratchet)
# Baseline captured 2026-04-13 = 2552. Goal: trend toward 0 via --aguila-fs-*
# CSS variables. Exceptions must be documented with `WHY:` inline.
# --------------------------------------------------------------------------
INVARIANT_27_BASELINE=2552
header "Invariant 27 — Hardcoded fontSize ratchet"
INV27_COUNT=$(grep -rn "fontSize: [0-9]" src/app 2>/dev/null | grep -v "var(--aguila-fs-" | grep -v ".test." | grep -v "WHY:" | wc -l | tr -d ' ')
if [ "$INV27_COUNT" -gt "$INVARIANT_27_BASELINE" ]; then
  fail "Hardcoded fontSize violations: $INV27_COUNT (baseline $INVARIANT_27_BASELINE). Use var(--aguila-fs-*) or add // WHY: comment."
elif [ "$INV27_COUNT" -lt "$INVARIANT_27_BASELINE" ]; then
  pass "Hardcoded fontSize violations: $INV27_COUNT (baseline $INVARIANT_27_BASELINE, improving ✓). Update INVARIANT_27_BASELINE in this script."
else
  warn "Hardcoded fontSize violations: $INV27_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# AGUILA palette guard — no blue/indigo/sky/cyan Tailwind classes outside
# the semantic StatusBadge component.
# --------------------------------------------------------------------------
header "AGUILA palette"
AGUILA_HITS=$(grep -rn "bg-blue-\|bg-indigo-\|bg-sky-\|bg-cyan-\|text-blue-\|text-indigo-\|text-sky-\|text-cyan-\|border-blue-\|border-indigo-\|border-sky-\|border-cyan-\|ring-blue-\|ring-cyan-" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "components/ui/StatusBadge.tsx" || true)
if [ -n "$AGUILA_HITS" ]; then
  fail "Forbidden blue/indigo/sky/cyan Tailwind classes found (outside StatusBadge)"
else
  pass "No forbidden blue/indigo/sky/cyan Tailwind classes"
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
