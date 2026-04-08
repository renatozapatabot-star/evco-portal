import { NextResponse } from 'next/server'
import { getDTARates, getIVARate, getExchangeRate } from '@/lib/rates'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [dta, iva, tc] = await Promise.all([
      getDTARates(),
      getIVARate(),
      getExchangeRate(),
    ])

    // DTA is a fixed fee per pedimento (not a percentage of valor)
    const dtaA1 = dta.A1 || {}
    return NextResponse.json({
      dta: { amount: dtaA1.amount || 462, type: dtaA1.type || 'fixed' },
      iva: { rate: iva },
      tc: { rate: tc.rate, date: tc.date, source: tc.source },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch rates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
