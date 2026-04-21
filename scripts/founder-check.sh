#!/usr/bin/env bash
# Founder-override guard — advisory for SOFT invariants, blocking for HARD.
# Codified 2026-04-19 per .claude/rules/founder-overrides.md
#
# Usage (manual):  bash scripts/founder-check.sh
# Usage (hook):    git config core.hooksPath .githooks
#                  (script is a candidate for prepare-commit-msg wiring)

set -u  # no -e; we handle exit codes explicitly

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# HARD-invariant watched paths — touching these without explicit override blocks.
HARD_PATHS=(
  "src/lib/rates.ts"
  "src/lib/audit.ts"
  "scripts/globalpc-sync.js"
  "scripts/globalpc-delta-sync.js"
  "scripts/tenant-reassign-company-id.js"
  ".claude/rules/tenant-isolation.md"
)
HARD_PATTERNS=(
  "supabase/migrations/.*_rls_.*\\.sql"
  "supabase/migrations/.*ENABLE ROW LEVEL SECURITY"
)

# SOFT-invariant watched paths — touching these without a matching override
# log entry emits a warning (non-blocking).
SOFT_PATHS=(
  "src/lib/cockpit/nav-tiles.ts"
  ".claude/rules/baseline.md"
  ".claude/rules/core-invariants.md"
)

# Files in the staged diff
STAGED=$(git diff --cached --name-only 2>/dev/null)
if [ -z "$STAGED" ]; then
  # No staged changes — run against working tree diff for manual invocation
  STAGED=$(git diff --name-only 2>/dev/null)
fi

if [ -z "$STAGED" ]; then
  echo -e "${GREEN}founder-check: no changes to evaluate${NC}"
  exit 0
fi

HARD_HIT=0
SOFT_HIT=0
HARD_FILES=""
SOFT_FILES=""

for f in $STAGED; do
  for p in "${HARD_PATHS[@]}"; do
    if [ "$f" = "$p" ]; then
      HARD_HIT=1
      HARD_FILES="$HARD_FILES $f"
    fi
  done
  for p in "${SOFT_PATHS[@]}"; do
    if [ "$f" = "$p" ]; then
      SOFT_HIT=1
      SOFT_FILES="$SOFT_FILES $f"
    fi
  done
done

# Check commit message for HARD override (if in hook context)
COMMIT_MSG_FILE="${1:-}"
COMMIT_MSG=""
if [ -n "$COMMIT_MSG_FILE" ] && [ -f "$COMMIT_MSG_FILE" ]; then
  COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
fi

# Check override log for today's date (soft-override signal)
TODAY=$(date +%Y-%m-%d)
OVERRIDE_LOG=".claude/rules/founder-overrides.md"
HAS_TODAY_ENTRY=0
if [ -f "$OVERRIDE_LOG" ]; then
  if grep -q "^${TODAY} · " "$OVERRIDE_LOG" 2>/dev/null; then
    HAS_TODAY_ENTRY=1
  fi
fi

# HARD gate
if [ $HARD_HIT -eq 1 ]; then
  if echo "$COMMIT_MSG" | grep -q "FOUNDER_HARD_OVERRIDE:"; then
    echo -e "${YELLOW}founder-check: HARD invariant touched with explicit override${NC}"
    echo "  files:$HARD_FILES"
    echo "  override present in commit message"
  else
    echo -e "${RED}founder-check: BLOCKED — HARD invariant touched without explicit override${NC}"
    echo "  files:$HARD_FILES"
    echo ""
    echo "  These files govern tenant isolation, financial safety, or audit trails."
    echo "  To proceed, add to the commit message (trailer):"
    echo ""
    echo "    FOUNDER_HARD_OVERRIDE: <one-line reason + dual sign-off reference>"
    echo ""
    echo "  Or revert the change. Reference: .claude/rules/founder-overrides.md"
    exit 1
  fi
fi

# SOFT gate
if [ $SOFT_HIT -eq 1 ]; then
  if [ $HAS_TODAY_ENTRY -eq 1 ]; then
    echo -e "${GREEN}founder-check: SOFT invariant touched + override log has today's entry — OK${NC}"
    echo "  files:$SOFT_FILES"
  else
    echo -e "${YELLOW}founder-check: WARNING — SOFT invariant touched without today's override log entry${NC}"
    echo "  files:$SOFT_FILES"
    echo ""
    echo "  Consider adding an entry to .claude/rules/founder-overrides.md"
    echo "  This warning does NOT block the commit."
  fi
fi

if [ $HARD_HIT -eq 0 ] && [ $SOFT_HIT -eq 0 ]; then
  echo -e "${GREEN}founder-check: no invariant paths touched — clean${NC}"
fi

exit 0
