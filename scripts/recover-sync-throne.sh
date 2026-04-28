#!/usr/bin/env bash
#
# scripts/recover-sync-throne.sh — operator-driven sync recovery on Throne.
#
# Use when Throne crashed/rebooted and you need to bring the sync stack
# back up + verify it. Independent of the Vercel-side staleness watchdog
# (`/api/cron/sync-watchdog`) which is the alerting layer; this is the
# recovery layer.
#
# Steps:
#   1. `pm2 resurrect`              — restore all 27 processes from dump
#   2. `pm2 reload --only globalpc-delta-sync` — kick the primary sync
#   3. `pm2 save`                   — capture current state
#   4. Poll `/api/health/data-integrity?tenant=evco` until verdict != red
#
# Exits non-zero if health stays red after the timeout.

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-https://portal.renatozapata.com/api/health/data-integrity?tenant=evco}"
POLL_TIMEOUT_SEC="${POLL_TIMEOUT_SEC:-180}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-15}"

log() { printf '[recover-sync-throne] %s\n' "$*"; }

log "1/4 pm2 resurrect (restoring from ~/.pm2/dump.pm2)"
pm2 resurrect

log "2/4 pm2 reload --only globalpc-delta-sync"
pm2 reload ecosystem.config.js --only globalpc-delta-sync || \
  log "warn: globalpc-delta-sync reload returned non-zero (process may not exist yet); continuing"

log "3/4 pm2 save"
pm2 save

log "4/4 polling ${HEALTH_URL} for verdict (timeout ${POLL_TIMEOUT_SEC}s)"
deadline=$(( $(date +%s) + POLL_TIMEOUT_SEC ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  body="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null || true)"
  verdict="$(printf '%s' "$body" | grep -oE '"verdict":"[a-z]+"' | head -1 | sed 's/.*"verdict":"\([a-z]*\)".*/\1/')"
  if [ -n "$verdict" ]; then
    log "  verdict=${verdict}"
    if [ "$verdict" != "red" ]; then
      log "done — sync verdict is ${verdict} (acceptable)"
      exit 0
    fi
  else
    log "  (no verdict yet — endpoint may be warming up)"
  fi
  sleep "$POLL_INTERVAL_SEC"
done

log "FAIL — verdict still red after ${POLL_TIMEOUT_SEC}s. Check pm2 logs + Telegram."
exit 1
