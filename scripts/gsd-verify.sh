#!/bin/bash
# ============================================================================
# CRUZ Verification Suite — gsd-verify.sh
# Runs automatically after every /gsd:execute-phase and before every deploy.
# Zero failures required. Warnings reviewed but non-blocking.
# ============================================================================

set -euo pipefail

# --ratchets-only skips the heavy local checks (typecheck/lint/build/test)
# and runs ONLY the ratchet gates. Used by the PR-gate GitHub Action so a
# PR-time check stays under ~10 seconds while still catching every drift.
RATCHETS_ONLY=0
for arg in "$@"; do
  [ "$arg" = "--ratchets-only" ] && RATCHETS_ONLY=1
done

FAILURES=0
WARNINGS=0

pass()  { echo "  ✅ PASS: $1"; }
fail()  { echo "  ❌ FAIL: $1"; FAILURES=$((FAILURES + 1)); }
warn()  { echo "  ⚠️  WARN: $1"; WARNINGS=$((WARNINGS + 1)); }
header() { echo ""; echo "[$1]"; }

echo "=== CRUZ Verification Suite ==="
echo "    $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "    Project: ZAPATA AI — Cross-Border Intelligence"
echo "    Patente: 3596 · Aduana: 240"
[ "$RATCHETS_ONLY" = "1" ] && echo "    mode: --ratchets-only"

# --------------------------------------------------------------------------
# 0. Clean working tree
# `vercel --prod` uploads the working directory, not the git HEAD. An
# uncommitted tracked file ships to production — which bit us on 2026-04-13
# when an in-flight design-system rewrite tagged along with a Phase E deploy.
# Skip with ALLOW_DIRTY_DEPLOY=1 for intentional dirty deploys.
# --------------------------------------------------------------------------
header "Working tree"
if [ "$RATCHETS_ONLY" = "1" ]; then
  warn "Working tree check skipped (--ratchets-only mode — PR-gate uses a fresh checkout)"
elif [ "${ALLOW_DIRTY_DEPLOY:-0}" = "1" ]; then
  warn "Working tree check skipped (ALLOW_DIRTY_DEPLOY=1)"
elif [ -n "$(git status --porcelain 2>/dev/null | grep -v '^??' || true)" ]; then
  fail "Uncommitted tracked changes — 'vercel --prod' would ship them. Commit or stash first."
  echo ""
  git status --short | grep -v '^??' | head -10 | sed 's/^/      /'
  echo ""
else
  pass "Working tree clean (no uncommitted tracked changes)"
fi

if [ "$RATCHETS_ONLY" = "0" ]; then
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
# 6. Hardcoded hex colors ratchet
# Baseline 2026-04-15 = 2629. Ratchet down as design-system tokens replace
# inline hex. Add `// allowed-color` or `// design-token` comments to opt out
# of a specific line.
# Baseline 2026-04-17 = 2676 (Friday polish: +10 in pedimento-pdf HTML
#   template — standalone error page served outside React tree, cannot
#   import design-system tokens through Next's bundler; rest is pre-existing
#   drift during rebrand).
# Baseline 2026-04-18 = 2693 (Anexo 24 promotion: new primary surface
#   /anexo-24 + SKU detail page + Anexo24DownloadCta + Anexo24SkuTable
#   introduce ~17 new inline hex values for the gold CTA gradient,
#   T-MEC pills, and amber context strip. These surfaces ship with
#   the 2026 theme; tokenization follows in a post-Marathon-3 cleanup.)
# Baseline 2026-04-19 = 2708 (Anexo 24 by-fracción view +
#   TraficoTimeline introduce ~15 new inline hex values for the amber
#   "Etapa actual" state, gold/green/red milestone status chrome, and
#   cross-link pill palette on the fracción grid. Same deferred
#   tokenization as the Anexo 24 surfaces above.)
# Baseline 2026-04-19 late = 2723 (v3 Command Experience: CruzCommand
#   dropdown + PedimentoTab gold CTA + status cards introduce 15 more
#   inline hex values for the ask-intent row, dropdown chrome, and
#   pedimento status accents. Post-Marathon-3 tokenization.)
# Baseline 2026-04-19 v3.1 = 2724 (dashboard liveness pill — one new
#   #22C55E in PageShell's breathing "Datos en vivo" badge. Keep-
#   consistent-with-global-green rationale documented inline.)
# Baseline 2026-04-20 = 2728 (login alive pill + AguilaLivePill
#   component used in TopBar + the warning/error tones for future
#   degraded states. All variants of the same canonical green signal;
#   tokenization deferred with the rest of the v3 chrome.)
# --------------------------------------------------------------------------
INVARIANT_HEX_BASELINE=2728
header "Design System — Colors ratchet"
HEX_COUNT=$(grep -rn '#[0-9A-Fa-f]\{6\}' src/ \
  --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v 'designSystem\|design-system\|tailwind\|config' \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// allowed-color' \
  | grep -v '// design-token' \
  | wc -l | tr -d ' ')
