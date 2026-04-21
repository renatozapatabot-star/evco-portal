import { NextRequest, NextResponse } from 'next/server'
import { getDTARates, getIVARate, getExchangeRate } from '@/lib/rates'
import { verifySession } from '@/lib/session'
import { z } from 'zod'

const quoteSchema = z.object({
  valor_usd: z.number().positive().max(100_000_000),
  fraccion: z.string().max(12).optional(),
  pais_origen: z.string().max(3).default('US'),
  peso_kg: z.number().min(0).max(1_000_000).optional(),
  bultos: z.number().int().min(0).max(100_000).optional(),
  incoterm: z.enum(['EXW', 'FOB', 'FCA', 'CPT', 'CIP', 'DAP', 'DDP', 'CFR', 'CIF']).default('EXW'),
  flete_usd: z.number().min(0).default(0),
  seguro_usd: z.number().min(0).default(0),
  regimen: z.enum(['A1', 'IN', 'ITE', 'ITR', 'IMD']).default('A1'),
  igi_rate_pct: z.number().min(0).max(100).default(5),
  tmec: z.boolean().default(false),
})

const TMEC_COUNTRIES = new Set(['US', 'CA', 'MX', 'USA', 'CAN', 'MEX'])

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = quoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  try {
    const [dtaRates, ivaRate, tcData] = await Promise.all([
      getDTARates(), getIVARate(), getExchangeRate(),
    ])
    const tc = tcData.rate

    // Valor aduana depends on incoterm
    let valorAduanaUSD = input.valor_usd
    if (['EXW', 'FOB', 'FCA'].includes(input.incoterm)) {
      valorAduanaUSD += input.flete_usd + input.seguro_usd
    } else if (['CFR', 'CPT'].includes(input.incoterm)) {
      valorAduanaUSD += input.seguro_usd
    }

    const valorAduanaMXN = valorAduanaUSD * tc

    // DTA — map regime to rate tier
    const regimenMap: Record<string, string> = { A1: 'A1', IN: 'IN', ITE: 'IT', ITR: 'IT', IMD: 'A1' }
    const tierKey = regimenMap[input.regimen] || 'A1'
    const dtaConfig = (dtaRates as unknown as Record<string, { rate?: number; type?: string; amount?: number }>)[tierKey] || dtaRates.A1
    const dta = dtaConfig.type === 'fixed'
      ? (dtaConfig.amount || 408)
      : valorAduanaMXN * (dtaConfig.rate || 0.008)

    // IGI — T-MEC check
    const tmecEligible = input.tmec || TMEC_COUNTRIES.has(input.pais_origen.toUpperCase())
    const igiRate = tmecEligible ? 0 : input.igi_rate_pct / 100
    const igi = valorAduanaMXN * igiRate

    // IVA — cascading base (NEVER flat)
    const ivaBase = valorAduanaMXN + dta + igi
    const iva = ivaBase * ivaRate

    // Prevalidación (PREV)
    const prev = 347.09

    const totalContribuciones = Math.round((dta + igi + iva + prev) * 100) / 100

    // T-MEC savings
    const tmecSavings = tmecEligible
      ? Math.round(valorAduanaMXN * (input.igi_rate_pct / 100) * 100) / 100
      : 0

    return NextResponse.json({
      quote: {
        valor_usd: input.valor_usd,
        valor_aduana_usd: Math.round(valorAduanaUSD * 100) / 100,
        valor_aduana_mxn: Math.round(valorAduanaMXN * 100) / 100,
        tipo_cambio: tc,
        incoterm: input.incoterm,
        regimen: input.regimen,
        fraccion: input.fraccion || null,
        pais_origen: input.pais_origen,
        dta: { rate: dtaConfig.rate || 0, amount_mxn: Math.round(dta * 100) / 100 },
        igi: { rate: igiRate, amount_mxn: Math.round(igi * 100) / 100, tmec: tmecEligible },
        iva: { rate: ivaRate, base_mxn: Math.round(ivaBase * 100) / 100, amount_mxn: Math.round(iva * 100) / 100 },
        prev: prev,
        total_contribuciones_mxn: totalContribuciones,
        tmec_eligible: tmecEligible,
        tmec_savings_mxn: tmecSavings,
        disclaimer: 'Estimado sujeto a verificación — Renato Zapata III, Patente 3596, Aduana 240',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error calculando cotización'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
