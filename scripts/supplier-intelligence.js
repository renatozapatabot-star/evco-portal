const { createClient } = require('@supabase/supabase-js')
const { extractWithQwen, isOllamaRunning } = require('./qwen-extract')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CLIENT_CLAVE = '9254'
const MODEL = 'qwen3:8b'

async function run() {
  console.log('🏭 Supplier Intelligence — risk scoring & pattern analysis')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) { console.log('⚠️ Ollama not running'); return }

  // Get all traficos with supplier info
  const { data: traficos } = await supabase
    .from('traficos')
    .select(`
      id,
      trafico_number,
      created_at,
      fecha_llegada,
      fecha_salida,
      clave_cliente,
      proveedor,
      proveedor_nombre,
      documentos,
      status,
      importe_usd,
      tmec_applied
    `)
    .eq('clave_cliente', CLIENT_CLAVE)
    .order('created_at', { ascending: false })

  if (!traficos?.length) {
    console.log('⚠️ No traficos found for analysis')
    return
  }

  // Group by supplier
  const supplierMap = {}
  for (const t of traficos) {
    const supplierName = t.proveedor || t.proveedor_nombre || 'Unknown'
    if (!supplierMap[supplierName]) {
      supplierMap[supplierName] = {
        ops: 0,
        totalValue: 0,
        tmecOps: 0,
        docTurnaround: [],
        missingDocs: {},
        statuses: {}
      }
    }
    const s = supplierMap[supplierName]
    s.ops++
    s.totalValue += t.importe_usd || 0
    if (t.tmec_applied) s.tmecOps++

    // Calculate document turnaround time
    if (t.created_at && t.fecha_llegada) {
      const turnaround = (new Date(t.fecha_llegada) - new Date(t.created_at)) / (1000 * 60 * 60) // hours
      s.docTurnaround.push(turnaround)
    }

    // Track missing documents
    if (t.documentos) {
      const docs = Array.isArray(t.documentos) ? t.documentos : []
      const expectedDocs = ['factura', 'packing_list', 'bill_of_lading', 'certificado_origen']
      for (const doc of expectedDocs) {
        if (!docs.some(d => d.toLowerCase().includes(doc))) {
          s.missingDocs[doc] = (s.missingDocs[doc] || 0) + 1
        }
      }
    }

    // Track status patterns
    s.statuses[t.status] = (s.statuses[t.status] || 0) + 1
  }

  // Calculate metrics for each supplier
  const supplierMetrics = []
  for (const [name, data] of Object.entries(supplierMap)) {
    const avgTurnaround = data.docTurnaround.length > 0
      ? data.docTurnaround.reduce((a, b) => a + b, 0) / data.docTurnaround.length
      : null

    const mostCommonMissing = Object.entries(data.missingDocs)
      .sort((a, b) => b[1] - a[1])[0]
      ? { doc: Object.entries(data.missingDocs).sort((a, b) => b[1] - a[1])[0][0], count: Object.entries(data.missingDocs).sort((a, b) => b[1] - a[1])[0][1] }
      : null

    const tmecRate = data.ops > 0 ? (data.tmecOps / data.ops * 100).toFixed(1) : 0

    supplierMetrics.push({
      name,
      ops: data.ops,
      avgTurnaround,
      mostCommonMissing,
      avgValue: data.totalValue / data.ops,
      tmecRate,
      statusDistribution: data.statuses
    })
  }

  // Analyze patterns with Qwen
  const ANALYSIS_PROMPT = `You are a customs compliance expert analyzing supplier performance patterns.
Given this supplier data, return a JSON analysis:
{
  "performance_trend": "improving" | "stable" | "degrading",
  "key_issues": ["list of top 3 issues"],
  "pre_request_docs": ["list of documents to pre-request"],
  "risk_level": "low" | "medium" | "high",
  "action_items": ["list of recommended actions"]
}
Return JSON only.`

  const insights = []
  for (const metric of supplierMetrics) {
    const profile = `
Supplier: ${metric.name}
Operations: ${metric.ops}
Avg document turnaround: ${metric.avgTurnaround ? metric.avgTurnaround.toFixed(1) + ' hours' : 'N/A'}
Avg shipment value: $${Math.round(metric.avgValue).toLocaleString()} USD
T-MEC usage: ${metric.tmecRate}%
Most common missing docs: ${metric.mostCommonMissing ? `${metric.mostCommonMissing.doc} (${metric.mostCommonMissing.count} times)` : 'None'}
Status distribution: ${JSON.stringify(metric.statusDistribution)}
`
    const analysis = await extractWithQwen(profile, ANALYSIS_PROMPT)
    if (analysis) {
      insights.push({ ...metric, analysis })
    }
  }

  // Write to supplier_intelligence table
  const insertData = insights.map(i => ({
    supplier_name: i.name,
    total_ops: i.ops,
    avg_turnaround_hours: i.avgTurnaround,
    avg_shipment_value: i.avgValue,
    tmec_usage_rate: parseFloat(i.tmecRate),
    most_common_missing_doc: i.mostCommonMissing?.doc || null,
    missing_doc_count: i.mostCommonMissing?.count || 0,
    performance_trend: i.analysis?.performance_trend || 'stable',
    key_issues: i.analysis?.key_issues || [],
    pre_request_docs: i.analysis?.pre_request_docs || [],
    risk_level: i.analysis?.risk_level || 'low',
    action_items: i.analysis?.action_items || [],
    last_analyzed: new Date().toISOString()
  }))

  const { error: insertError } = await supabase
    .from('supplier_intelligence')
    .upsert(insertData, { onConflict: 'supplier_name' })

  if (insertError) {
    console.error('❌ Error writing to supplier_intelligence:', insertError)
  } else {
    console.log(`✅ Supplier intelligence: ${insights.length} suppliers analyzed`)
  }

  // Flag suppliers with degrading performance
  const degradingSuppliers = insights.filter(i => i.analysis?.performance_trend === 'degrading')
  if (degradingSuppliers.length > 0) {
    const notificationMsg = `⚠️ ${degradingSuppliers.length} supplier(s) showing degrading performance:\n\n` +
      degradingSuppliers.map(s => `• ${s.name}: ${s.analysis?.key_issues?.join(', ')}`).join('\n')

    console.log(notificationMsg)
    // Send notification via Telegram if configured
    if (process.env.TELEGRAM_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: notificationMsg,
            parse_mode: 'Markdown'
          })
        })
        console.log('📱 Notification sent to Telegram')
      } catch (err) {
        console.error('❌ Failed to send notification:', err.message)
      }
    }
  }
}

module.exports = { run }
run().catch(console.error)
