#!/bin/bash
# ============================================================================
# Ratchet bump advisor — CRUZ / PORTAL
# ============================================================================
# Runs gsd-verify.sh --ratchets-only, scans for "improving ✓" pass messages,
# and prints the sed commands to bump each baseline that's been beaten.
#
# The ratchets only ever tighten — "improving" signals measurable drift
# closure that should become the new floor. This script surfaces them in
# one place so bumps don't drift into forgotten WARN territory.
#
# Usage:
#   bash scripts/ratchet-bump-advisor.sh        # print advised bumps
#   bash scripts/ratchet-bump-advisor.sh --apply  # write the bumps in place
# ============================================================================

set -euo pipefail

APPLY=0
for arg in "$@"; do
  [ "$arg" = "--apply" ] && APPLY=1
done

cd "$(dirname "$0")/.."

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

echo "Running ratchets..."
bash scripts/gsd-verify.sh --ratchets-only > "$TMP" 2>&1 || true

# Parse pass lines that invite a baseline bump.
# Example lines:
#   ✅ PASS: Hardcoded hex: 619 (baseline 662, improving ✓). Update INVARIANT_HEX_BASELINE.
#   ✅ PASS: Gold hex violations: 11 (baseline 12, improving ✓). Update INVARIANT_2_BASELINE in this script.
#   ✅ PASS: @/components/portal imports: 8 (was 6, growing ✓). Update PORTAL_IMPORT_BASELINE in this script.

BUMPS_FILE=$(mktemp)
trap 'rm -f "$TMP" "$BUMPS_FILE"' EXIT
grep -E "PASS:.*\((baseline|was) [0-9]+.*✓\).*Update [A-Z_][A-Z0-9_]*" "$TMP" > "$BUMPS_FILE" || true

BUMP_COUNT=$(wc -l < "$BUMPS_FILE" | tr -d ' ')
if [ "$BUMP_COUNT" = "0" ]; then
  echo ""
  echo "No ratchet baselines need bumping. All ratchets at their current floor."
  exit 0
fi

echo ""
echo "Ratchets that beat their baseline (ready to lock in):"
echo "======================================================"

ADVICE_FILE=$(mktemp)
trap 'rm -f "$TMP" "$BUMPS_FILE" "$ADVICE_FILE"' EXIT
while IFS= read -r line; do
  # Extract current value
  CUR=$(echo "$line" | grep -oE ": [0-9]+ \(" | head -1 | grep -oE "[0-9]+")
  # Extract the baseline variable name
  VAR=$(echo "$line" | grep -oE "Update [A-Z_][A-Z0-9_]*" | awk '{print $2}')
  # Extract the prior baseline
  OLD=$(echo "$line" | grep -oE "(baseline|was) [0-9]+" | grep -oE "[0-9]+")

  if [ -n "$CUR" ] && [ -n "$VAR" ] && [ -n "$OLD" ]; then
    echo "  $VAR: $OLD → $CUR"
    echo "$VAR=$CUR" >> "$ADVICE_FILE"
  fi
done < "$BUMPS_FILE"

if [ "$APPLY" = "1" ]; then
  echo ""
  echo "Applying bumps to scripts/gsd-verify.sh..."
  while IFS= read -r item; do
    VAR="${item%%=*}"
    NEW="${item##*=}"
    # Match either `VAR=N` or `VAR=${VAR:-N}` patterns.
    sed -i.bak -E "s/^(${VAR}=)[0-9]+/\1${NEW}/;s/^(${VAR}=\\\$\\{${VAR}:-)[0-9]+/\1${NEW}/" scripts/gsd-verify.sh
  done < "$ADVICE_FILE"
  rm -f scripts/gsd-verify.sh.bak
  echo "Done. Review with: git diff scripts/gsd-verify.sh"
else
  echo ""
  echo "To apply: bash scripts/ratchet-bump-advisor.sh --apply"
fi
