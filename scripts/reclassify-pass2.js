require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const RULES = [
  { pattern: /^BOL_|^BOL-/i, type: 'CONOCIMIENTO_EMBARQUE' },
  { pattern: /^PList|^PS-|packing.slip/i, type: 'LISTA_EMPAQUE' },
  { pattern: /^CI[\s_-]/i, type: 'FACTURA_COMERCIAL' },
  { pattern: /^SLI[\s_-]|shipper.letter/i, type: 'CONOCIMIENTO_EMBARQUE' },
  { pattern: /^COA[\s_-]|certificate.of.analysis/i, type: 'COA' },
  { pattern: /^MSDS|safety.data/i, type: 'NOM' },
]

async function run() {
  let offset = 0, updated = 0, total = 0
  const stats = {}
  while (true) {
    const { data } = await sb.from('document_classifications')
      .select('id, filename').eq('doc_type', 'OTRO').gt('confidence', 0)
      .range(offset, offset + 499)
    if (!data || data.length === 0) break
    total += data.length
    for (const row of data) {
      const fn = row.filename || ''
      for (const rule of RULES) {
        if (rule.pattern.test(fn)) {
          await sb.from('document_classifications')
            .update({ doc_type: rule.type, confidence: 0.8 })
            .eq('id', row.id)
          stats[rule.type] = (stats[rule.type] || 0) + 1
          updated++
          break
        }
      }
    }
    offset += 500
  }
  console.log('Pass 2: ' + updated + '/' + total + ' reclassified')
  Object.entries(stats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v))

  const { count } = await sb.from('document_classifications').select('*', { count: 'exact', head: true }).eq('doc_type', 'OTRO')
  const { count: tot } = await sb.from('document_classifications').select('*', { count: 'exact', head: true })
  console.log('\nOTRO now: ' + count + '/' + tot + ' = ' + (count/tot*100).toFixed(1) + '%')
}
run()