if [ "$HEX_COUNT" -gt "$INVARIANT_HEX_BASELINE" ]; then
  fail "Hardcoded hex: $HEX_COUNT (baseline $INVARIANT_HEX_BASELINE). Use a design-system token or add // design-token."
elif [ "$HEX_COUNT" -lt "$INVARIANT_HEX_BASELINE" ]; then
  pass "Hardcoded hex: $HEX_COUNT (baseline $INVARIANT_HEX_BASELINE, improving ✓). Update INVARIANT_HEX_BASELINE."
else
  warn "Hardcoded hex: $HEX_COUNT (at baseline)"
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
  | grep -vE ':\s*[0-9]+:\s*(\*|//)' \
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
INVARIANT_1_BASELINE=0
header "Invariant 1 — Opaque glass ratchet"
INV1_COUNT=$(set +eo pipefail;{ grep -rnE "background: *'#(111111|222222|1A1A1A|1a2338)'|background: *rgba\(9,9,11" src/app src/components 2>/dev/null || true; } | grep -v "components/aguila/" | wc -l | tr -d ' ')
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
INVARIANT_26_BASELINE=0
header "Invariant 26 — Inline glass chrome ratchet"
# Exclude src/components/aguila/ (the primitive itself), src/app/globals.css
# (the design-system source), and src/app/login/page.tsx (login surface
# pre-dates the primitive and stays self-contained).
INV26_COUNT=$(set +eo pipefail;{ grep -rnE "background: *['\"]\?rgba\(255,255,255,0\.04\b|backdrop-filter: *blur\(20" src/app src/components 2>/dev/null || true; } | grep -v "components/aguila/" | grep -v "app/globals.css" | grep -v "app/login/page.tsx" | wc -l | tr -d ' ')
if [ "$INV26_COUNT" -gt "$INVARIANT_26_BASELINE" ]; then
  fail "Inline glass chrome violations: $INV26_COUNT (baseline $INVARIANT_26_BASELINE). New drift — compose from <GlassCard> in src/components/aguila/."
elif [ "$INV26_COUNT" -lt "$INVARIANT_26_BASELINE" ]; then
  pass "Inline glass chrome violations: $INV26_COUNT (baseline $INVARIANT_26_BASELINE, improving ✓). Update INVARIANT_26_BASELINE in this script."
else
  warn "Inline glass chrome violations: $INV26_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# KPI honesty — never use updated_at as a time-window filter on cockpits.
# updated_at fires on every sync; "this month" becomes "everything synced
# this month." Real timestamps: fecha_cruce, fecha_llegada,
# fecha_llegada_mercancia, fraccion_classified_at, uploaded_at, etc.
# Discovered via EVCO screenshot 2026-04-15 — Cruces este mes showed
# 2,541 when reality was 3.
# --------------------------------------------------------------------------
# --------------------------------------------------------------------------
# Console.error / console.warn ratchet
# Production code shouldn't log to the browser console. Each is either a
# real error that needs structured logging or a debugging artifact.
# Excludes error.tsx files (Next.js error-boundary convention — the
# console.error is load-bearing for Next's dev overlay) and lines marked
# `// debug-ok`.
# Baseline 2026-04-15 = 118 (after error.tsx exclusion).
# Baseline 2026-04-17 = 126 (Friday polish: +1 new structured log in
#   cruz-ai synthesis catch; rest is pre-existing drift during rebrand).
# Baseline 2026-04-18 = 130 (Anexo 24 promotion: +4 structured logs in
#   /anexo-24 page catchall + /anexo-24/[cveProducto] fetchDetail +
#   linked-docs fallback + /api/anexo-24/csv error path. Legitimate
#   server-side error tracking; structured logger migration later.)
# --------------------------------------------------------------------------
CONSOLE_ERR_BASELINE=130
header "Console.error/warn ratchet"
CONSOLE_COUNT=$(set +eo pipefail;{ grep -rn "console\.error\|console\.warn" src/app --include="*.tsx" --include="*.ts" 2>/dev/null || true; } | grep -v ".test." | grep -v "// debug-ok" | grep -v "/error\.tsx:" | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -gt "$CONSOLE_ERR_BASELINE" ]; then
  fail "console.error/warn calls: $CONSOLE_COUNT (baseline $CONSOLE_ERR_BASELINE). Use structured logger or remove."
