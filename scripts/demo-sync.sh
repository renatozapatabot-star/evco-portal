#!/bin/bash
# ═══════════════════════════════════════════════════════
# CRUZ Demo Sync — run before any client demo
# Ensures EVCO + MAFESA data is fresh from all sources
#
# Usage: cd ~/evco-portal && bash scripts/demo-sync.sh
# Must run on Throne (Mac Studio) where credentials live
# ═══════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")/.."

echo ""
echo "══════════════════════════════════════════"
echo "  CRUZ Demo Sync — $(date '+%Y-%m-%d %H:%M')"
echo "══════════════════════════════════════════"
echo ""

# 1. GlobalPC delta sync (incremental — fast)
echo "🔄 [1/4] GlobalPC delta sync..."
if node scripts/globalpc-delta-sync.js 2>&1 | tail -3; then
  echo "✅ GlobalPC delta sync complete"
else
  echo "⚠️  GlobalPC delta sync had issues (continuing...)"
fi
echo ""

# 2. Aduanet scraper (pedimentos + contributions)
echo "🔄 [2/4] Aduanet scraper..."
if node scripts/aduanet-scraper.js 2>&1 | tail -3; then
  echo "✅ Aduanet scraper complete"
else
  echo "⚠️  Aduanet scraper had issues (continuing...)"
fi
echo ""

# 3. Full client sync (linkage + supplier resolution)
echo "🔄 [3/4] Full client sync (EVCO + MAFESA)..."
if node scripts/full-client-sync.js 2>&1 | tail -3; then
  echo "✅ Full client sync complete"
else
  echo "⚠️  Full client sync had issues (continuing...)"
fi
echo ""

# 4. Regression guard (verify data quality)
echo "🔄 [4/4] Regression guard..."
if node scripts/regression-guard.js 2>&1 | tail -3; then
  echo "✅ Regression guard passed"
else
  echo "⚠️  Regression guard flagged issues — check logs"
fi
echo ""

echo "══════════════════════════════════════════"
echo "  ✅ Demo sync complete — $(date '+%H:%M')"
echo "  Portal: https://evco-portal.vercel.app"
echo "  EVCO:   evco2026"
echo "  MAFESA: mafesa2026"
echo "══════════════════════════════════════════"
echo ""
