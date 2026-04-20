import { NextRequest, NextResponse } from 'next/server'
import { getDTARates, getExchangeRate, getIVARate } from '@/lib/rates'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TMEC_REGIMES = ['ITE', 'ITR', 'IMD']
const TMEC_COUNTRIES = ['USA', 'US', 'UNITED STATES', 'ESTADOS UNIDOS', 'CANADA', 'CANADÁ', 'CA', 'CAN']

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req.cookies.get('portal_session')?.value ?? '')
    if (!session) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
    }
    // Client: always session. Internal roles: ?company_id= query param
    // (never raw cookie — forgeable per core-invariants rule 15).
    const companyId = session.role === 'client'
      ? session.companyId
      : (req.nextUrl.searchParams.get('company_id') || session.companyId)

    const body = await req.json()
    const { draftId, valorUSD, regimen, paisOrigen } = body

    if (!draftId) {
      return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'draftId required' } }, { status: 400 })
    }

    // Fetch fresh rates
    const [dtaRates, exchangeRateData, ivaRate] = await Promise.all([
      getDTARates(),
      getExchangeRate(),
      getIVARate(),
    ])

    const exchangeRate = exchangeRateData.rate
    const valorAduanaMXN = Math.round((valorUSD || 0) * exchangeRate * 100) / 100

    // DTA
    const dtaConfig = dtaRates[regimen as keyof typeof dtaRates] || dtaRates.A1
    const dtaAmount = dtaConfig.amount

    // T-MEC check
    const regimeOK = TMEC_REGIMES.includes((regimen || '').toUpperCase())
    const countryOK = TMEC_COUNTRIES.includes((paisOrigen || '').toUpperCase().trim())
    const isTMEC = regimeOK || countryOK
    const igiRate = isTMEC ? 0 : 0 // TODO(v1.5): lookup from tariff_rates table
    const igiAmount = Math.round(valorAduanaMXN * igiRate * 100) / 100

    // IVA — cascading base
    const ivaBase = valorAduanaMXN + dtaAmount + igiAmount
    const ivaAmount = Math.round(ivaBase * ivaRate * 100) / 100

    const contributions = {
      valor_aduana_usd: valorUSD,
      valor_aduana_mxn: valorAduanaMXN,
      tipo_cambio: exchangeRate,
      dta: { type: 'fixed' as const, amount_mxn: dtaAmount },
      igi: { rate: igiRate, amount_mxn: igiAmount, tmec: isTMEC },
      iva: { rate: ivaRate, base_mxn: ivaBase, amount_mxn: ivaAmount },
      total_contribuciones_mxn: dtaAmount + igiAmount + ivaAmount,
      currency_labels: { valor: 'USD', contribuciones: 'MXN' },
    }

    // Update draft_data.contributions in Supabase — tenant-guarded.
    const { data: draft, error: fetchErr } = await supabase
      .from('pedimento_drafts')
      .select('draft_data, company_id')
      .eq('id', draftId)
      .single()

    if (fetchErr || !draft) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 })
    }
    if (session.role === 'client' && draft.company_id && draft.company_id !== companyId) {
      return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Acceso cruzado denegado' } }, { status: 403 })
    }

    const updatedDraftData = {
      ...draft.draft_data,
      contributions,
      regimen: regimen || draft.draft_data.regimen,
      pais_origen: paisOrigen || draft.draft_data.pais_origen,
    }

    if (valorUSD !== undefined) {
      updatedDraftData.extraction = {
        ...draft.draft_data.extraction,
        total_value: valorUSD,
      }
    }

    await supabase
      .from('pedimento_drafts')
      .update({ draft_data: updatedDraftData })
      .eq('id', draftId)

    return NextResponse.json({ data: { contributions, isTMEC }, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
