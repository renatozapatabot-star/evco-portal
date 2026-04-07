#!/usr/bin/env node
/**
 * CRUZ Backfill Doc Types
 * Reclassifies expediente_documentos rows with doc_type='otro'
 * Uses filename and nombre patterns to assign correct types.
 * Safe to re-run — only updates rows currently marked 'otro'.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Pattern rules — checked in order, first match wins
const RULES = [
  // Facturas
  { pattern: /invoice|inv[\s_.-]|factura|^fa[\s_.-]|cfdi/i, type: 'factura_comercial' },
  { pattern: /proforma|pro.?forma|^pi[\s_.-]/i, type: 'proforma' },
  // Packing
  { pattern: /packing|lista.de.empaque|empaque|^pl[\s_.-]/i, type: 'packing_list' },
  // Transport
  { pattern: /conocimiento|bill.of.lading|\bbl[\s_.-]|\bbol[\s_.-]|guia.de.embarque|guia.aerea|\bawb\b/i, type: 'bol' },
  { pattern: /carta.porte|cfdi.traslado/i, type: 'carta_porte' },
  // Certificates
  { pattern: /certific.*origen|certificate.*origin|usmca|t-mec|tmec/i, type: 'certificado_origen' },
  { pattern: /\bcoa\b|certificate.of.analysis|certificado.de.analisis/i, type: 'coa' },
  // COVE
  { pattern: /acuse.*cove|acuse.*e-doc/i, type: 'acuse_cove' },
  { pattern: /\bcove\b|detalle.*cove|xml.*cove/i, type: 'cove' },
  // Pedimento
  { pattern: /pedimento/i, type: 'pedimento_detallado' },
  // DODA
  { pattern: /\bdoda\b|despacho.previo|qr.doda/i, type: 'doda' },
  // Value declaration
  { pattern: /manifestacion|mv_|mve|\bmv\b/i, type: 'mve' },
  // NOM
  { pattern: /\bnom[\s_.-]|norma.oficial/i, type: 'nom' },
  // Permits
  { pattern: /permiso|cofepris/i, type: 'permiso' },
  // Orders
  { pattern: /\bpo[\s_.-]|purchase.order|orden.de.compra/i, type: 'orden_compra' },
  // Bodega
  { pattern: /entrada.*bodega|warehouse.receipt|recibo.almacen/i, type: 'entrada_bodega' },
  // Accounting
  { pattern: /cuenta.*gastos|honorarios/i, type: 'cuenta_gastos' },
  // Validation
  { pattern: /validacion|archivos.*validacion/i, type: 'archivos_validacion' },
  // Guia / tracking
  { pattern: /guia|tracking|carrier.receipt/i, type: 'bol' },
]

async function run() {
  console.log('\n🔄 CRUZ Doc Type Backfill — expediente_documentos')
  console.log('═'.repeat(50))

  let offset = 0
  const BATCH = 500
  const stats = {}
  let total = 0
  let updated = 0

  while (true) {
    const { data, error } = await supabase
      .from('expediente_documentos')
      .select('id, file_name, file_url, metadata')
      .eq('doc_type', 'otro')
      .range(offset, offset + BATCH - 1)

    if (error) { console.error('Query error:', error.message); break }
    if (!data?.length) break

    total += data.length

    for (const row of data) {
      // Try matching against file_name, file_url, and WSDL label from metadata
      const wsdlLabel = row.metadata?.wsdl_label || ''
      const searchText = `${row.file_name || ''} ${row.file_url || ''} ${wsdlLabel}`
      let matched = null

      for (const rule of RULES) {
        if (rule.pattern.test(searchText)) {
          matched = rule.type
          break
        }
      }

      if (matched) {
        const { error: upErr } = await supabase
          .from('expediente_documentos')
          .update({ doc_type: matched })
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
  console.log('📊 BACKFILL RESULTS')
  console.log(`   Total "otro" docs scanned: ${total}`)
  console.log(`   Reclassified: ${updated}`)
  console.log(`   Remaining "otro": ${total - updated}`)
  console.log('')
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`   ${k}: ${v}`)
  )

  // Final count check
  const { count: otroCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', 'otro')
  const { count: totalCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })

  console.log(`\n   Final: ${otroCount} "otro" / ${totalCount} total = ${((otroCount / totalCount) * 100).toFixed(1)}%`)
}

run().catch(e => console.error('Fatal:', e.message))
