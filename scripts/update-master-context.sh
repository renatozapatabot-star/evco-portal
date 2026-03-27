#!/bin/bash
# Run at end of every day: bash scripts/update-master-context.sh

echo "📝 CRUZ Master Context Update — $(date)"
echo ""
echo "Answer these questions, then paste into CRUZ_MASTER_CONTEXT.md:"
echo ""
echo "1. What was built or changed today?"
echo "2. What is currently broken or pending?"
echo "3. What decisions were made?"
echo "4. What are tomorrow's priorities?"
echo "5. What new credentials or env vars were added?"
echo "6. What is the current document/row count?"
echo ""
echo "Current system stats:"
cd ~/evco-portal
node -e "
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
Promise.all([
  s.from('traficos').select('*',{count:'exact',head:true}),
  s.from('documents').select('*',{count:'exact',head:true}),
  s.from('entradas').select('*',{count:'exact',head:true}),
]).then(([t,d,e]) => {
  console.log('Tráficos:', t.count?.toLocaleString())
  console.log('Documents:', d.count?.toLocaleString())
  console.log('Entradas:', e.count?.toLocaleString())
})
"
echo ""
echo "Routes live: $(cd ~/evco-portal && npx next build 2>/dev/null | grep -c '├\|└') routes"
echo "Scripts: $(ls ~/evco-portal/scripts/*.js | wc -l | tr -d ' ') scripts"
echo "Crontab jobs: $(crontab -l | grep -v '^#' | grep -c .) jobs"
