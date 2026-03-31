#!/bin/bash
LOG="/tmp/cruz-overnight-$(date +%Y%m%d-%H%M%S).log"
cd "$HOME/evco-portal"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

tg() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"-5085543275\",\"text\":\"$1\",\"parse_mode\":\"HTML\"}" > /dev/null
}

gates() {
  local f=0
  grep -rn "operaciónes" src/app/ --include="*.tsx" 2>/dev/null | grep -q . && { log "❌ G1 typos"; f=$((f+1)); } || log "✅ G1"
  grep -rn "alert(" src/ --include="*.tsx" 2>/dev/null | grep -q . && { log "❌ G2 alert()"; f=$((f+1)); } || log "✅ G2"
  grep -rn "'9254'" src/app/ --include="*.tsx" 2>/dev/null | grep -v config | grep -q . && { log "❌ G3 hardcoded"; f=$((f+1)); } || log "✅ G3"
  grep -r "CRUD" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -q . && { log "❌ G4 CRUD"; f=$((f+1)); } || log "✅ G4"
  npx tsc --noEmit >> "$LOG" 2>&1 && log "✅ G5 TypeScript" || { log "❌ G5 TypeScript"; f=$((f+1)); }
  npm run build >> "$LOG" 2>&1 && log "✅ G6 Build" || { log "❌ G6 Build"; f=$((f+1)); }
  echo $f
}

deploy() {
  log "Deploying $1..."
  vercel --prod >> "$LOG" 2>&1 || { tg "🔴 $1 deploy failed — rollback"; vercel rollback --yes >> "$LOG" 2>&1; exit 1; }
  sleep 15
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://evco-portal.vercel.app)
  [[ "$STATUS" == "200" || "$STATUS" == "307" ]] && log "✅ Portal: $STATUS" || { tg "🔴 Portal $STATUS — rollback"; vercel rollback --yes >> "$LOG" 2>&1; exit 1; }
  tg "✅ <b>$1 deployed</b>"
}

log "🚀 CRUZ overnight build starting"
tg "🚀 <b>CRUZ overnight build starting</b>"

# ── BUILD 1 ──────────────────────────────────────────────────
log "═══ BUILD 1: DESIGN SPRINT ═══"
tg "🎨 <b>Build 1: Design Sprint starting</b>"

git add -A && git commit -m "checkpoint: pre-build-1 $(date)" --allow-empty >> "$LOG" 2>&1

/opt/homebrew/bin/claude --print "
Read src/app/globals.css and src/app/ directory.

FIX 1 — Remove dead .icon-rail CSS block from globals.css
FIX 2 — Replace #C9A84C as text color with #8B6914 everywhere in src/
FIX 3 — Replace all minHeight 44 with 60 except StatusStrip desktop
FIX 4 — Hide metric cards that show null/undefined (wrap in conditional render)
FIX 5 — Create src/components/ui/Skeleton.tsx with shimmer animation
FIX 6 — Create src/components/ui/CountingNumber.tsx with IntersectionObserver, fires once, ease-out cubic, var(--font-mono)
         Replace main dashboard KPI numbers with CountingNumber

After all fixes: npm run typecheck && npm run build
git add -A && git commit -m 'design: contrast, touch targets, skeleton, counting numbers'
" 2>&1 | tee -a "$LOG"

FAILED=$(gates 2>/dev/null | tail -1)
log "Build 1 gates: $FAILED failures"
deploy "Build 1 (Design)"
sleep 30

# ── BUILD 2 ──────────────────────────────────────────────────
log "═══ BUILD 2: FEATURES SPRINT ═══"
tg "⚙️ <b>Build 2: Features Sprint starting</b>"

/opt/homebrew/bin/claude --print "
Read CRUZ_COMPLETE_VISION.md if present, otherwise read CLAUDE.md.