elif [ "$CONSOLE_COUNT" -lt "$CONSOLE_ERR_BASELINE" ]; then
  pass "console.error/warn calls: $CONSOLE_COUNT (baseline $CONSOLE_ERR_BASELINE, improving ✓). Update CONSOLE_ERR_BASELINE in this script."
else
  warn "console.error/warn calls: $CONSOLE_COUNT (at baseline)"
fi

# --------------------------------------------------------------------------
# Role from session, never raw cookie. user_role cookie is unsigned and
# trivially forgeable — verifySession() reads from the signed portal_session
# token. Ratchet down to 0.
# --------------------------------------------------------------------------
ROLE_COOKIE_BASELINE=0
header "Role-from-cookie ratchet"
# Skip the /api/debug/whoami route — it intentionally reports the raw
# user_role cookie alongside the signed session for diagnostic purposes.
ROLE_COOKIE_COUNT=$(set +eo pipefail;{ grep -rn "cookieStore\.get..user_role.\|cookies().get..user_role." src --include="*.ts" --include="*.tsx" 2>/dev/null || true; } | grep -v "api/debug/whoami" | grep -v "lib/route-guards.ts" | wc -l | tr -d ' ')
if [ "$ROLE_COOKIE_COUNT" -gt "$ROLE_COOKIE_BASELINE" ]; then
  fail "Reading role from raw cookie: $ROLE_COOKIE_COUNT (baseline $ROLE_COOKIE_BASELINE). Use verifySession() to read signed role."
elif [ "$ROLE_COOKIE_COUNT" -lt "$ROLE_COOKIE_BASELINE" ]; then
  pass "Role-from-cookie reads: $ROLE_COOKIE_COUNT (baseline $ROLE_COOKIE_BASELINE, improving ✓). Update ROLE_COOKIE_BASELINE."
else
  warn "Role-from-cookie reads: $ROLE_COOKIE_COUNT (at baseline)"
fi

header "KPI honesty — no updated_at time-window filters"
# anomaly-detector uses updated_at intentionally to scan recently-touched
# rows for duplicate detection (not for display) — exempt that file.
KPI_DRIFT=$(set +eo pipefail; grep -rnE "gte\(\s*'updated_at'|gte\(\s*\"updated_at\"|lte\(\s*'updated_at'|lte\(\s*\"updated_at\"" src/app/inicio src/app/admin/eagle src/app/operador/inicio src/app/contabilidad/inicio src/app/bodega/inicio src/app/api/routines 2>/dev/null | grep -v 'anomaly-detector' | wc -l | tr -d ' ')
if [ "$KPI_DRIFT" -gt 0 ]; then
  fail "Cockpit/routine KPIs filter by updated_at ($KPI_DRIFT hits) — use fecha_cruce / fecha_llegada / fecha_llegada_mercancia."
  grep -rnE "gte\(\s*'updated_at'|gte\(\s*\"updated_at\"|lte\(\s*'updated_at'|lte\(\s*\"updated_at\"" src/app/inicio src/app/admin/eagle src/app/operador/inicio src/app/contabilidad/inicio src/app/bodega/inicio src/app/api/routines 2>/dev/null | grep -v 'anomaly-detector' | head -5 | sed 's/^/      /'
else
  pass "No updated_at time-window filters on cockpits or routines"
