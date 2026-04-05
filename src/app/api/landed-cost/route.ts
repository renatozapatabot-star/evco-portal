import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/landed-cost
 * Calculate complete landed cost for an import operation.
 * Returns freight + customs + insurance + fees = total.
 *
 * No other broker in Laredo gives this number in 10 seconds.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { value_usd = 0, weight_kg = 0, origin = 'Houston', regimen = 'A1', product_type = '' } = body

  // Get current rates from system_config
  const [dtaRes, tcRes, ivaRes] = await Promise.all([
    supabase.from('system_config').select('value').eq('key', 'dta_rates').single(),
    supabase.from('system_config').select('value').eq('key', 'banxico_exchange_rate').single(),
    supabase.from('system_config').select('value').eq('key', 'iva_rate').single(),
  ])

  const dtaRates = dtaRes.data?.value || { A1: { rate: 0.008 } }
  const exchangeRate = tcRes.data?.value?.rate || 17.5
  const ivaRate = ivaRes.data?.value?.rate || 0.16

  const isTMEC = ['ITE', 'ITR', 'IMD'].includes(regimen.toUpperCase())
  const dtaRate = dtaRates[regimen.toUpperCase()]?.rate || dtaRates.A1?.rate || 0.008

  // Calculate each component
  const valorMXN = value_usd * exchangeRate
  const dta = Math.round(valorMXN * dtaRate)
  const igi = isTMEC ? 0 : Math.round(valorMXN * 0.05) // 5% default IGI if no T-MEC
  const ivaBase = valorMXN + dta + igi
  const iva = Math.round(ivaBase * ivaRate)

  // Freight estimate (from lane intelligence or defaults)
  const laneDefaults: Record<string, number> = {
    'Houston': 1850, 'Dallas': 2100, 'San Antonio': 1400,
    'Austin': 1800, 'Chicago': 3200, 'Los Angeles': 3800,
  }
  const freightEstimate = laneDefaults[origin] || 2000
  const freightRange = { low: Math.round(freightEstimate * 0.85), high: Math.round(freightEstimate * 1.15) }

  // Insurance (0.3-0.5% of value)
  const insuranceRate = value_usd > 100000 ? 0.003 : value_usd > 50000 ? 0.004 : 0.005
  const insurance = Math.round(value_usd * insuranceRate)

  // Brokerage fee (simplified)
  const brokerageFee = 850 // Base fee MXN

  // Totals
  const customsTotal = dta + igi + iva
  const totalUSD = Math.round(value_usd + freightEstimate + insurance + customsTotal / exchangeRate + brokerageFee / exchangeRate)
  const totalTMEC = isTMEC ? totalUSD : Math.round(totalUSD - igi / exchangeRate)
  const tmecSavings = isTMEC ? Math.round(valorMXN * 0.05 / exchangeRate) : 0

  return NextResponse.json({
    breakdown: {
      valor_usd: value_usd,
      valor_mxn: Math.round(valorMXN),
      tipo_cambio: exchangeRate,
      freight: { estimate: freightEstimate, range: freightRange, origin },
      customs: {
        dta: { rate: dtaRate, amount_mxn: dta },
        igi: { rate: isTMEC ? 0 : 0.05, amount_mxn: igi, tmec_exempt: isTMEC },
        iva: { rate: ivaRate, base_mxn: ivaBase, amount_mxn: iva },
        total_mxn: customsTotal,
        total_usd: Math.round(customsTotal / exchangeRate),
      },
      insurance: { rate: insuranceRate, amount_usd: insurance },
      brokerage: { amount_mxn: brokerageFee, amount_usd: Math.round(brokerageFee / exchangeRate) },
    },
    total_landed_cost_usd: totalUSD,
    with_tmec_usd: totalTMEC,
    tmec_savings_usd: tmecSavings,
    regimen,
    is_tmec: isTMEC,
    message: isTMEC
      ? `Costo total con T-MEC: $${totalTMEC.toLocaleString()} USD (ahorro: $${tmecSavings.toLocaleString()} USD)`
      : `Costo total: $${totalUSD.toLocaleString()} USD${tmecSavings > 0 ? ` (con T-MEC ahorraría $${tmecSavings.toLocaleString()} USD)` : ''}`,
  })
}
