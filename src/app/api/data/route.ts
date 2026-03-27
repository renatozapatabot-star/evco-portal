import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ALLOWED_TABLES = [
  'traficos', 'aduanet_facturas', 'entradas', 'documents', 'soia_cruces', 'soia_payment_status',
  'globalpc_facturas', 'globalpc_partidas', 'globalpc_eventos', 'globalpc_contenedores',
  'globalpc_ordenes_carga', 'globalpc_proveedores', 'globalpc_productos', 'globalpc_bultos',
  'econta_facturas', 'econta_facturas_detalle', 'econta_cartera', 'econta_aplicaciones',
  'econta_ingresos', 'econta_egresos', 'econta_anticipos', 'econta_polizas',
]

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const table = params.get('table')

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const limit = Math.min(Number(params.get('limit') || '50'), 5000)
  const orderBy = params.get('order_by') || undefined
  const orderDir = params.get('order_dir') === 'asc'

  let q = supabase.from(table).select('*').limit(limit)

  // Apply filters
  const claveCliente = params.get('clave_cliente')
  if (claveCliente) q = q.eq('clave_cliente', claveCliente)

  const cveCliente = params.get('cve_cliente')
  if (cveCliente) q = q.eq('cve_cliente', cveCliente)

  const companyId = params.get('company_id')
  if (companyId) q = q.eq('company_id', companyId)

  const traficoPrefix = params.get('trafico_prefix')
  if (traficoPrefix) q = q.like('trafico', `${traficoPrefix}%`)

  const cveTrafico = params.get('cve_trafico')
  if (cveTrafico) q = q.eq('cve_trafico', cveTrafico)

  if (orderBy) q = q.order(orderBy, { ascending: orderDir })

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