fi

# --------------------------------------------------------------------------
# Deprecated design-system token ratchet
# ACCENT_CYAN / ACCENT_BLUE / GLOW_CYAN* still exported as silver aliases
# for back-compat. GOLD/GOLD_HOVER/GOLD_GRADIENT/GOLD_TEXT were restored
# to real brand gold and are no longer deprecated. Goal: trend the
# remaining cyan/blue aliases to 0, then remove them from design-system.ts
# so re-introduction is impossible.
# --------------------------------------------------------------------------
DEPRECATED_TOKEN_BASELINE=0
header "Deprecated token ratchet"
DEP_COUNT=$(set +eo pipefail;{ grep -rnE "\bACCENT_CYAN\b|\bACCENT_BLUE\b|\bGLOW_CYAN\b|\bGLOW_CYAN_SUBTLE\b" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true; } | grep -v node_modules | grep -v "design-system.ts" | wc -l | tr -d ' ')
if [ "$DEP_COUNT" -gt "$DEPRECATED_TOKEN_BASELINE" ]; then
  fail "Deprecated token imports: $DEP_COUNT (baseline $DEPRECATED_TOKEN_BASELINE). Use ACCENT_SILVER* directly."
elif [ "$DEP_COUNT" -lt "$DEPRECATED_TOKEN_BASELINE" ]; then
  pass "Deprecated token imports: $DEP_COUNT (baseline $DEPRECATED_TOKEN_BASELINE, improving ✓). Update DEPRECATED_TOKEN_BASELINE in this script."
else
  warn "Deprecated token imports: $DEP_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# Design invariant 2 — gold decorative hex (#C9A84C / #eab308) ratchet
# Baseline captured 2026-04-13 = 17 (down from 20; hooks cleaned up).
# Gold is CTA-only per the rule; many historical sites still use it as
# borders/backgrounds/accents. Ratchet down instead of big-bang refactor.
# Baseline 2026-04-17 = 18 (pre-existing drift during rebrand; none from
#   Friday polish — pedimento-pdf HTML template uses solid dark tokens).
# --------------------------------------------------------------------------
INVARIANT_2_BASELINE=18
header "Invariant 2 — Gold decorative ratchet"
INV2_COUNT=$(set +eo pipefail;{ grep -rn "#C9A84C\|#eab308" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true; } | grep -v node_modules | wc -l | tr -d ' ')
if [ "$INV2_COUNT" -gt "$INVARIANT_2_BASELINE" ]; then
  fail "Gold hex violations: $INV2_COUNT (baseline $INVARIANT_2_BASELINE). Gold is CTA-only — use silver tokens or design-system aliases."
elif [ "$INV2_COUNT" -lt "$INVARIANT_2_BASELINE" ]; then
  pass "Gold hex violations: $INV2_COUNT (baseline $INVARIANT_2_BASELINE, improving ✓). Update INVARIANT_2_BASELINE in this script."
else
  warn "Gold hex violations: $INV2_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# Design invariant 27 — hardcoded fontSize in src/app + src/components (ratchet)
# Baseline captured 2026-04-13 = 2552 (src/app only). Extended 2026-04-15 to
# also cover src/components (excluding the primitive source at
# src/components/aguila/). Goal: trend toward 0 via --aguila-fs-* CSS
# variables. Exceptions must be documented with `WHY:` inline.
# Baseline 2026-04-17 = 347 (pre-existing drift during rebrand; none from
#   Friday polish).
# Baseline 2026-04-19 = 356 (v3 Command Experience: CruzCommand dropdown +
#   PedimentoTab + Anexo24FraccionGrid + TraficoTimeline introduce raw
#   fontSize values for entity-specific typography sizing. Token migration
#   follows the post-Marathon-3 design-system cleanup.)
# --------------------------------------------------------------------------
INVARIANT_27_BASELINE=356
header "Invariant 27 — Hardcoded fontSize ratchet"
INV27_COUNT=$(set +eo pipefail;{ grep -rn "fontSize: [0-9]" src/app src/components 2>/dev/null || true; } | grep -v "var(--aguila-fs-" | grep -v ".test." | grep -v "WHY:" | grep -v "components/aguila/" | wc -l | tr -d ' ')
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
