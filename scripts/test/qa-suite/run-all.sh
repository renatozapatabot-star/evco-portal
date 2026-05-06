#!/usr/bin/env bash
#
# scripts/test/qa-suite/run-all.sh
#
# QA suite orchestrator. Runs every probe in scripts/test/qa-suite/
# and aggregates results.
#
# Tonight's first probe: 01-tenant-isolation-probe.mjs.
# Future additions per ~/Desktop/qa-suite-plan-2026-05-06.md B4:
#   02-anon-read-probe.mjs
#   03-cookie-forgery-probe.mjs
#   04-bearer-secret-probe.mjs
#   05-schema-integrity-probe.mjs
#   06-rate-limit-probe.mjs
#
# Each probe:
#   - Reads env vars (BASE_URL, CLIENT_SESSION, etc.)
#   - Writes a JSON report to /tmp/qa-suite-results/
#   - Exits 0 on all-pass, 1 on any failure
#
# This script:
#   - Calls each probe in turn
#   - Tracks pass/fail per probe
#   - Exits non-zero if any probe failed
#
# Usage:
#   BASE_URL=https://portal.renatozapata.com \
#   CLIENT_SESSION='<portal_session cookie>' \
#   bash scripts/test/qa-suite/run-all.sh
#
# Optional:
#   DRY_RUN=1   # build URLs but don't fetch (smoke test the suite itself)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-flight env check (mirror of probe-level checks for fail-fast)
: "${BASE_URL:?BASE_URL env var is required (e.g. https://portal.renatozapata.com)}"
if [[ "${DRY_RUN:-0}" != "1" && -z "${CLIENT_SESSION:-}" ]]; then
  echo "ERROR: CLIENT_SESSION required (or set DRY_RUN=1 for smoke test)" >&2
  exit 2
fi

mkdir -p /tmp/qa-suite-results

PROBES=(
  "$SCRIPT_DIR/01-tenant-isolation-probe.mjs"
)

TOTAL=0
FAILED=0

echo "# QA suite — running ${#PROBES[@]} probe(s) against $BASE_URL"
echo ""

for probe in "${PROBES[@]}"; do
  TOTAL=$((TOTAL + 1))
  echo "── Running $(basename "$probe") ──────────────────────────"
  if node "$probe"; then
    echo ""
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ Probe failed"
    echo ""
  fi
done

echo "════════════════════════════════════════════"
echo "# QA suite summary: $((TOTAL - FAILED))/$TOTAL probes passed"
echo "# Reports:          /tmp/qa-suite-results/"
echo "════════════════════════════════════════════"

exit $FAILED
