#!/usr/bin/env node
// scripts/cruz-learning.js — Weekly CRUZ AI Learning Report
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function weeklyLearning() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { count: total } = await s.from('cruz_conversations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo)

  const { data: feedback } = await s.from('cruz_conversations')
    .select('was_helpful')
    .gte('created_at', weekAgo)
    .not('was_helpful', 'is', null)
  const helpful = (feedback || []).filter(f => f.was_helpful).length
  const helpRate = feedback?.length ? Math.round((helpful / feedback.length) * 100) : 0

  const { data: convos } = await s.from('cruz_conversations')
    .select('tools_used, user_message, response_time_ms')
    .gte('created_at', weekAgo)

  const toolCounts = {}
  let totalMs = 0
  ;(convos || []).forEach(c => {
    totalMs += c.response_time_ms || 0
    ;(c.tools_used || []).forEach(t => { toolCounts[t] = (toolCounts[t] || 0) + 1 })
  })
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const avgMs = convos?.length ? Math.round(totalMs / convos.length) : 0

  const report = `CRUZ LEARNING REPORT — ${new Date().toLocaleDateString('es-MX')}
${total || 0} conversations this week
${helpRate}% helpfulness rate (${feedback?.length || 0} rated)
Avg response: ${avgMs}ms

TOP TOOLS:
${topTools.map(([t, n], i) => `${i + 1}. ${t} — ${n} uses`).join('\n') || 'No tool usage data'}
`
  console.log(report)
}

weeklyLearning().catch(e => { console.error(e.message); process.exit(1) })
