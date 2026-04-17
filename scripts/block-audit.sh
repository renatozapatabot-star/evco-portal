#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CRUZ · block-audit.sh — enforce plan completeness before ship.
#
# Runs inside ship.sh gate 1. Scans the active plan file for
# UNCHECKED TODO markers outside approved-deferral sections.
#
# What counts as deferred:
#   · "- [ ]" unchecked checkbox (markdown task list)
#   · Line-leading "TODO: " (with space after colon)
#
# What does NOT count:
#   · The word "deferred" in prose (too noisy).
#   · Anything under a heading containing: "Out of scope",
#     "Deferred (user-approved)", "Known issues", "Nothing deferred".
# ═══════════════════════════════════════════════════════════════
set -e

PLAN_DIR="${HOME}/.claude/plans"
PLAN=$(ls -t "${PLAN_DIR}"/*.md 2>/dev/null | head -1)

if [ -z "$PLAN" ]; then
  echo "[block-audit] no plan file in $PLAN_DIR — skipping"
  exit 0
fi

echo "[block-audit] scanning $PLAN"

DEFER_COUNT=$(awk '
  BEGIN { in_approved = 0; count = 0 }
  /^## / {
    if ($0 ~ /Out of scope|Deferred \(user-approved\)|Known issues|Nothing deferred/) {
      in_approved = 1
    } else {
      in_approved = 0
    }
    next
  }
  !in_approved && /^\s*-\s\[ \]/ { count++ }
  !in_approved && /^\s*TODO:\s/ { count++ }
  END { print count }
' "$PLAN")

if [ "$DEFER_COUNT" -gt 0 ]; then
  echo "  ❌ $DEFER_COUNT unchecked TODO marker(s) found in plan"
  echo "     Either complete them OR move them under an 'Out of scope' / 'Known issues' heading."
  echo "     Plan: $PLAN"
  exit 1
fi

echo "  ✅ plan is complete — no silent deferrals"
exit 0
