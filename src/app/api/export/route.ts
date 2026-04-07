import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { z } from 'zod'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const exportSchema = z.object({
  type: z.enum(['traficos', 'pedimentos', 'entradas', 'financiero']),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  const { type, date_from, date_to } = parsed.data
  const companyId = session.role === 'client' ? session.companyId : (body.company_id || session.companyId)

  let query
  let filename = ''
  const dateStr = new Date().toISOString().split('T')[0]

  switch (type) {
    case 'traficos':
      query = supabase.from('traficos')
        .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia, proveedores, peso_bruto')
        .eq('company_id', companyId)
        .order('fecha_llegada', { ascending: false })
        .limit(5000)
      if (date_from) query = query.gte('fecha_llegada', date_from)
      if (date_to) query = query.lte('fecha_llegada', date_to)
      filename = `traficos_${companyId}_${dateStr}.csv`
      break

    case 'pedimentos':
      query = supabase.from('aduanet_facturas')
        .select('pedimento, referencia, proveedor, valor_usd, dta, igi, iva, fecha_pago, moneda')
        .eq('clave_cliente', req.cookies.get('company_clave')?.value || '')
        .order('fecha_pago', { ascending: false })
        .limit(5000)
      if (date_from) query = query.gte('fecha_pago', date_from)
      if (date_to) query = query.lte('fecha_pago', date_to)
      filename = `pedimentos_${companyId}_${dateStr}.csv`
      break

    case 'entradas':
      query = supabase.from('entradas')
        .select('cve_entrada, trafico, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, mercancia_danada')
        .eq('company_id', companyId)
        .order('fecha_llegada_mercancia', { ascending: false })
        .limit(5000)
      if (date_from) query = query.gte('fecha_llegada_mercancia', date_from)
      if (date_to) query = query.lte('fecha_llegada_mercancia', date_to)
      filename = `entradas_${companyId}_${dateStr}.csv`
      break

    case 'financiero':
      query = supabase.from('aduanet_facturas')
        .select('pedimento, referencia, proveedor, valor_usd, dta, igi, iva, fecha_pago, moneda, cove')
        .eq('clave_cliente', req.cookies.get('company_clave')?.value || '')
        .order('fecha_pago', { ascending: false })
        .limit(5000)
      if (date_from) query = query.gte('fecha_pago', date_from)
      if (date_to) query = query.lte('fecha_pago', date_to)
      filename = `financiero_${companyId}_${dateStr}.csv`
      break
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Sin datos para exportar' }, { status: 404 })

  // Build CSV
  const columns = Object.keys(data[0])
  const header = columns.join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const val = (row as Record<string, unknown>)[col]
      if (val == null) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')

  // Audit log
  supabase.from('audit_log').insert({
    action: 'data_exported',
    resource: type,
    resource_id: companyId,
    diff: { type, rows: data.length, date_from, date_to, filename },
    created_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.error('[audit-log] export:', e.message))

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
