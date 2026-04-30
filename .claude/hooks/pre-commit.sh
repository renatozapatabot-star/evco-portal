#!/bin/bash
set -e
cd "$HOME/evco-portal"
echo "Pre-commit gates..."
npx tsc --noEmit 2>&1 | grep -c "error" | { read c; [ "$c" -eq 0 ] && echo "TypeScript" || { echo "TypeScript: $c errors"; exit 1; }; }
[ "$(grep -r 'CRUD' src/ 2>/dev/null | wc -l | tr -d ' ')" = "0" ] && echo "No CRUD" || { echo "CRUD found"; exit 1; }
[ "$(grep -rn "'9254'" src/app/ --include="*.tsx" 2>/dev/null | grep -v config | grep -v '__tests__' | grep -v '\.test\.' | wc -l | tr -d ' ')" = "0" ] && echo "No hardcoded IDs" || { echo "Hardcoded '9254' found"; exit 1; }
[ "$(grep -rn "[^.]alert(" src/ --include="*.tsx" 2>/dev/null | grep -v "//.*alert" | wc -l | tr -d ' ')" = "0" ] && echo "No alert()" || { echo "alert() found"; exit 1; }
[ "$(grep -rn "console\.log" src/app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')" = "0" ] && echo "No console.log" || { echo "console.log found"; exit 1; }
grep -q 'lang="es"' src/app/layout.tsx && echo "lang=es" || { echo "Missing lang=es"; exit 1; }
echo "All gates pass."
