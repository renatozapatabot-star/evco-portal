#!/bin/bash
# CRUZ Pre-Deploy Verification Suite
# Run before every `vercel --prod`: bash scripts/pre-deploy.sh
set -e
cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 CRUZ Pre-Deploy Gates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1/4 TypeScript..."
npx tsc --noEmit
echo "  ✅ TypeScript clean"

echo "2/4 Build..."
npm run build > /dev/null 2>&1
echo "  ✅ Build passes"

echo "3/4 Data integrity..."
node scripts/data-integrity-check.js
echo "  ✅ Data integrity verified"

echo "4/4 Grep checks..."
[ "$(grep -r 'CRUD' src/ 2>/dev/null | wc -l | tr -d ' ')" = "0" ] && echo "  ✅ No CRUD" || { echo "  ❌ CRUD found"; exit 1; }
[ "$(grep -rn "'9254'" src/app/ --include="*.tsx" 2>/dev/null | grep -v config | grep -v '__tests__' | grep -v '\.test\.' | wc -l | tr -d ' ')" = "0" ] && echo "  ✅ No hardcoded IDs" || { echo "  ❌ Hardcoded '9254'"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL GATES PASS — safe to deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
