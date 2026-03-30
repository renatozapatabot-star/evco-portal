const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' MXN' }

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('💰 Financial Intelligence Engine — Starting...\n')

  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.GLOBALPC_ECONTA_HOST,
      port: 33035,
      user: process.env.GLOBALPC_ECONTA_USER,
      password: process.env.GLOBALPC_ECONTA_PASS,
      database: 'bd_econta_rz',
      connectTimeout: 15000,
    })
    console.log('✅ MySQL connected\n')
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // Query customs invoices (factura_aa — 26K+ real invoices)
    const [facturas] = await conn.query(`
      SELECT
        f.dFechaIngreso AS fecha,
        f.rTotal AS total,
        f.rHonorarios AS subtotal,
        f.rIVA AS iva,
        f.sDescripcionMercancia AS concepto,
        f.sSerieCliente AS serie,
        f.sFolioSAT AS folio,
        f.bEstatus AS estatus,
        f.sCveTipoMoneda AS moneda
      FROM factura_aa f
      WHERE f.rTotal > 0 AND f.bEliminado != '1'
      ORDER BY f.dFechaIngreso DESC
    `)
    console.log(`📊 Fetched ${fmtNum(facturas.length)} financial invoices\n`)

    // Query accounts receivable (cl_cartera — accessible table)
    const [cuentasCobrar] = await conn.query(`
      SELECT
        (cc.rCargo - cc.rAbono) AS saldo,
        cc.dFecha AS fecha_vencimiento,
        DATEDIFF(CURDATE(), cc.dFecha) AS dias_vencido,
        cc.iConsecutivoFacturas AS id_factura,
        cc.eTipoCargoAbono AS estatus
      FROM cl_cartera cc
      WHERE (cc.rCargo - cc.rAbono) > 0
        AND cc.eTipoCargoAbono = 'CARGO'
    `)
    console.log(`📊 Fetched ${fmtNum(cuentasCobrar.length)} accounts receivable\n`)

    // Group by month (YYYY-MM)
    const monthlyData = {}
    facturas.forEach(f => {
      if (!f.fecha) return
      const d = new Date(f.fecha)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData[period]) {
        monthlyData[period] = { revenue: 0, count: 0, invoices: [] }
      }
      monthlyData[period].revenue += Number(f.total) || 0
      monthlyData[period].count++
      monthlyData[period].invoices.push(f)
    })

    // Group receivables by month for per-period calculation
    const receivablesByMonth = {}
    cuentasCobrar.forEach(cc => {
      if (!cc.fecha_vencimiento) return
      const d = new Date(cc.fecha_vencimiento)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!receivablesByMonth[period]) receivablesByMonth[period] = { total: 0, daysSum: 0, count: 0 }
      receivablesByMonth[period].total += Number(cc.saldo) || 0
      receivablesByMonth[period].daysSum += Number(cc.dias_vencido) || 0
      receivablesByMonth[period].count++
    })

    // Global summaries for Telegram
    const totalReceivables = cuentasCobrar.reduce((s, cc) => s + (Number(cc.saldo) || 0), 0)
    const overdue30 = cuentasCobrar.filter(cc => (cc.dias_vencido || 0) > 30)
    const overdue60 = cuentasCobrar.filter(cc => (cc.dias_vencido || 0) > 60)
    const recentReceivables = Object.entries(receivablesByMonth)
      .sort(([a], [b]) => b.localeCompare(a)).slice(0, 6)
    const avgDaysPayment = recentReceivables.length > 0
      ? recentReceivables.reduce((s, [, r]) => s + (r.count > 0 ? r.daysSum / r.count : 0), 0) / recentReceivables.length
      : 0

    // Sort periods
    const periods = Object.keys(monthlyData).sort()
    console.log(`📅 Periods covered: ${periods[0]} to ${periods[periods.length - 1]}\n`)

    // Revenue trend calculation
    const recentMonths = periods.slice(-6)
    const revenues = recentMonths.map(p => monthlyData[p].revenue)

    function calcTrend(values) {
      if (values.length < 2) return 'stable'
      const half = Math.floor(values.length / 2)
      const first = values.slice(0, half).reduce((s, v) => s + v, 0) / half
      const second = values.slice(half).reduce((s, v) => s + v, 0) / (values.length - half)
      const change = (second - first) / (first || 1)
      if (change > 0.05) return 'up'
      if (change < -0.05) return 'down'
      return 'stable'
    }

    // Project next month revenue (simple moving average)
    const last3 = revenues.slice(-3)
    const projectedNext = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0

    // Build intelligence records per period — receivables and days scoped per month
    const records = periods.map(period => {
      const rm = receivablesByMonth[period]
      const periodReceivables = rm ? rm.total : 0
      const periodDays = rm && rm.count > 0 ? rm.daysSum / rm.count : 0
      return {
        period: `${period}-01`,
        total_revenue: Math.round(monthlyData[period].revenue * 100) / 100,
        outstanding_receivables: Math.round(periodReceivables * 100) / 100,
        avg_days_to_payment: Math.round(periodDays * 100) / 100,
        operation_count: monthlyData[period].count,
        revenue_trend: calcTrend(periods.slice(0, periods.indexOf(period) + 1).slice(-6).map(p => monthlyData[p].revenue)),
        projected_next_month: Math.round(projectedNext * 100) / 100,
        company_id: COMPANY_ID,
        calculated_at: new Date().toISOString(),
      }
    })

    console.log(`📈 Financial periods: ${fmtNum(records.length)}`)
    console.log(`💵 Total receivables: ${fmtMXN(totalReceivables)}`)
    console.log(`⏱️  Avg days to payment: ${Math.round(avgDaysPayment)}`)
    console.log(`⚠️  Overdue >30 days: ${overdue30.length}`)
    console.log(`🔴 Overdue >60 days: ${overdue60.length}\n`)

    // Save to Supabase
    const BATCH = 200
    let saved = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase.from('financial_intelligence').upsert(batch, {
        onConflict: 'period,company_id',
        ignoreDuplicates: false,
      })
      if (error) {
        if (error.code === '42P01') {
          console.error('❌ Table financial_intelligence does not exist. Run the SQL migration first.')
          return
        }
        console.error(`Batch error:`, error.message)
      } else {
        saved += batch.length
      }
    }

    console.log(`✅ Saved ${fmtNum(saved)} financial intelligence records\n`)

    // Revenue summary - last 6 months
    console.log('📊 Last 6 Months Revenue:')
    recentMonths.forEach(p => {
      const d = monthlyData[p]
      const trend = calcTrend([d.revenue])
      console.log(`  ${p}: ${fmtMXN(d.revenue)} (${d.count} ops)`)
    })

    // Telegram summary
    const currentMonth = periods[periods.length - 1]
    const prevMonth = periods.length > 1 ? periods[periods.length - 2] : null
    const currentRev = monthlyData[currentMonth]?.revenue || 0
    const prevRev = prevMonth ? monthlyData[prevMonth]?.revenue || 0 : 0
    const changePercent = prevRev > 0 ? ((currentRev - prevRev) / prevRev * 100).toFixed(1) : '—'

    // Only send Telegram if critical overdue (>90 days) found
    const overdue90 = records.filter(r => r.overdue_90_count > 0)
    const criticalOverdue = overdue90.reduce((s, r) => s + r.overdue_90_count, 0)
    if (criticalOverdue > 0) {
      await sendTelegram(
        `🔴 <b>Financial Alert — ${criticalOverdue} Overdue >90d</b>\n\n` +
        `Cuentas por cobrar: ${fmtMXN(totalReceivables)}\n` +
        `Vencidas >90d: ${criticalOverdue}\n` +
        `Vencidas >30d: ${overdue30.length}\n\n` +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Financial Intelligence Engine — Complete')

  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Financial Intelligence failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
