#!/bin/bash
#
# scripts/check-migration-filename.sh
#
# Reject migration files whose filename does NOT match the canonical
# YYYYMMDDHHMMSS_descriptive_name.sql shape.
#
# Why this exists:
#
#   The Supabase CLI normalizes bare-date filenames (e.g.
#   `20260422_cruz_ai_conversations.sql`) inconsistently between
#   `migration list --linked`'s local-vs-remote diff and `migration
#   repair --status applied`. The CLI sees the local file as
#   version `20260422` AND the remote ledger row as version
#   `20260422`, but treats them as DIFFERENT versions during diff —
#   producing perpetual orphan rows on both sides that no `migration
#   repair` can permanently fix.
#
#   The only reliable fix is to keep the canonical 14-digit timestamp
#   shape on every filename. This guard prevents that pattern from
#   recurring.
#
# Usage (manual):
#   bash scripts/check-migration-filename.sh
#   → exits 0 on clean tree, 1 on any bare-date / malformed filename
#
# Usage (pre-commit hook — wiring is a separate decision):
#   Add to .husky/pre-commit OR scripts/founder-check.sh as a sub-step.
#   Renato approves the wiring; this PR ships the script only.
#
# Usage (pre-push hook — recommended):
#   Same script, called from .husky/pre-push, scoped to changed
#   files in supabase/migrations/.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: $MIGRATIONS_DIR does not exist."
  exit 1
fi

# Canonical pattern: 14 digits + underscore + lowercase-letters-and-digits-and-underscores + .sql
CANONICAL_PATTERN='^[0-9]{14}_[a-z0-9_]+\.sql$'

violations=0
total=0

for path in "$MIGRATIONS_DIR"/*.sql; do
  [[ -e "$path" ]] || continue   # handle empty dir gracefully
  total=$((total + 1))
  base="$(basename "$path")"
  if ! [[ "$base" =~ $CANONICAL_PATTERN ]]; then
    if [[ $violations -eq 0 ]]; then
      echo "❌ Migration filename violations:"
      echo ""
    fi
    violations=$((violations + 1))
    echo "  $base"
    # Suggest a fix
    if [[ "$base" =~ ^([0-9]{8})_(.*)$ ]]; then
      now_hms="$(date +%H%M%S)"
      suggested="${BASH_REMATCH[1]}${now_hms}_${BASH_REMATCH[2]}"
      echo "    → Suggested rename: $suggested"
    fi
  fi
done

if [[ $violations -gt 0 ]]; then
  echo ""
  echo "Found $violations of $total files violating the canonical pattern."
  echo ""
  echo "Canonical:  YYYYMMDDHHMMSS_descriptive_name.sql"
  echo "Example:    20260422160732_cruz_ai_conversations.sql"
  echo ""
  echo "Bare-date filenames (e.g. 20260422_*.sql) cause perpetual orphan"
  echo "rows in supabase/schema_migrations that 'migration repair' cannot"
  echo "fix. Rename to the canonical 14-digit shape using the suggested"
  echo "names above (or any HMMSS that doesn't conflict with an existing"
  echo "filename for the same date)."
  echo ""
  echo "Reference: ~/Desktop/migration-ledger-cleanup-plan-2026-05-06.md"
  echo "           sections C2 (Anti-pattern 1) and C5 (rename procedure)."
  exit 1
fi

echo "✓ $total migration filenames match the canonical YYYYMMDDHHMMSS_*.sql pattern."
exit 0
