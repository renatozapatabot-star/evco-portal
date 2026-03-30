const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—' }
function fmtId(id) { return id ? `9254-${String(id).replace(/^9254[-]?/, '')}` : '—' }

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('📋 Monday Morning Prep — Starting...\n')

  const today = new Date()
  const endOfWeek = new Date(today); endOfWeek.setDate(endOfWeek.getDate() + 7)

  // Fetch all active tráficos
  const { data: traficos } = await supabase
    .from('traficos')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada', { ascending: true })

  const all = traficos || []
  const active = all.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))

  // Fetch risk scores and documents
  const traficoIds = active.map(t => t.trafico)
  const [riskRes, docsRes] = await Promise.all([
    supabase.from('pedimento_risk_scores').select('trafico_id, overall_score').in('trafico_id', traficoIds),
    supabase.from('documents').select('trafico_id').in('trafico_id', traficoIds),
  ])

  const riskScores = {}
  ;(riskRes.data || []).forEach(r => { riskScores[r.trafico_id] = r.overall_score || 0 })
  const docCounts = {}
  ;(docsRes.data || []).forEach(d => { docCounts[d.trafico_id] = (docCounts[d.trafico_id] || 0) + 1 })

  // Categorize
  const categories = {
    overdue: [], // >7 days, not crossed
    today: [], // arriving today
    thisWeek: [], // arriving this week
    readyToTransmit: [], // have pedimento + docs
    waitingDocs: [], // missing docs
  }

  active.forEach(t => {
    const arrival = t.fecha_llegada ? new Date(t.fecha_llegada) : null
    const daysSinceArrival = arrival ? Math.floor((today - arrival) / 86400000) : 0
    const docs = docCounts[t.trafico] || 0
    const hasPedimento = !!t.pedimento
    const risk = riskScores[t.trafico] || 0

    const item = {
      id: t.trafico,
      supplier: t.proveedor || (t.descripcion_mercancia || '').split(' ').slice(0, 2).join(' '),
      arrival: t.fecha_llegada,
      risk,
      docs,
      hasPedimento,
      estatus: t.estatus,
    }

    if (daysSinceArrival > 7) {
      categories.overdue.push(item)
    } else if (arrival && arrival.toDateString() === today.toDateString()) {
      categories.today.push(item)
    } else if (arrival && arrival >= today && arrival <= endOfWeek) {
      categories.thisWeek.push(item)
    }

    if (hasPedimento && docs >= 3) {
      categories.readyToTransmit.push(item)
    } else if (!hasPedimento || docs < 3) {
      categories.waitingDocs.push(item)
    }
  })

  // Sort each category by urgency
  categories.overdue.sort((a, b) => (b.risk || 0) - (a.risk || 0))
  categories.today.sort((a, b) => (b.risk || 0) - (a.risk || 0))

  // Save weekly prep to Supabase
  const weeklyPrep = {
    prediction_type: 'weekly_prep',
    entity_id: today.toISOString().split('T')[0],
    description: JSON.stringify({
      date: today.toISOString(),
      overdue: categories.overdue.length,
      today: categories.today.length,
      thisWeek: categories.thisWeek.length,
      readyToTransmit: categories.readyToTransmit.length,
      waitingDocs: categories.waitingDocs.length,
      items: {
        overdue: categories.overdue.slice(0, 10),
        today: categories.today.slice(0, 10),
        thisWeek: categories.thisWeek.slice(0, 10),
        readyToTransmit: categories.readyToTransmit.slice(0, 10),
        waitingDocs: categories.waitingDocs.slice(0, 10),
      },
    }),
    risk_level: categories.overdue.length > 0 ? 'high' : 'info',
    confidence: 1,
    company_id: COMPANY_ID,
    created_at: new Date().toISOString(),
  }

  await supabase.from('compliance_predictions').upsert(weeklyPrep, {
    onConflict: 'prediction_type,entity_id',
    ignoreDuplicates: false,
  })

  // Build Telegram message
  const weekStart = fmtDate(today)
  const weekEnd = fmtDate(endOfWeek)

  const formatItems = (items, max = 5) =>
    items.slice(0, max).map(i => `  - ${fmtId(i.id)}: ${i.supplier?.substring(0, 25) || '—'}`).join('\n')

  let msg = `📋 <b>PREPARACIÓN SEMANAL — EVCO</b>\nSemana del ${weekStart} al ${weekEnd}\n\n`

  if (categories.overdue.length > 0) {
    msg += `🔴 <b>URGENTE (${categories.overdue.length}):</b>\n${formatItems(categories.overdue)}\n\n`
  }
  if (categories.today.length > 0) {
    msg += `🟡 <b>HOY (${categories.today.length}):</b>\n${formatItems(categories.today)}\n\n`
  }
  if (categories.thisWeek.length > 0) {
    msg += `📦 <b>ESTA SEMANA (${categories.thisWeek.length}):</b>\n${formatItems(categories.thisWeek)}\n\n`
  }
  if (categories.readyToTransmit.length > 0) {
    msg += `✅ <b>LISTOS PARA TRANSMITIR (${categories.readyToTransmit.length}):</b>\n${formatItems(categories.readyToTransmit)}\n\n`
  }
  if (categories.waitingDocs.length > 0) {
    msg += `📄 <b>ESPERANDO DOCUMENTOS (${categories.waitingDocs.length}):</b>\n${formatItems(categories.waitingDocs)}\n\n`
  }

  msg += `Ver plan: evco-portal.vercel.app/planeacion\n\nCRUZ 🦀`

  await sendTelegram(msg)

  console.log('📊 Weekly Summary:')
  console.log(`   Overdue: ${categories.overdue.length}`)
  console.log(`   Today: ${categories.today.length}`)
  console.log(`   This week: ${categories.thisWeek.length}`)
  console.log(`   Ready to transmit: ${categories.readyToTransmit.length}`)
  console.log(`   Waiting docs: ${categories.waitingDocs.length}`)

  console.log('\n✅ Monday Morning Prep — Complete')
}

run()
