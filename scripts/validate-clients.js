#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function validate() {
  // Get all distinct company_ids from traficos
  const companies = await fetchAll(s.from('traficos')
    .select('company_id'))
  const ids = [...new Set((companies || []).map(c => c.company_id).filter(Boolean))]
  console.log(`Validating ${ids.length} clients...\n`)
  console.log('Status  Client'.padEnd(40) + 'Traf'.padEnd(8) + 'Docs'.padEnd(8) + 'Issues')
  console.log('─'.repeat(80))

  for (const cid of ids) {
    const issues = []
    const { count: tc } = await s.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', cid)
    if (!tc) { issues.push('No tráficos'); continue }

    const { count: dc } = await s.from('documents').select('*', { count: 'exact', head: true }).ilike('file_url', `%${cid}%`)
    if (!dc) issues.push('No docs')

    // Check orphan ratio
    const { data: noPed } = await s.from('traficos').select('trafico').eq('company_id', cid).is('pedimento', null)
    const orphanPct = noPed ? Math.round((noPed.length / (tc || 1)) * 100) : 0
    if (orphanPct > 80) issues.push(`${orphanPct}% sin pedimento`)

    // Check En Proceso > 90 days
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const { count: zombies } = await s.from('traficos').select('*', { count: 'exact', head: true })
      .eq('company_id', cid).eq('estatus', 'En Proceso').lt('fecha_llegada', cutoff)
    if (zombies && zombies > 10) issues.push(`${zombies} zombies (90+d)`)

    const st = issues.length === 0 ? '✅' : issues.some(i => i.startsWith('No ')) ? '❌' : '⚠️'
    console.log(`${st}  ${(cid || '').padEnd(36)} ${String(tc || 0).padEnd(8)}${String(dc || 0).padEnd(8)}${issues.join(' · ') || 'Ready'}`)
  }
}

validate().catch(console.error)
