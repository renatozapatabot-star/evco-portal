import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  // Look up clave from companies table for multi-tenant support
  const { data: company } = await supabase.from('companies').select('clave_cliente').eq('company_id', auth.company_id).single()
  const clave = company?.clave_cliente || auth.company_id
  const { data: facturas } = await supabase.from('aduanet_facturas')
    .select('valor_usd, igi, dta, iva, pedimento, fecha_pago')
    .eq('clave_cliente', clave)

  const rows = facturas || []
  const totalValue = rows.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
  const totalIGI = rows.reduce((s, f) => s + (Number(f.igi) || 0), 0)
  const totalDTA = rows.reduce((s, f) => s + (Number(f.dta) || 0), 0)
  const totalIVA = rows.reduce((s, f) => s + (Number(f.iva) || 0), 0)
  const tmecOps = rows.filter(f => Number(f.igi || 0) === 0).length
  const tmecSavingsEstimate = tmecOps * (totalValue / rows.length * 0.05 * 20) || 0
  const pedimentos = new Set(rows.map(f => f.pedimento).filter(Boolean)).size

  return NextResponse.json({
    total_value_usd: Math.round(totalValue),
    total_igi_mxn: Math.round(totalIGI),
    total_dta_mxn: Math.round(totalDTA),
    total_iva_mxn: Math.round(totalIVA),
    total_duties_mxn: Math.round(totalIGI + totalDTA + totalIVA),
    tmec_operations: tmecOps,
    tmec_savings_estimate_mxn: Math.round(tmecSavingsEstimate),
    pedimentos_count: pedimentos,
    operations_count: rows.length,
  })
}
