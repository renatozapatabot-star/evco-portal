require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const RULES = [
  { pattern: /entrada.de.bodega|entrada_bodega/i, type: 'ENTRADA_BODEGA' },
  { pattern: /\bpo[\s_-]|purchase.order|orden.de.compra/i, type: 'ORDEN_COMPRA' },
  { pattern: /invoice|inv[\s_-]|factura|^fa[\s_-]/i, type: 'FACTURA_COMERCIAL' },
  { pattern: /packing|lista.de.empaque|empaque|^pl[\s_-]/i, type: 'LISTA_EMPAQUE' },
  { pattern: /certific|origen|usmca|t-mec|tmec/i, type: 'CERTIFICADO_ORIGEN' },
  { pattern: /manif|mv_|mve/i, type: 'MANIFESTACION_VALOR' },
  { pattern: /permiso|salud|cofepris/i, type: 'PERMISO' },
  { pattern: /guia|tracking|\bawb\b|\bbl[\s_-]/i, type: 'GUIA_EMBARQUE' },
  { pattern: /proforma|pro.forma/i, type: 'PROFORMA' },
  { pattern: /\bdoda\b|despacho.previo/i, type: 'DODA_PREVIO' },
]

async function run() {
  console.log('\n🔄 CRUZ OTRO Reclassifier (filename-based)')
  console.log('═'.repeat(50))

  let offset = 0
  const BATCH = 500
  const stats = {}
  let total = 0
  let updated = 0

  while (true) {
    const { data, error } = await sb
      .from('document_classifications')
      .select('id, filename')
      .eq('doc_type', 'OTRO')
      .range(offset, offset + BATCH - 1)

    if (error) { console.error('Query error:', error.message); break }
    if (!data?.length) break

    total += data.length

    for (const row of data) {
      const fn = row.filename || ''
      let matched = null

      for (const rule of RULES) {
        if (rule.pattern.test(fn)) {
          matched = rule.type
          break
        }
      }

      if (matched) {
        const { error: upErr } = await sb
          .from('document_classifications')
          .update({ doc_type: matched, confidence: 0.8 })
          .eq('id', row.id)

        if (upErr) {
          console.error('  Update error:', upErr.message)
        } else {
          stats[matched] = (stats[matched] || 0) + 1
          updated++
        }
      }
    }

    console.log(`  Processed ${total} rows, ${updated} reclassified so far...`)
    offset += BATCH
  }

  console.log('\n' + '═'.repeat(50))
  console.log('📊 RECLASSIFICATION RESULTS')
  console.log(`   Total OTROs scanned: ${total}`)
  console.log(`   Reclassified: ${updated}`)
  console.log(`   Remaining OTRO: ${total - updated}`)
  console.log('')
  Object.entries(stats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`   ${k}: ${v}`)
  )
}

run().catch(e => console.error('Fatal:', e.message))
