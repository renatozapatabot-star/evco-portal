#!/usr/bin/env bash
# check-safe-writes.sh — warn-only drift detector for sync scripts.
#
# Flags any `.upsert(` or `.insert(` in scripts/ that isn't using
# safeUpsert / safeInsert from lib/safe-write.js. Exit 0 regardless —
# intended as informational output for pre-push review, not a blocker.
#
# Excludes: scripts/lib/, scripts/archive/, *.bak*, *.test.js.
#
# Wire-up: `npm run check:sync`

set -u

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPTS_DIR" || exit 0

hits=0
while IFS= read -r -d '' file; do
  rel="${file#./}"
  while IFS=: read -r line content; do
    # Skip if the same line already uses the wrapper
    if echo "$content" | grep -qE 'safeUpsert|safeInsert'; then
      continue
    fi
    # Skip comments (// or * prefix after optional whitespace)
    if echo "$content" | grep -qE '^[[:space:]]*(\*|//|/\*)'; then
      continue
    fi
    echo "  $rel:$line — bare Supabase write (use safeUpsert/safeInsert from ./lib/safe-write)"
    hits=$((hits + 1))
  done < <(grep -nE '\.(upsert|insert)\(' "$file" || true)
done < <(find . -maxdepth 1 -type f -name '*.js' \
  ! -name '*.bak*' ! -name '*.test.js' -print0)

if [ "$hits" -eq 0 ]; then
  echo "check-safe-writes: OK — no bare Supabase writes in top-level sync scripts"
else
  echo ""
  echo "check-safe-writes: $hits bare Supabase write(s) still present (warn-only, non-blocking)"
  echo "See scripts/lib/README.md for migration guidance."
fi

exit 0
