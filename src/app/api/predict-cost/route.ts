import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { getDTARates, getIVARate, getExchangeRate } from '@/lib/rates'
import { z } from 'zod'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const schema = z.object({
  description: z.string().min(3).max(500),
  origin: z.string().max(3).default('US'),
  value_usd: z.number().positive().max(10_000_000),
  weight_kg: z.number().min(0).max(1_000_000).default(0),
})

const TMEC_COUNTRIES = new Set(['US', 'USA', 'CA', 'CAN', 'MX', 'MEX'])
const BROKERAGE_FEE_USD = 350

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  const { description, origin, value_usd, weight_kg } = parsed.data
  const companyId = session.role === 'client' ? session.companyId : (body.company_id || session.companyId)
  const isTmec = TMEC_COUNTRIES.has(origin.toUpperCase())

  try {
    const [dtaRates, ivaRate, tcData] = await Promise.all([getDTARates(), getIVARate(), getExchangeRate()])
    const tc = tcData.rate
    const valorMXN = value_usd * tc

    // DTA
    const dta = dtaRates.A1?.amount || 462
    const dtaUSD = Math.round(dta / tc)

    // IGI — use 5% default, 0% if T-MEC
    const igiRate = isTmec ? 0 : 0.05
    const igi = valorMXN * igiRate
    const igiUSD = Math.round(igi / tc)

    // IVA (cascading)
    const ivaBase = valorMXN + dta + igi
    const iva = ivaBase * ivaRate
    const ivaUSD = Math.round(iva / tc)

    const totalDuties = dtaUSD + igiUSD + ivaUSD
    const totalWithFees = totalDuties + BROKERAGE_FEE_USD

    // T-MEC comparison
    const tmecIgi = 0
    const tmecIvaBase = valorMXN + dta + tmecIgi
    const tmecIva = tmecIvaBase * ivaRate
    const tmecTotalUSD = dtaUSD + Math.round(tmecIva / tc) + BROKERAGE_FEE_USD
    const tmecSavings = isTmec ? 0 : totalWithFees - tmecTotalUSD

    // Historical accuracy — find similar shipments
    const searchTerm = description.split(' ').filter(w => w.length > 3)[0] || ''
    const { data: similar } = await supabase
      .from('traficos')
      .select('importe_total')
      .eq('company_id', companyId)
      .ilike('descripcion_mercancia', `%${searchTerm}%`)
      .not('importe_total', 'is', null)
      .gte('fecha_llegada', '2024-01-01')
      .limit(50)

    const sampleSize = similar?.length || 0
    const confidence = sampleSize >= 20 ? 94 : sampleSize >= 10 ? 88 : sampleSize >= 5 ? 78 : 65

    return NextResponse.json({
      prediction: {
        aranceles_usd: igiUSD,
        dta_usd: dtaUSD,
        iva_usd: ivaUSD,
        honorarios_usd: BROKERAGE_FEE_USD,
        total_usd: totalWithFees,
        total_con_tmec_usd: isTmec ? totalWithFees : tmecTotalUSD,
        ahorro_tmec_usd: tmecSavings,
        tmec_eligible: isTmec,
        tipo_cambio: tc,
        confidence_pct: confidence,
        sample_size: sampleSize,
        disclaimer: 'Estimado sujeto a verificación — Patente 3596',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
