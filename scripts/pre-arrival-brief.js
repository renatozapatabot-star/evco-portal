const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' USD' }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('📋 Pre-Arrival Intelligence Brief — Starting...\n')

  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

  // Find active tráficos expected to arrive soon
  const { data: traficos } = await supabase
    .from('traficos')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('estatus', ['En Proceso', 'En Transito', 'Pendiente'])
    .gte('fecha_llegada', yesterday.toISOString().split('T')[0])
    .lte('fecha_llegada', dayAfterTomorrow.toISOString().split('T')[0])
    .order('fecha_llegada', { ascending: true })

  const arrivals = traficos || []
  console.log(`📦 Expected arrivals: ${arrivals.length}\n`)

  if (arrivals.length === 0) {
    // Also check any active tráficos without specific arrival date
    const { data: active } = await supabase
      .from('traficos')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .in('estatus', ['En Proceso', 'En Transito', 'Pendiente'])
      .order('fecha_llegada', { ascending: true })
      .limit(10)

    if (!active || active.length === 0) {
      console.log('No active tráficos found.')
      return
    }
    // Use active ones instead
    arrivals.push(...active)
    console.log(`📦 Using ${arrivals.length} active tráficos instead\n`)
  }

  // Fetch supporting data in parallel
  const traficoIds = arrivals.map(t => t.trafico)
  const [riskRes, supplierRes, docsRes, crossingRes] = await Promise.all([
    supabase.from('pedimento_risk_scores').select('*').in('trafico_id', traficoIds),
    supabase.from('supplier_contacts').select('*').eq('company_id', COMPANY_ID),
    supabase.from('documents').select('trafico_id, document_type').in('trafico_id', traficoIds),
    supabase.from('crossing_predictions').select('*').limit(1),
  ])

  const riskScores = {}
  ;(riskRes.data || []).forEach(r => { riskScores[r.trafico_id] = r })
  const suppliers = {}
  ;(supplierRes.data || []).forEach(s => { suppliers[s.proveedor?.toLowerCase()] = s })
  const docsByTrafico = {}
  ;(docsRes.data || []).forEach(d => {
    if (!docsByTrafico[d.trafico_id]) docsByTrafico[d.trafico_id] = []
    docsByTrafico[d.trafico_id].push(d.document_type)
  })

  const REQUIRED_DOCS = ['FACTURA_COMERCIAL', 'PACKING_LIST', 'BILL_OF_LADING', 'COVE', 'MVE']
  const dayOfWeek = today.getDay() // 0=Sun, 5=Fri

  const briefs = []

  for (const t of arrivals) {
    const risk = riskScores[t.trafico] || {}
    const riskScore = risk.overall_score || 0
    const docs = docsByTrafico[t.trafico] || []
    const docsReady = REQUIRED_DOCS.filter(d => docs.some(doc => (doc || '').toUpperCase().includes(d))).length
    const missingDocs = REQUIRED_DOCS.filter(d => !docs.some(doc => (doc || '').toUpperCase().includes(d)))
    const supplierName = t.proveedor || t.descripcion_mercancia?.split(' ')[0] || ''
    const supplierData = suppliers[supplierName.toLowerCase()] || {}
    const usmcaValid = supplierData.usmca_eligible !== false

    // Build recommendation
    let recommendation = ''
    if (riskScore < 30) recommendation = 'Transmitir. Bajo riesgo.'
    else if (riskScore < 60) recommendation = 'Revisar documentos antes de transmitir.'
    else recommendation = 'ALTO RIESGO — revisar con Tito antes de transmitir.'
    if (dayOfWeek === 5) recommendation += ' Considerar esperar lunes — viernes 40% más lento.'
    if (missingDocs.length > 0) recommendation += ` Faltantes: ${missingDocs.join(', ')}.`

    const brief = {
      trafico_id: t.trafico,
      brief_data: {
        trafico_id: t.trafico,
        expected_arrival: t.fecha_llegada,
        carrier: t.transportista_mexicano || t.transportista_extranjero || '—',
        supplier: supplierName || '—',
        risk_score: riskScore,
        usmca_valid: usmcaValid,
        documents_ready: docsReady,
        documents_needed: REQUIRED_DOCS.length,
        missing_docs: missingDocs,
        recommendation,
        peso_bruto: t.peso_bruto,
        valor: t.importe_total || t.valor,
      },
      sent_at: new Date().toISOString(),
      company_id: COMPANY_ID,
      created_at: new Date().toISOString(),
    }

    briefs.push(brief)

    console.log(`📋 ${t.trafico}: Risk ${riskScore}/100 | Docs ${docsReady}/${REQUIRED_DOCS.length} | ${recommendation}`)
  }

  // Save briefs to Supabase
  if (briefs.length > 0) {
    const { error } = await supabase.from('pre_arrival_briefs').upsert(briefs, {
      onConflict: 'trafico_id,company_id',
      ignoreDuplicates: false,
    })
    if (error) {
      if (error.code === '42P01') console.error('❌ Table pre_arrival_briefs does not exist. Run SQL migration.')
      else console.error('Save error:', error.message)
    } else {
      console.log(`\n✅ Saved ${briefs.length} briefs`)
    }
  }

  // Send Telegram summary only if there are missing critical documents
  const briefsWithMissing = briefs.filter(b => b.brief_data.missing_docs.length > 0)

  if (briefsWithMissing.length > 0) {
    const briefTexts = briefsWithMissing.slice(0, 8).map(b => {
      const d = b.brief_data
      const riskEmoji = d.risk_score >= 60 ? '🔴' : d.risk_score >= 30 ? '🟡' : '🟢'
      return (
        `📋 <b>${d.trafico_id}</b>\n` +
        `Esperado: ${fmtDate(d.expected_arrival)}\n` +
        `Carrier: ${d.carrier}\n` +
        `Proveedor: ${d.supplier}\n` +
        `${riskEmoji} Riesgo: ${d.risk_score}/100\n` +
        `Documentos: ${d.documents_ready}/${d.documents_needed}\n` +
        `${d.recommendation}`
      )
    }).join('\n\n')

    await sendTelegram(
      `📋 <b>BRIEF DE LLEGADA — ${fmtDate(today)}</b>\n` +
      `${briefsWithMissing.length} tráfico(s) con documentos faltantes\n\n` +
      briefTexts + '\n\n' +
      `CRUZ 🦀`
    )
  }

  console.log('\n✅ Pre-Arrival Brief — Complete')
}

run()
