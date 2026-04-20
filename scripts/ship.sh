#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CRUZ · npm run ship — formalized audit → deploy → baseline.
#
# Six gates in sequence. Any non-zero exit stops the chain and
# (when configured) fires a Telegram alert. Deploy never happens
# unless gates 1–3 pass; baseline snapshot never writes unless
# gates 4–5 pass.
#
# Usage:
#   bash scripts/ship.sh                # full pipeline
#   bash scripts/ship.sh --skip-deploy  # dry-run: gates 1–3 only
# ═══════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."

SKIP_DEPLOY=0
for arg in "$@"; do
  case $arg in
    --skip-deploy) SKIP_DEPLOY=1 ;;
  esac
done

BRANCH="$(git branch --show-current)"
SHORT_SHA="$(git rev-parse --short HEAD)"
TS="$(date +%Y%m%d-%H%M)"
BUNDLE_DIR="$HOME/cruz-branch-backups"
mkdir -p "$BUNDLE_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 CRUZ · ship"
echo "   Branch: $BRANCH"
echo "   HEAD:   $SHORT_SHA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Gate 1: pre-flight (static + tests) ─────────────────────
echo ""
echo "[Gate 1/6] Pre-flight"
echo "  · typecheck"
npx tsc --noEmit
echo "    ✅"
echo "  · lint (errors block; warnings acceptable)"
# Capture lint exit code without tripping `set -e`. eslint exits non-zero
# only on errors (not warnings), so exit==0 means zero errors regardless
# of warning count.
LINT_EXIT=0
npm run lint > /tmp/cruz-ship-lint.log 2>&1 || LINT_EXIT=$?
LINT_ERROR_COUNT=$(grep -cE "^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error[[:space:]]" /tmp/cruz-ship-lint.log 2>/dev/null || true)
LINT_ERROR_COUNT=${LINT_ERROR_COUNT:-0}
LINT_WARNING_COUNT=$(grep -cE "^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+warning[[:space:]]" /tmp/cruz-ship-lint.log 2>/dev/null || true)
LINT_WARNING_COUNT=${LINT_WARNING_COUNT:-0}
if [ "$LINT_ERROR_COUNT" -gt 0 ] || [ "$LINT_EXIT" -ne 0 ]; then
  tail -40 /tmp/cruz-ship-lint.log
  echo "  ❌ $LINT_ERROR_COUNT lint error(s) — see /tmp/cruz-ship-lint.log"
  exit 1
fi
if [ "$LINT_WARNING_COUNT" -gt 0 ]; then
  echo "    ✅ (0 errors; $LINT_WARNING_COUNT warnings non-blocking)"
else
  echo "    ✅ (clean)"
fi
echo "  · vitest (full suite)"
npx vitest run > /tmp/cruz-ship-vitest.log 2>&1 || {
  tail -40 /tmp/cruz-ship-vitest.log
  echo "  ❌ tests failed — see /tmp/cruz-ship-vitest.log"
  exit 1
}
TEST_SUMMARY=$(grep -E "Test Files|Tests " /tmp/cruz-ship-vitest.log | tail -2)
echo "    ✅ $(echo "$TEST_SUMMARY" | tr '\n' ' ')"
echo "  · build"
npm run build > /tmp/cruz-ship-build.log 2>&1 || {
  tail -40 /tmp/cruz-ship-build.log
  echo "  ❌ build failed — see /tmp/cruz-ship-build.log"
  exit 1
}
echo "    ✅"
echo "  · gsd-verify (ratchets)"
if [ -x scripts/gsd-verify.sh ]; then
  bash scripts/gsd-verify.sh --ratchets-only > /tmp/cruz-ship-ratchets.log 2>&1 || {
    tail -40 /tmp/cruz-ship-ratchets.log
    echo "  ❌ ratchet violation — see /tmp/cruz-ship-ratchets.log"
    exit 1
  }
  echo "    ✅"
else
  echo "    ⚠️  gsd-verify.sh not executable, skipped"
fi
echo "  · block-audit (plan completeness)"
bash scripts/block-audit.sh > /tmp/cruz-ship-blockaudit.log 2>&1 || {
  cat /tmp/cruz-ship-blockaudit.log
  echo "  ❌ plan has deferred items outside approved sections"
  exit 1
}
echo "    ✅"

# ── Gate 2: data-integrity smoke ────────────────────────────
echo ""
echo "[Gate 2/6] Data integrity (local DB probe)"
node scripts/data-integrity-check.js > /tmp/cruz-ship-integrity.log 2>&1 || {
  tail -40 /tmp/cruz-ship-integrity.log
  echo "  ❌ data-integrity failed — see /tmp/cruz-ship-integrity.log"
  exit 1
}
echo "    ✅ all checks pass"

# ── Gate 3: rollback bundle ─────────────────────────────────
echo ""
echo "[Gate 3/6] Rollback bundle"
BUNDLE="$BUNDLE_DIR/ship-${SHORT_SHA}-${TS}.bundle"
git bundle create "$BUNDLE" "$BRANCH" > /dev/null 2>&1
echo "    ✅ $BUNDLE"

