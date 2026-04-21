require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('\n🧹 CRUZ Classification Dedup')
  console.log('═'.repeat(50))

  // Phase 1: Count duplicates
  // Get all classifications grouped by filename+source
  let offset = 0, all = []
  while (true) {
    const { data } = await sb.from('document_classifications')
      .select('id, filename, source, doc_type, confidence, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    all.push(...data)
    offset += 1000
  }

  console.log('  Total rows: ' + all.length)

  // Group by filename+source
  const groups = {}
  for (const row of all) {
    const key = (row.filename || '') + '|' + (row.source || '')
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  }

  const dupeGroups = Object.entries(groups).filter(([k, v]) => v.length > 1)
  let totalDupes = 0
  let idsToDelete = []

  for (const [key, rows] of dupeGroups) {
    // Keep the latest (or highest confidence) — delete the rest
    rows.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return new Date(b.created_at) - new Date(a.created_at)
    })
    const keep = rows[0]
    const remove = rows.slice(1)
    totalDupes += remove.length
    idsToDelete.push(...remove.map(r => r.id))
  }

  console.log('  Unique files: ' + Object.keys(groups).length)
  console.log('  Duplicate groups: ' + dupeGroups.length)
  console.log('  Rows to delete: ' + totalDupes)

  // Top 5 worst offenders
  const worst = dupeGroups.sort((a, b) => b[1].length - a[1].length).slice(0, 5)
  console.log('\n  Worst duplicates:')
  for (const [key, rows] of worst) {
    console.log('    ' + key.split('|')[0].substring(0, 50) + ' → ' + rows.length + 'x')
  }

  if (idsToDelete.length === 0) {
    console.log('\n  ✅ No duplicates found')
    return
  }

  // Phase 2: Delete duplicates in batches
  console.log('\n  Deleting ' + idsToDelete.length + ' duplicates...')
  let deleted = 0
  for (let i = 0; i < idsToDelete.length; i += 100) {
    const batch = idsToDelete.slice(i, i + 100)
    const { error } = await sb.from('document_classifications').delete().in('id', batch)
    if (error) {
      console.error('  Delete error:', error.message)
    } else {
      deleted += batch.length
    }
  }

  console.log('  ✅ Deleted: ' + deleted)

  // Final count
  const { count } = await sb.from('document_classifications').select('*', { count: 'exact', head: true })
  console.log('\n  Rows after dedup: ' + count)

  // New OTRO percentage
  const { count: otros } = await sb.from('document_classifications').select('*', { count: 'exact', head: true }).eq('doc_type', 'OTRO')
  console.log('  OTRO: ' + otros + '/' + count + ' = ' + (otros/count*100).toFixed(1) + '%')
}

run().catch(e => console.error('Fatal:', e.message))
