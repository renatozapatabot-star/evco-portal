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

    return NextResponse.json({
      dta: { rate: dta.A1.rate },
      iva: { rate: iva },
      tc: { rate: tc.rate, date: tc.date, source: tc.source },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch rates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
