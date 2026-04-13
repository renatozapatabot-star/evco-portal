import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const carrier = params.get('carrier')
  const page = parseInt(params.get('page') || '1')
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const offset = (page - 1) * limit

  let query = supabase.from('traficos')
    .select('trafico, estatus, fecha_llegada, descripcion_mercancia, peso_bruto, importe_total, pedimento, transportista_extranjero', { count: 'exact' })
    .eq('company_id', auth.company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)

  if (status) query = query.ilike('estatus', `%${status}%`)
  if (dateFrom) query = query.gte('fecha_llegada', dateFrom)
  if (dateTo) query = query.lte('fecha_llegada', dateTo)
  if (carrier) query = query.ilike('transportista_extranjero', `%${carrier}%`)

  const { data, count } = await query.order('fecha_llegada', { ascending: false }).range(offset, offset + limit - 1)

  return NextResponse.json({
    data: data || [],
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
  })
}