FEATURE 1 — Entrada lifecycle table:
Create via supabase client in a migration or direct SQL:
CREATE TABLE IF NOT EXISTS entradas_bodega (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrada_number TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL,
  trafico_id TEXT,
  supplier TEXT,
  bultos INTEGER,
  peso_bruto NUMERIC,
  warehouse_received_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'en_bodega',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE entradas_bodega ENABLE ROW LEVEL SECURITY;
CREATE POLICY entradas_all ON entradas_bodega FOR ALL USING (true);

FEATURE 2 — Clickable dashboard stats:
In src/app/page.tsx wrap KPI numbers in Next.js Link:
Detenidos → /traficos?estatus=Detenido
Demorados → /traficos?estatus=Demorado
En ruta   → /traficos?estatus=En Proceso
In src/app/traficos/page.tsx read estatus URL param and filter query.

FEATURE 3 — Sticky action bar on tráfico detail:
In src/app/traficos/[id]/page.tsx add scroll listener.
Show sticky bar after 200px with tráfico number + solicitar button.
Opacity transition 0→1 over 200ms.

FEATURE 4 — Pending entradas card:
In src/app/page.tsx query entradas_bodega WHERE trafico_id IS NULL.
Show card only if count > 0. Hide if empty.

After all features: npm run typecheck && npm run build
git add -A && git commit -m 'feat: entrada lifecycle, clickable stats, sticky bar'
" 2>&1 | tee -a "$LOG"

FAILED=$(gates 2>/dev/null | tail -1)
log "Build 2 gates: $FAILED failures"
deploy "Build 2 (Features)"
sleep 30

# ── BUILD 3: AUDIT LOOP ──────────────────────────────────────
log "═══ BUILD 3: AUDIT LOOP ═══"
tg "🔍 <b>Build 3: Audit loop starting</b>"

for round in 1 2 3 4 5; do
  FAILED=$(gates 2>/dev/null | tail -1)
  log "Audit round $round: $FAILED failures"

  [[ "$FAILED" -eq 0 ]] && {
    tg "✅ <b>All gates pass — round $round</b>"
    break
  }

  tg "⚠️ <b>Round $round: $FAILED failures — fixing</b>"

  ISSUES=$(
    grep -rn "operaciónes" src/app/ --include="*.tsx" 2>/dev/null | head -5
    grep -rn "alert(" src/ --include="*.tsx" 2>/dev/null | head -5
    grep -rn "'9254'" src/app/ --include="*.tsx" 2>/dev/null | grep -v config | head -5
  )

  /opt/homebrew/bin/claude --print "
Fix these specific issues (format file:line:code):
$ISSUES

Rules:
- Spanish typos: fix spelling
- alert(): replace with toast.error() or toast.success()
- '9254' literal: replace with COMPANY_ID from config

Fix only these lines. Then: npm run typecheck && npm run build
" 2>&1 | tee -a "$LOG"

  NEW_FAILED=$(gates 2>/dev/null | tail -1)
  if [[ "$NEW_FAILED" -lt "$FAILED" ]]; then
    git add -A && git commit -m "audit round $round: $((FAILED-NEW_FAILED)) fixes" >> "$LOG" 2>&1
    deploy "Audit Round $round"
  else
    log "Round $round: no improvement"
    tg "⚠️ <b>Round $round: needs human review</b>"
    break
  fi
  sleep 20
done

# ── FINAL REPORT ─────────────────────────────────────────────
FINAL=$(gates 2>/dev/null | tail -1)
PORTAL=$(curl -s -o /dev/null -w "%{http_code}" https://evco-portal.vercel.app)

tg "🦀 <b>CRUZ Overnight Build Complete</b>

Portal: $PORTAL
Remaining issues: $FINAL
Log: $LOG

$([ "$FINAL" -eq 0 ] && echo '✅ All gates passing' || echo "⚠️ $FINAL items need human review")

Good morning. 🦀"

log "═══ OVERNIGHT BUILD COMPLETE ═══"
