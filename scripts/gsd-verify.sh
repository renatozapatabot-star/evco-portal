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
# Baseline 2026-04-19 theme/v6 = 2709 (Phase 0.1 gold consolidation +
#   Phase 0.4 SemaforoPill tokenization + Phase 0.8 StatusBadge --portal-
#   status-* tokens + Phase 2 /status rewrite + /anomalias SEV_CFG
#   tokenized. Net 13-hex drop from the 2722 floor.)
# Baseline 2026-04-19 theme/v6 floor = 2658 (combined session + parallel
#   data-trust session work: /catalogo SourceChip, /clasificar Bulk +
#   Nuevo, plus additional drift pickups from the sibling session).
# Baseline 2026-04-19 theme/v6 codemod = 1958 (Phase 3 codemod --apply
#   landed 788 hex + 148 rgba tokenizations across 144 files via
#   scripts/codemod-theme-v6.js. Commit 8742fd0. −700 inline hex in
#   one pass, more than the entire hand-tokenization phase.)
# --------------------------------------------------------------------------
# Baseline 2026-04-19 PDF-restore = 662 (unchanged). @react-pdf/renderer files
#   (src/lib/pdf/, doc-generators/, any *-pdf/ route, classification-pdf,
#   label-templates) excluded from hex ratchet — @react-pdf cannot resolve
#   CSS variables, so literal hex is *required*. Codemods b2eac39/c02e064/
#   9763f56/e9016bb naively substituted var(--portal-*) into these files
#   and broke gradient rendering (null stop in PDFLinearGradient.stop).
#   Exclusion prevents future codemod drift AND accounts for the legitimate
#   hex restored in pdf/brand.tsx + the 4 doc/pedimento PDF files.
INVARIANT_HEX_BASELINE=662
header "Design System — Colors ratchet"
HEX_COUNT=$(grep -rn '#[0-9A-Fa-f]\{6\}' src/ \
  --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v 'designSystem\|design-system\|tailwind\|config' \
  | grep -v 'node_modules' \
  | grep -v '\.test\.\|__tests__' \
  | grep -v '// allowed-color' \
  | grep -v '// design-token' \
  | grep -v 'src/lib/pdf/' \
  | grep -v 'src/lib/doc-generators/' \
  | grep -v 'src/lib/classification-pdf\|src/lib/anexo-24-export\|src/lib/report-exports/pdf\|src/lib/label-templates/' \
  | grep -v 'src/app/api/pedimento-pdf/\|src/app/api/anexo24-pdf/\|src/app/api/reportes-pdf/\|src/app/api/auditoria-pdf/' \
  | grep -v 'src/app/api/oca/.*/pdf/\|src/app/api/usmca/.*/pdf/\|src/app/api/reportes/multi-cliente/.*/pdf-document' \
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
  fail "\"CRUD\" found in codebase — PORTAL, never CRUD:"
  echo "$CRUD_FOUND" | head -5
else
  pass "No 'CRUD' string in codebase"
fi

# --------------------------------------------------------------------------
# 11b. Block DD · CRUZ string ratchet (user-visible surfaces)
# --------------------------------------------------------------------------
# Block DD rebranded the platform to PORTAL. Client-visible \bCRUZ\b
# tokens in JSX prose, string literals shown to users, aria-labels,
# and titles are ratchet violations. Identifiers (CruzCommand, cruz-fab,
# CRUZ_CHAT_FALLBACK), JSDoc comments, and real-world carrier business
# names (AUTOEXPRESS CRUZ, TRANSPORTES JOSÉ CRUZ MACIAS) are excluded.
header "Invariant Block-DD — CRUZ user-visible string ratchet"
INVARIANT_CRUZ_BASELINE=${INVARIANT_CRUZ_BASELINE:-218}
CRUZ_COUNT=$(grep -rn '\bCRUZ\b' src/app src/components \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'node_modules' \
  | grep -v '__tests__' \
  | grep -v 'AUTOEXPRESS CRUZ\|JOSé CRUZ\|JOSÉ CRUZ' \
  | wc -l | tr -d ' ')
if [ "$CRUZ_COUNT" -gt "$INVARIANT_CRUZ_BASELINE" ]; then
  fail "\bCRUZ\b surfaces: $CRUZ_COUNT (baseline $INVARIANT_CRUZ_BASELINE). New CRUZ strings on user-visible surfaces are banned — use PORTAL."
elif [ "$CRUZ_COUNT" -lt "$INVARIANT_CRUZ_BASELINE" ]; then
  pass "\bCRUZ\b surfaces: $CRUZ_COUNT (baseline $INVARIANT_CRUZ_BASELINE, improving ✓). Update INVARIANT_CRUZ_BASELINE."
else
  warn "\bCRUZ\b surfaces: $CRUZ_COUNT (at baseline, JSDoc comments acceptable)"
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
INV26_COUNT=$(set +eo pipefail;{ grep -rnE "background: *['\"]\?rgba\(255,255,255,0\.04\b|backdrop-filter: *blur\(20" src/app src/components 2>/dev/null || true; } | grep -v "components/aguila/" | grep -v "app/globals.css" | grep -v "app/portal-tokens.css" | grep -v "app/portal-components.css" | grep -v "app/login/page.tsx" | wc -l | tr -d ' ')
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
ROLE_COOKIE_COUNT=$(set +eo pipefail;{ grep -rnE "cookieStore\.get\(.user_role.\)|cookies\(\)\.get\(.user_role.\)|req\.cookies\.get\(.user_role.\)|req\.cookies\.get\(.company_id.\)" src --include="*.ts" --include="*.tsx" 2>/dev/null || true; } | grep -v "api/debug/whoami" | grep -v "lib/route-guards.ts" | grep -v "__tests__/" | wc -l | tr -d ' ')
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
# Baseline 2026-04-19 discipline-cascade = 12 (ParteDetailClient tab
#   underline hex #C9A84C retired; one more gold hex converted to
#   var(--portal-gold-500) token).
# --------------------------------------------------------------------------
INVARIANT_2_BASELINE=12
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
# Baseline 2026-04-17 PM = 415 (reference-faithful dashboard port:
#   PortalTopBar, PortalGreeting, PortalAssistantFab, PortalCommandPalette,
#   PortalModuleCard, 9 Viz* components, PortalPedimentoTheater, login
#   editorial eyebrow/corridor introduce ~41 inline fontSize values. Most
#   are handoff-specific pixel values — 64 for the giant pedimento number,
#   32/40 for payment total + semáforo headline, 28/22 for module/card
#   titles, 18 for doc simulation. These don't map to the --portal-fs-*
#   scale and would break fidelity if forced. Tokenization in a follow-up
#   design-audit block after the reference port lands in prod.)
# --------------------------------------------------------------------------
# Baseline 2026-04-17 evening = 419 (Phase A/B port: PortalLoginLiveWire
#   (+1 for ticker micro label), PortalLoginBackgroundLineMap (+3 SVG
#   fontSize attrs — 5px territory labels), PortalDetailHero (+3 hero
#   fontSize values: 64px giant pedimento number, 8px stage spine label,
#   20px stat-cell value). All handoff-specific values driving literal
#   reference fidelity; tokenization deferred with the other reference
#   pixels in a post-parity cleanup block.)
# Baseline 2026-04-17 late evening = 421 (Phase E + Phase G gallery:
#   +2 for PortalCrucesMap SVG font-size text labels (9px / 8px / 8.5px
#   coordinates). Still handoff-specific.)
# Baseline 2026-04-19 discipline-cascade = 388 (ParteDetailClient.tsx
#   tokenized: 33 inline fontSize values routed through --aguila-fs-*
#   (21 direct token maps) or tagged with same-line WHY: (12 intermediate
#   sizes — 12px and 16px — that don't map cleanly to the scale).
#   No new violations introduced; one of the file-level worst offenders
#   now reads at 0 ratchet-excluded lines.)
# Baseline 2026-04-19 discipline-cascade phase 2 = 385 (parte-detail
#   page.tsx server wrapper tokenized: 8 more fontSize values — 2 direct
#   token maps (body/meta), 6 same-line WHY: for intermediate 12px chips.
#   Full parte-detail surface now fully ratchet-clean.)
# Baseline 2026-04-19 PDF-restore-phase-2 = 385 (unchanged). @react-pdf
#   rendering files exempt — @react-pdf StyleSheet requires numeric
#   fontSize; CSS var substitution breaks rendering (same root cause
#   as the hex ratchet PDF exclusion above). The 7 api/*-pdf/
#   pdf-document.tsx + lib PDF files restored from 2d4f196^ have
#   numeric fontSize by necessity.
INVARIANT_27_BASELINE=385
header "Invariant 27 — Hardcoded fontSize ratchet"
INV27_COUNT=$(set +eo pipefail;{ grep -rn "fontSize: [0-9]" src/app src/components 2>/dev/null || true; } | grep -v "var(--aguila-fs-" | grep -v ".test." | grep -v "WHY:" | grep -v "components/aguila/" | grep -v "api/pedimento-pdf/\|api/anexo24-pdf/\|api/reportes-pdf/\|api/auditoria-pdf/\|api/oca/.*/pdf/\|api/usmca/.*/pdf/\|api/reportes/multi-cliente/.*/pdf-document\|api/labels/" | wc -l | tr -d ' ')
if [ "$INV27_COUNT" -gt "$INVARIANT_27_BASELINE" ]; then
  fail "Hardcoded fontSize violations: $INV27_COUNT (baseline $INVARIANT_27_BASELINE). Use var(--aguila-fs-*) or add // WHY: comment."
elif [ "$INV27_COUNT" -lt "$INVARIANT_27_BASELINE" ]; then
  pass "Hardcoded fontSize violations: $INV27_COUNT (baseline $INVARIANT_27_BASELINE, improving ✓). Update INVARIANT_27_BASELINE in this script."
else
  warn "Hardcoded fontSize violations: $INV27_COUNT (at baseline, not regressing but cleanup pending)"
fi

# --------------------------------------------------------------------------
# Block DD Phase 3 — PORTAL adoption ratchets.
# Three counters: inline-hero-glass DOWN, inline-backdrop-filter DOWN,
# portal-primitive imports UP. Each ratchet auto-promotes on improvement
# (update the baseline inline when you see "improving ✓").
# --------------------------------------------------------------------------
PORTAL_INLINE_HERO_BASELINE=60
header "PORTAL · inline hero-glass ratchet (target 0)"
PORTAL_HERO_COUNT=$(set +eo pipefail;{ grep -rnE "rgba\(0, ?0, ?0, ?0\.(4|25|12)\)" src/app src/components 2>/dev/null || true; } | grep -v "components/aguila/" | grep -v "components/portal/" | grep -v ".test." | grep -v "globals.css" | grep -v "portal-components.css" | grep -v "portal-tokens.css" | wc -l | tr -d ' ')
if [ "$PORTAL_HERO_COUNT" -gt "$PORTAL_INLINE_HERO_BASELINE" ]; then
  fail "Inline rgba(0,0,0,0.4/.25/.12): $PORTAL_HERO_COUNT (baseline $PORTAL_INLINE_HERO_BASELINE). Route through <GlassCard>/<PortalCard> instead."
elif [ "$PORTAL_HERO_COUNT" -lt "$PORTAL_INLINE_HERO_BASELINE" ]; then
  pass "Inline rgba(0,0,0,0.4/.25/.12): $PORTAL_HERO_COUNT (baseline $PORTAL_INLINE_HERO_BASELINE, improving ✓). Update PORTAL_INLINE_HERO_BASELINE in this script."
else
  warn "Inline rgba(0,0,0,0.4/.25/.12): $PORTAL_HERO_COUNT (at baseline, awaiting cleanup block)"
fi

PORTAL_BACKDROP_BASELINE=179
header "PORTAL · inline backdropFilter ratchet (target 0)"
PORTAL_BACKDROP_COUNT=$(set +eo pipefail;{ grep -rn "backdropFilter" src/app src/components 2>/dev/null || true; } | grep -v "components/aguila/" | grep -v "components/portal/" | grep -v ".test." | wc -l | tr -d ' ')
if [ "$PORTAL_BACKDROP_COUNT" -gt "$PORTAL_BACKDROP_BASELINE" ]; then
  fail "Inline backdropFilter: $PORTAL_BACKDROP_COUNT (baseline $PORTAL_BACKDROP_BASELINE). Chemistry belongs in .portal-card / .portal-sticky-topbar."
elif [ "$PORTAL_BACKDROP_COUNT" -lt "$PORTAL_BACKDROP_BASELINE" ]; then
  pass "Inline backdropFilter: $PORTAL_BACKDROP_COUNT (baseline $PORTAL_BACKDROP_BASELINE, improving ✓). Update PORTAL_BACKDROP_BASELINE in this script."
else
  warn "Inline backdropFilter: $PORTAL_BACKDROP_COUNT (at baseline, awaiting cleanup block)"
fi

PORTAL_IMPORT_BASELINE=3
header "PORTAL · primitive adoption ratchet (target ↑)"
PORTAL_IMPORTS=$(set +eo pipefail;{ grep -rln "from '@/components/portal'" src/app src/components 2>/dev/null || true; } | grep -v "components/portal/" | grep -v ".test." | wc -l | tr -d ' ')
if [ "$PORTAL_IMPORTS" -lt "$PORTAL_IMPORT_BASELINE" ]; then
  fail "@/components/portal imports regressed: $PORTAL_IMPORTS (was $PORTAL_IMPORT_BASELINE). Adoption should only go UP."
elif [ "$PORTAL_IMPORTS" -gt "$PORTAL_IMPORT_BASELINE" ]; then
  pass "@/components/portal imports: $PORTAL_IMPORTS (was $PORTAL_IMPORT_BASELINE, growing ✓). Update PORTAL_IMPORT_BASELINE in this script."
else
  warn "@/components/portal imports: $PORTAL_IMPORTS (at baseline — next block should advance adoption)"
fi

# Reference-parity plan — PortalDashboard adoption across 3 cockpits.
# Target 3 = /inicio + /operador/inicio + /admin/eagle. Currently at 3
# after commit 54e3db5 layered the dashboard onto operator + owner.
PORTAL_DASHBOARD_BASELINE=3
header "PORTAL · dashboard adoption ratchet (target 3 = all cockpits)"
PORTAL_DASHBOARD_COUNT=$(set +eo pipefail;{ grep -rln "<PortalDashboard" src/app 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$PORTAL_DASHBOARD_COUNT" -lt "$PORTAL_DASHBOARD_BASELINE" ]; then
  fail "<PortalDashboard> usage regressed: $PORTAL_DASHBOARD_COUNT (was $PORTAL_DASHBOARD_BASELINE). Must render on /inicio, /operador/inicio, /admin/eagle."
elif [ "$PORTAL_DASHBOARD_COUNT" -gt "$PORTAL_DASHBOARD_BASELINE" ]; then
  pass "<PortalDashboard> usage: $PORTAL_DASHBOARD_COUNT (was $PORTAL_DASHBOARD_BASELINE, growing ✓). Update PORTAL_DASHBOARD_BASELINE."
else
  pass "<PortalDashboard> usage: $PORTAL_DASHBOARD_COUNT (all three cockpits covered)"
fi

# Reference-parity plan — living login presence. Must render exactly
# once (on /login). Any regression means the atmosphere is gone.
PORTAL_LIVING_LOGIN_BASELINE=1
header "PORTAL · living login background ratchet (target 1 = /login)"
PORTAL_LIVING_LOGIN_COUNT=$(set +eo pipefail;{ grep -rln "PortalLoginBackgroundLineMap" src/app 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$PORTAL_LIVING_LOGIN_COUNT" -lt "$PORTAL_LIVING_LOGIN_BASELINE" ]; then
  fail "PortalLoginBackgroundLineMap render sites: $PORTAL_LIVING_LOGIN_COUNT (was $PORTAL_LIVING_LOGIN_BASELINE). /login must render the living map."
else
  pass "PortalLoginBackgroundLineMap render sites: $PORTAL_LIVING_LOGIN_COUNT (login atmosphere present)"
fi

# --------------------------------------------------------------------------
# Block EE · Tenant-isolation ratchets
#
# The Block EE contamination incident (303K rows had to be retagged)
# was caused by sync scripts that wrote globalpc_* rows WITHOUT
# company_id. These ratchets catch a regression back to that state at
# pre-commit time.
# --------------------------------------------------------------------------

# Fallback tenant-id literal — sync scripts must not re-introduce the
# FALLBACK_TENANT_ID pattern that let orphan rows get stamped with a
# real client's company_id. One reference remains in globalpc-sync.js
# (the legacy tenant_id constant, not used for company_id assignment).
header "Invariant Block-EE — FALLBACK_TENANT_ID ratchet"
FALLBACK_TENANT_BASELINE=${FALLBACK_TENANT_BASELINE:-1}
FALLBACK_HITS=$(grep -rn "FALLBACK_TENANT_ID\s*=\|company_id:\s*FALLBACK_TENANT_ID" scripts/ 2>/dev/null | grep -v "node_modules" | grep -v ".test." | wc -l | tr -d ' ')
if [ "$FALLBACK_HITS" -gt "$FALLBACK_TENANT_BASELINE" ]; then
  fail "FALLBACK_TENANT_ID references: $FALLBACK_HITS (baseline $FALLBACK_TENANT_BASELINE). No sync script may use a fallback — see .claude/rules/tenant-isolation.md"
elif [ "$FALLBACK_HITS" -lt "$FALLBACK_TENANT_BASELINE" ]; then
  pass "FALLBACK_TENANT_ID references: $FALLBACK_HITS (baseline $FALLBACK_TENANT_BASELINE, improving ✓). Update FALLBACK_TENANT_BASELINE in this script."
else
  warn "FALLBACK_TENANT_ID references: $FALLBACK_HITS (at baseline — legacy tenant_id constant pending full removal)"
fi

# Invariant Block-EE — 'unknown' tenant fallback ratchet
#
# Block EE forbids `company_id: X || 'unknown'` patterns in scripts
# that write to tenant-scoped tables (see .claude/rules/tenant-isolation.md
# "Forbidden patterns"). Pre-launch sweep on 2026-04-20 eliminated every
# occurrence in sync paths. bootcamp-client-fingerprint.js:52 and
# tariff-monitor.js:65 use 'unknown' as an in-memory grouping key (not
# a DB write) — legitimate, excluded from this count.
header "Invariant Block-EE — tenant 'unknown' fallback ratchet"
UNKNOWN_FALLBACK_BASELINE=2  # bootcamp + tariff-monitor — local grouping, not writes
UNKNOWN_FALLBACK_COUNT=$(grep -rn "company_id.*'unknown'\|cid.*'unknown'" scripts/*.js 2>/dev/null \
  | grep -v "^.*:[[:space:]]*//" \
  | grep -v "scripts/lib/" \
  | wc -l | tr -d ' ')
if [ "$UNKNOWN_FALLBACK_COUNT" -gt "$UNKNOWN_FALLBACK_BASELINE" ]; then
  fail "'unknown' tenant fallback: $UNKNOWN_FALLBACK_COUNT (baseline $UNKNOWN_FALLBACK_BASELINE). NEW script writes '|| \"unknown\"' into company_id. Block EE says skip-and-alert instead."
elif [ "$UNKNOWN_FALLBACK_COUNT" -lt "$UNKNOWN_FALLBACK_BASELINE" ]; then
  pass "'unknown' tenant fallback: $UNKNOWN_FALLBACK_COUNT (baseline $UNKNOWN_FALLBACK_BASELINE, improving ✓). Lower UNKNOWN_FALLBACK_BASELINE."
else
  pass "'unknown' tenant fallback: $UNKNOWN_FALLBACK_COUNT (at baseline — 2 legitimate local-grouping uses)"
fi

# Every `table: 'globalpc_*'` write in globalpc-sync.js must have a
# `company_id:` line in its mapRow body. The count should be exactly 8
# (one per globalpc_* table the sync writes).
header "Invariant Block-EE — globalpc-sync company_id writes"
GPC_SYNC_MAPROWS=$(grep -c "company_id: companyId" scripts/globalpc-sync.js 2>/dev/null || echo 0)
if [ "$GPC_SYNC_MAPROWS" -lt 8 ]; then
  fail "globalpc-sync.js has only $GPC_SYNC_MAPROWS mapRows writing company_id (expected 8). See .claude/rules/tenant-isolation.md"
else
  pass "globalpc-sync.js mapRows writing company_id: $GPC_SYNC_MAPROWS (≥ 8 required)"
fi

# --------------------------------------------------------------------------
# Invariant Block-EE+ — globalpc_productos reads need allowlist guard
#
# Every .from('globalpc_productos') call in src/ must have a nearby
# .in('cve_producto', …) guard (within ~20 lines after) OR an isInternal
# branch OR the explicit comment marker `allowlist-ok:globalpc_productos`.
# Missing guard = the same leak class that the Sunday 2026-04-19 marathon
# fixed in src/lib/aguila/tools.ts.
#
# The active-parts helper file itself is excluded (it IS the allowlist).
# --------------------------------------------------------------------------
# Baseline ratchet: existing count established 2026-04-19 during Phase 7 of
# the Sunday data-trust marathon. Count can only go DOWN; any new unguarded
# read (in a client-role path) bumps this above baseline and fails the
# build. Lower the baseline as call sites get audited + marked.
PRODUCTOS_UNGUARDED_BASELINE=35
header "Invariant Block-EE+ — globalpc_productos allowlist guard ratchet"
PRODUCTOS_UNGUARDED_LIST=$(awk '
  FNR == 1 { file = FILENAME }
  /\.from\(["\x27]globalpc_productos["\x27]\)/ {
    buf[NR] = file ":" FNR ":" $0
    found_guard[NR] = 0
  }
  {
    for (k in buf) {
      if (NR > k && NR <= k + 20) {
        if ($0 ~ /\.in\(["\x27]cve_producto/) found_guard[k] = 1
        if ($0 ~ /isInternal/) found_guard[k] = 1
        if ($0 ~ /allowlist-ok:globalpc_productos/) found_guard[k] = 1
      }
    }
  }
  END {
    for (k in buf) {
      if (found_guard[k] != 1) print buf[k]
    }
  }
' $(find src -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | grep -v __tests__ | grep -v '.test.' | grep -v 'anexo24/active-parts.ts') 2>/dev/null | sort -u)
PRODUCTOS_UNGUARDED_COUNT=$(echo "$PRODUCTOS_UNGUARDED_LIST" | grep -cE "^.+:" || echo 0)
if [ "$PRODUCTOS_UNGUARDED_COUNT" -gt "$PRODUCTOS_UNGUARDED_BASELINE" ]; then
  fail "Unguarded globalpc_productos reads: $PRODUCTOS_UNGUARDED_COUNT (baseline $PRODUCTOS_UNGUARDED_BASELINE). NEW call site added without allowlist guard. Add .in('cve_producto', activeList), an isInternal branch, or // allowlist-ok:globalpc_productos comment. See .claude/rules/tenant-isolation.md:"
  echo "$PRODUCTOS_UNGUARDED_LIST" | head -25 | sed 's/^/    /'
elif [ "$PRODUCTOS_UNGUARDED_COUNT" -lt "$PRODUCTOS_UNGUARDED_BASELINE" ]; then
  pass "Unguarded globalpc_productos reads: $PRODUCTOS_UNGUARDED_COUNT (baseline $PRODUCTOS_UNGUARDED_BASELINE, improving ✓). Lower PRODUCTOS_UNGUARDED_BASELINE in this script."
else
  warn "Unguarded globalpc_productos reads: $PRODUCTOS_UNGUARDED_COUNT (at baseline — audit each site before next milestone, see Phase 9)"
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

# ==========================================================================
# Theme v6 migration ratchets (Block FF · theme/v6-migration branch)
#
# Each new aguila primitive should grow in adoption (positive ratchet).
# tailwind.config.ts hex literals + inline @keyframes outside the design
# system should shrink. Baselines seeded from the measured floor on the
# branch where Phase 0 primitives landed.
# ==========================================================================

# R7 — tailwind.config.ts standalone hex literals (target ↓).
# Phase 0.1 consolidated gold. Remaining hex (navy/z-red/canvas/status/
# teal/plum/borderColor/backgroundColor/textColor/boxShadow) should
# migrate to var(--portal-*) in future blocks.
header "theme/v6 · tailwind.config.ts standalone hex literals (target ↓)"
TAILWIND_HEX_BASELINE=${TAILWIND_HEX_BASELINE:-13}
TAILWIND_HEX_HITS=$(grep -cE "'#[0-9a-fA-F]{3,8}'" tailwind.config.ts 2>/dev/null || echo 0)
if [ "$TAILWIND_HEX_HITS" -gt "$TAILWIND_HEX_BASELINE" ]; then
  fail "tailwind.config.ts hex literals: $TAILWIND_HEX_HITS (baseline $TAILWIND_HEX_BASELINE). Route through var(--portal-*)."
elif [ "$TAILWIND_HEX_HITS" -lt "$TAILWIND_HEX_BASELINE" ]; then
  pass "tailwind.config.ts hex literals: $TAILWIND_HEX_HITS (was $TAILWIND_HEX_BASELINE, improving ✓). Update TAILWIND_HEX_BASELINE."
else
  warn "tailwind.config.ts hex literals: $TAILWIND_HEX_HITS (at baseline — next block should reduce)"
fi

# R6 — inline @keyframes outside components/aguila + components/portal.
# Motion chemistry lives in globals.css / portal-tokens.css. Keyframes
# in one-off components drift the cadence.
header "theme/v6 · inline @keyframes outside design system (target ↓)"
INLINE_KEYFRAMES_BASELINE=${INLINE_KEYFRAMES_BASELINE:-57}
INLINE_KEYFRAMES_HITS=$(grep -rnE "@keyframes[[:space:]]" src/ --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v "components/aguila/\|components/portal/\|\.test\." \
  | wc -l | tr -d ' ')
if [ "$INLINE_KEYFRAMES_HITS" -gt "$INLINE_KEYFRAMES_BASELINE" ]; then
  fail "Inline @keyframes outside aguila/portal: $INLINE_KEYFRAMES_HITS (baseline $INLINE_KEYFRAMES_BASELINE)."
elif [ "$INLINE_KEYFRAMES_HITS" -lt "$INLINE_KEYFRAMES_BASELINE" ]; then
  pass "Inline @keyframes outside aguila/portal: $INLINE_KEYFRAMES_HITS (was $INLINE_KEYFRAMES_BASELINE, improving ✓). Update INLINE_KEYFRAMES_BASELINE."
else
  warn "Inline @keyframes outside aguila/portal: $INLINE_KEYFRAMES_HITS (at baseline — next block should reduce)"
fi

# R8 — AguilaDataTable adoption (positive direction).
header "theme/v6 · <AguilaDataTable> adoption (target ↑)"
AGUILA_DT_BASELINE=${AGUILA_DT_BASELINE:-0}
AGUILA_DT_COUNT=$(set +eo pipefail;{ grep -rln "<AguilaDataTable" src/app 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$AGUILA_DT_COUNT" -lt "$AGUILA_DT_BASELINE" ]; then
  fail "<AguilaDataTable> usage regressed: $AGUILA_DT_COUNT (was $AGUILA_DT_BASELINE). Adoption should only grow."
elif [ "$AGUILA_DT_COUNT" -gt "$AGUILA_DT_BASELINE" ]; then
  pass "<AguilaDataTable> usage: $AGUILA_DT_COUNT (was $AGUILA_DT_BASELINE, growing ✓). Update AGUILA_DT_BASELINE."
else
  warn "<AguilaDataTable> usage: $AGUILA_DT_COUNT (at baseline — next list-page migration should advance)"
fi

# R9 — DetailPageShell adoption (positive direction).
header "theme/v6 · <DetailPageShell> adoption (target ↑)"
DETAIL_SHELL_BASELINE=${DETAIL_SHELL_BASELINE:-1}
DETAIL_SHELL_COUNT=$(set +eo pipefail;{ grep -rln "<DetailPageShell" src/app 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$DETAIL_SHELL_COUNT" -lt "$DETAIL_SHELL_BASELINE" ]; then
  fail "<DetailPageShell> usage regressed: $DETAIL_SHELL_COUNT (was $DETAIL_SHELL_BASELINE)."
elif [ "$DETAIL_SHELL_COUNT" -gt "$DETAIL_SHELL_BASELINE" ]; then
  pass "<DetailPageShell> usage: $DETAIL_SHELL_COUNT (was $DETAIL_SHELL_BASELINE, growing ✓). Update DETAIL_SHELL_BASELINE."
else
  warn "<DetailPageShell> usage: $DETAIL_SHELL_COUNT (at baseline)"
fi

# R10 — Aguila form primitive adoption (positive direction).
header "theme/v6 · AguilaInput/Select/Checkbox adoption (target ↑)"
AGUILA_FORM_BASELINE=${AGUILA_FORM_BASELINE:-0}
AGUILA_FORM_COUNT=$(set +eo pipefail;{ grep -rnE "<(AguilaInput|AguilaSelect|AguilaCheckbox)" src/app 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$AGUILA_FORM_COUNT" -lt "$AGUILA_FORM_BASELINE" ]; then
  fail "Aguila form primitives usage regressed: $AGUILA_FORM_COUNT (was $AGUILA_FORM_BASELINE)."
elif [ "$AGUILA_FORM_COUNT" -gt "$AGUILA_FORM_BASELINE" ]; then
  pass "Aguila form primitives usage: $AGUILA_FORM_COUNT (was $AGUILA_FORM_BASELINE, growing ✓). Update AGUILA_FORM_BASELINE."
else
  warn "Aguila form primitives usage: $AGUILA_FORM_COUNT (at baseline)"
fi

# --------------------------------------------------------------------------
# R11 — scripts/ financial rate hardcodes (enforced at zero).
# Complements the existing "Financial — Rates" ratchet (line ~194) which
# only scans src/. Baseline is 0 — any hardcoded rate in a cron/tool
# script is a SEV-2 against core-invariants rule 17. Route through
# scripts/lib/rates.js (getIVARate / getDTARates / getExchangeRate) with
# refuse-to-calculate semantics or move to system_config with a graceful
# skip for non-regulatory heuristics.
# Baseline ratcheted 4 → 0 on 2026-04-20 after the Tier 2 sweep
# (generate-invoice.js, cruz-mcp-server.js, cost-optimizer.js,
# lib/invoice-handlers.js). fx_savings_heuristic_pct migrated to
# system_config via 20260420_fx_savings_heuristic.sql.
# --------------------------------------------------------------------------
SCRIPTS_RATES_BASELINE=${SCRIPTS_RATES_BASELINE:-0}
header "Financial — scripts/ rate hardcodes ratchet (enforced at 0)"
SCRIPTS_RATES_COUNT=$(set +eo pipefail;{ grep -rnE "IVA_RATE\s*=\s*0\.1[56]|ivaRate\s*=\s*0\.1[56]|=\s*0\.008\b|fxSavingsPct\s*=" scripts/ --include="*.js" 2>/dev/null || true; } | grep -v node_modules | wc -l | tr -d ' ')
if [ "$SCRIPTS_RATES_COUNT" -gt "$SCRIPTS_RATES_BASELINE" ]; then
  fail "scripts/ rate hardcodes: $SCRIPTS_RATES_COUNT (baseline $SCRIPTS_RATES_BASELINE). New hardcoded rate in a cron/tool script — route through scripts/lib/rates.js or system_config."
else
  pass "scripts/ rate hardcodes: $SCRIPTS_RATES_COUNT (enforced at baseline 0)"
fi

# --------------------------------------------------------------------------
# R13 — scripts/ silent-catch ratchet (target ↓).
# The po-predictor class: `.catch(() => {})` or `.catch((err) => {})` in a
# cron/tool script swallows failures silently. core-invariants rule 18 and
# operational-resilience.md rule 1 forbid this — every failure must log to
# Supabase AND fire Telegram. Scope is `scripts/` only; src/ has legitimate
# fire-and-forget patterns (e.g., `void recordView()` audit logging in
# /mi-cuenta where the ethics contract explicitly allows swallowing render-
# path audit failures). Baseline 161 captures pre-existing drift; the
# ratchet refuses growth and nags toward cleanup.
# Ship date: 2026-04-19 night pre-Ursula stress pass.
# --------------------------------------------------------------------------
SCRIPTS_SILENT_CATCH_BASELINE=${SCRIPTS_SILENT_CATCH_BASELINE:-153}
header "Operational resilience — scripts/ silent-catch ratchet (target ↓)"
SCRIPTS_SILENT_CATCH_COUNT=$(set +eo pipefail;{ grep -rnE "\.catch\(\(\)\s*=>\s*\{\s*\}\)|\.catch\(\(\w+\)\s*=>\s*\{\s*\}\)" scripts/ --include="*.js" 2>/dev/null || true; } | grep -v node_modules | wc -l | tr -d ' ')
if [ "$SCRIPTS_SILENT_CATCH_COUNT" -gt "$SCRIPTS_SILENT_CATCH_BASELINE" ]; then
  fail "scripts/ silent .catch(() => {}): $SCRIPTS_SILENT_CATCH_COUNT (baseline $SCRIPTS_SILENT_CATCH_BASELINE). New silent swallow in a cron/tool script — log to sync_log + sendTelegram or re-throw. See core-invariants.md rule 18."
elif [ "$SCRIPTS_SILENT_CATCH_COUNT" -lt "$SCRIPTS_SILENT_CATCH_BASELINE" ]; then
  pass "scripts/ silent .catch(): $SCRIPTS_SILENT_CATCH_COUNT (baseline $SCRIPTS_SILENT_CATCH_BASELINE, improving ✓). Update SCRIPTS_SILENT_CATCH_BASELINE in this script."
else
  warn "scripts/ silent .catch(): $SCRIPTS_SILENT_CATCH_COUNT (at baseline — Tier 2 cleanup pending; see po-predictor.js:47 for reference fix pattern)"
fi

# --------------------------------------------------------------------------
# R12 — /mi-cuenta calm-tone ratchet (client-accounting-ethics.md §tone).
# The client A/R surface must never render traffic-light dunning colors
# or urgency language. Aging buckets use silver chrome; past-due invoices
# are labeled by days-since-emission, never by severity. Baseline = 0 is
# a hard invariant — any match is a SEV-2 regression against the ethical
# contract.
# Ship date: 2026-04-19 night pre-Ursula stress pass.
# --------------------------------------------------------------------------
MI_CUENTA_TONE_BASELINE=0
header "Tone — /mi-cuenta client surface calm-tone ratchet"
# Exclude JSX/block comments, JS line comments, and string-literal docs
# that MENTION the banned vocabulary to explain the rule. Real violations
# live in rendered text, class names, or conditionals — never in comments.
MI_CUENTA_TONE_HITS=$(set +eo pipefail;{ grep -rnE "portal-status-red|portal-status-amber|\bVENCIDO\b|\burgente\b|\bURGENTE\b|\boverdue\b" src/app/mi-cuenta/ 2>/dev/null || true; } | grep -vE "^[^:]*:[0-9]+:[[:space:]]*(//|\*|\{/\*)" | grep -v '"overdue"' | grep -v "'overdue'" | wc -l | tr -d ' ')
if [ "$MI_CUENTA_TONE_HITS" -gt "$MI_CUENTA_TONE_BASELINE" ]; then
  fail "/mi-cuenta tone violations: $MI_CUENTA_TONE_HITS (baseline $MI_CUENTA_TONE_BASELINE). Client A/R surface must stay calm silver — no red/amber, no VENCIDO/urgente/overdue. See .claude/rules/client-accounting-ethics.md §tone."
else
  pass "/mi-cuenta tone: clean (0 red/amber/urgente strings — ethical contract held)"
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