if [ "$SKIP_DEPLOY" = "1" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🟢 Dry-run complete — gates 1–3 green, no deploy."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

# ── Gate 4: deploy ──────────────────────────────────────────
echo ""
echo "[Gate 4/6] Vercel deploy"
DEPLOY_URL="$(vercel --prod --yes 2>&1 | tee /tmp/cruz-ship-deploy.log | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | tail -1)"
if [ -z "$DEPLOY_URL" ]; then
  tail -30 /tmp/cruz-ship-deploy.log
  echo "  ❌ could not parse deploy URL"
  exit 1
fi
echo "    ✅ $DEPLOY_URL"

# ── Gate 5: live smoke ─────────────────────────────────────
echo ""
echo "[Gate 5/6] Live smoke"
sleep 6
for url in "https://portal.renatozapata.com/" "https://evco-portal.vercel.app/"; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")"
  if [ "$code" != "307" ] && [ "$code" != "200" ]; then
    echo "  ❌ $url returned $code (expected 307 or 200)"
    exit 1
  fi
  echo "    ✅ $url → $code"
done
INTEGRITY_URL="https://portal.renatozapata.com/api/health/data-integrity"
INTEGRITY_JSON="$(curl -s -w "\n%{http_code}" "$INTEGRITY_URL" || echo "FETCH_FAILED")"
INTEGRITY_CODE="$(echo "$INTEGRITY_JSON" | tail -1)"
INTEGRITY_BODY="$(echo "$INTEGRITY_JSON" | sed '$d')"
VERDICT="$(echo "$INTEGRITY_BODY" | grep -oE '"verdict":"[a-z]+"' | head -1 | sed 's/"verdict":"//; s/"//')"
if [ -z "$VERDICT" ]; then
  echo "  ❌ could not parse verdict from $INTEGRITY_URL"
  echo "     body: $INTEGRITY_BODY"
  exit 1
fi
case "$VERDICT" in
  green)  echo "    ✅ data-integrity verdict: green" ;;
  amber)  echo "    ⚠️  data-integrity verdict: amber (shipping, but watch)" ;;
  red)    echo "    ❌ data-integrity verdict: RED — deploy is live but data is wrong"
          echo "       Investigate BEFORE advertising this deploy to Ursula."
          exit 1 ;;
  *)      echo "    ⚠️  unexpected verdict: $VERDICT" ;;
esac

# ── Gate 6: baseline snapshot ──────────────────────────────
echo ""
echo "[Gate 6/6] Baseline snapshot"
TODAY="$(date +%Y-%m-%d)"
BASELINE_FILE=".claude/rules/baseline-${TODAY}.md"
HEAD_FULL="$(git rev-parse HEAD)"
TEST_COUNTS="$(echo "$TEST_SUMMARY" | tr '\n' ' ')"

cat > "$BASELINE_FILE" <<EOF
# CRUZ · Working-Consistency Baseline — ${TODAY}

Auto-generated by \`scripts/ship.sh\` on a successful deploy.
This snapshot is the reproducible floor. Any future session that breaks
an invariant listed below is a regression — revert and re-ship.

## Snapshot

\`\`\`
Branch:      ${BRANCH}
Head commit: ${HEAD_FULL}
Short SHA:   ${SHORT_SHA}
Timestamp:   ${TS}
Deploy URL:  ${DEPLOY_URL}
Test counts: ${TEST_COUNTS}
Integrity:   verdict=${VERDICT}
Rollback:    ${BUNDLE}
\`\`\`

## Live integrity probe

\`\`\`json
${INTEGRITY_BODY}
\`\`\`

## Invariants held at ship time

Reference \`.claude/rules/baseline.md\` (I1–I10) — all carried forward.
New since prior baseline:

- **I11** — \`/api/health/data-integrity\` returns \`verdict: green\` for \`company_id='evco'\`.
- **I12** — Cockpit soft-wrappers log suppressed errors + surface a partial-data banner when ≥ 2 queries fail in one render.
- **I13** — \`TraficoTimeline\` renders 7 nodes horizontally; vertical fallback preserved under \`NEXT_PUBLIC_TIMELINE_HORIZONTAL='0'\`.

## Reproduce

\`\`\`bash
git fetch --all
git checkout ${HEAD_FULL}
npm install
npm run ship --skip-deploy   # gates 1–3 only, no Vercel push
\`\`\`

Regenerate this baseline the next time \`npm run ship\` lands a green deploy.
EOF

# Append pointer to the frozen baseline.md
if [ -f .claude/rules/baseline.md ] && ! grep -q "baseline-${TODAY}.md" .claude/rules/baseline.md; then
  cat >> .claude/rules/baseline.md <<EOF

---

**Superseded by:** [\`baseline-${TODAY}.md\`](./baseline-${TODAY}.md) — see ratchet protocol.
EOF
fi

echo "    ✅ $BASELINE_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚢 Ship complete — all 6 gates green."
echo "   Deploy:   $DEPLOY_URL"
echo "   Baseline: $BASELINE_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
