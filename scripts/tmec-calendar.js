const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('📅 T-MEC Certificate Calendar — Starting...\n')

  // Get all T-MEC eligible suppliers
  const { data: suppliers } = await supabase
    .from('supplier_contacts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('usmca_eligible', true)

  const tmecSuppliers = suppliers || []
  console.log(`📊 T-MEC eligible suppliers: ${tmecSuppliers.length}\n`)

  // Get documents that mention USMCA/T-MEC
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .or('document_type.ilike.%usmca%,document_type.ilike.%tmec%,document_type.ilike.%origen%')
    .limit(500)

  const tmecDocs = docs || []
  console.log(`📄 T-MEC documents found: ${tmecDocs.length}`)

  // Get factura data for T-MEC utilization
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('proveedor, igi, valor_usd')
    .eq('clave_cliente', '9254')

  const allFacturas = facturas || []
  const tmecOps = allFacturas.filter(f => Number(f.igi) === 0)
  const nonTmecOps = allFacturas.filter(f => Number(f.igi) > 0)

  // Build certificate tracking per supplier
  const today = new Date()
  const certificates = tmecSuppliers.map(s => {
    // Estimate certificate dates based on last_operation
    const lastOp = s.last_operation ? new Date(s.last_operation) : null
    // USMCA certificates typically valid for 1 year from issuance
    // Estimate issue date as 1 year before last operation or 6 months ago
    const estimatedIssue = lastOp
      ? new Date(lastOp.getTime() - 180 * 86400000) // 6 months before last op
      : new Date(today.getTime() - 270 * 86400000) // 9 months ago default
    const estimatedExpiry = new Date(estimatedIssue.getTime() + 365 * 86400000) // 1 year validity

    const daysUntilExpiry = Math.floor((estimatedExpiry - today) / 86400000)

    let status = 'valid'
    let alertLevel = 'info'
    if (daysUntilExpiry <= 0) { status = 'expired'; alertLevel = 'critical' }
    else if (daysUntilExpiry <= 7) { status = 'expiring_critical'; alertLevel = 'critical' }
    else if (daysUntilExpiry <= 30) { status = 'expiring_soon'; alertLevel = 'warning' }
    else if (daysUntilExpiry <= 60) { status = 'expiring_info'; alertLevel = 'info' }

    // Count operations using T-MEC for this supplier
    const supplierOps = allFacturas.filter(f => (f.proveedor || '').toLowerCase() === (s.proveedor || '').toLowerCase())
    const supplierTmec = supplierOps.filter(f => Number(f.igi) === 0)
    const tmecRate = supplierOps.length > 0 ? (supplierTmec.length / supplierOps.length * 100).toFixed(1) : '0'
    const savings = supplierTmec.reduce((sum, f) => sum + (Number(f.valor_usd) || 0) * 0.05, 0) // Estimate 5% tariff savings

    return {
      proveedor: s.proveedor,
      country: s.country || 'USA',
      contact_email: s.contact_email,
      estimated_issue: estimatedIssue.toISOString().split('T')[0],
      estimated_expiry: estimatedExpiry.toISOString().split('T')[0],
      days_until_expiry: daysUntilExpiry,
      status,
      alert_level: alertLevel,
      operations: supplierOps.length,
      tmec_rate: tmecRate,
      estimated_savings: Math.round(savings),
    }
  })

  // Sort by days until expiry
  certificates.sort((a, b) => a.days_until_expiry - b.days_until_expiry)

  // Save to compliance_predictions
  const expiringCerts = certificates.filter(c => c.days_until_expiry <= 60)
  if (expiringCerts.length > 0) {
    const predictions = expiringCerts.map(c => ({
      prediction_type: 'tmec_expiry',
      entity_id: c.proveedor,
      description: `Certificado T-MEC de ${c.proveedor} ${c.status === 'expired' ? 'VENCIDO' : `vence en ${c.days_until_expiry} días`} (${fmtDate(c.estimated_expiry)})`,
      risk_level: c.alert_level,
      confidence: 0.7,
      due_date: c.estimated_expiry,
      company_id: COMPANY_ID,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('compliance_predictions').upsert(predictions, {
      onConflict: 'prediction_type,entity_id',
      ignoreDuplicates: false,
    })
    if (error) console.error('Predictions error:', error.message)
    else console.log(`📅 ${predictions.length} T-MEC expiry predictions saved`)
  }

  // Draft renewal emails for expiring (<30 days)
  const needsRenewal = certificates.filter(c => c.days_until_expiry <= 30 && c.contact_email)
  if (needsRenewal.length > 0) {
    const drafts = needsRenewal.map(c => ({
      prediction_type: 'tmec_renewal_draft',
      entity_id: c.proveedor,
      description: JSON.stringify({
        to: c.contact_email,
        subject: `USMCA Certificate of Origin Renewal — ${c.proveedor}`,
        body: `Dear ${c.proveedor},\n\nYour USMCA Certificate of Origin is set to expire on ${fmtDate(c.estimated_expiry)}.\n\nPlease provide a renewed certificate to continue receiving preferential T-MEC tariff treatment for your imports into Mexico.\n\nRequired by: ${fmtDate(new Date(new Date(c.estimated_expiry).getTime() - 5 * 86400000))}\n\nThank you,\nRenato Zapata & Company\nPatente 3596 · Laredo, Texas`,
        supplier: c.proveedor,
        expiry_date: c.estimated_expiry,
      }),
      risk_level: 'warning',
      confidence: 1,
      company_id: COMPANY_ID,
      created_at: new Date().toISOString(),
    }))

    await supabase.from('compliance_predictions').upsert(drafts, {
      onConflict: 'prediction_type,entity_id',
      ignoreDuplicates: false,
    })
    console.log(`✉️  ${drafts.length} renewal email drafts queued`)
  }

  // Summary
  const expired = certificates.filter(c => c.status === 'expired').length
  const expiring30 = certificates.filter(c => c.days_until_expiry > 0 && c.days_until_expiry <= 30).length
  const expiring60 = certificates.filter(c => c.days_until_expiry > 30 && c.days_until_expiry <= 60).length
  const valid = certificates.filter(c => c.days_until_expiry > 60).length
  const totalSavings = certificates.reduce((s, c) => s + c.estimated_savings, 0)

  console.log(`\n📊 Certificate Status:`)
  console.log(`   🔴 Expired: ${expired}`)
  console.log(`   🟡 Expiring <30d: ${expiring30}`)
  console.log(`   🟠 Expiring <60d: ${expiring60}`)
  console.log(`   🟢 Valid: ${valid}`)
  console.log(`   💰 Est. T-MEC savings: $${totalSavings.toLocaleString()} USD`)

  await sendTelegram(
    `📅 <b>T-MEC Calendar — Complete</b>\n\n` +
    `Certificados: ${certificates.length}\n` +
    `🔴 Vencidos: ${expired}\n` +
    `🟡 Vencen <30d: ${expiring30}\n` +
    `🟢 Vigentes: ${valid}\n` +
    `💰 Ahorro T-MEC est.: $${totalSavings.toLocaleString()} USD\n\n` +
    `CRUZ 🦀`
  )

  console.log('\n✅ T-MEC Calendar — Complete')
}

run()
