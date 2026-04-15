import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const SAMPLE_TRAFICOS = [
  { suffix: 'DEMO-001', estatus: 'En Proceso', descripcion: 'RESINA POLIETILENO (MUESTRA)', importe: 45000, semaforo: 'verde' },
  { suffix: 'DEMO-002', estatus: 'En Proceso', descripcion: 'VÁLVULAS INDUSTRIALES (MUESTRA)', importe: 32000, semaforo: 'verde' },
  { suffix: 'DEMO-003', estatus: 'En Proceso', descripcion: 'CAPACITORES ELECTRÓNICOS (MUESTRA)', importe: 18500, semaforo: 'amarillo' },
  { suffix: 'DEMO-004', estatus: 'Pedimento Pagado', descripcion: 'TUBERÍA DE ACERO (MUESTRA)', importe: 67000, semaforo: 'verde' },
  { suffix: 'DEMO-005', estatus: 'Pedimento Pagado', descripcion: 'MOTOR ELÉCTRICO (MUESTRA)', importe: 28000, semaforo: 'verde' },
  { suffix: 'DEMO-006', estatus: 'Cruzado', descripcion: 'ACEITE HIDRÁULICO (MUESTRA)', importe: 12000, semaforo: 'verde' },
  { suffix: 'DEMO-007', estatus: 'Cruzado', descripcion: 'RODAMIENTOS (MUESTRA)', importe: 9500, semaforo: 'verde' },
  { suffix: 'DEMO-008', estatus: 'En Proceso', descripcion: 'BOBINAS DE COBRE (MUESTRA)', importe: 54000, semaforo: 'rojo' },
  { suffix: 'DEMO-009', estatus: 'Cruzado', descripcion: 'FILM DE EMPAQUE (MUESTRA)', importe: 7200, semaforo: 'verde' },
  { suffix: 'DEMO-010', estatus: 'En Proceso', descripcion: 'CIRCUITOS IMPRESOS (MUESTRA)', importe: 22000, semaforo: 'amarillo' },
]

export async function POST(request: NextRequest) {
  // Seed-sample writes DEMO traficos into the caller's tenant. Gate on
  // a verified session — without this, any visitor could POST { slug:
  // '<any-company>' } and pollute real tenants with demo rows.
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token).catch(() => null)
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await request.json()
  const slug = body.slug as string
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  // Only allow seeding into the caller's own company (or admin/broker
  // seeding for any tenant, e.g. onboarding a new client).
  if (slug !== session.companyId && !['admin', 'broker'].includes(session.role)) {
    return NextResponse.json(
      { error: 'Forbidden — cannot seed into another tenant' },
      { status: 403 },
    )
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let inserted = 0
  for (const t of SAMPLE_TRAFICOS) {
    const { error } = await sb.from('traficos').insert({
      trafico: `${slug}-${t.suffix}`,
      company_id: slug,
      estatus: t.estatus,
      descripcion_mercancia: t.descripcion,
      importe_total: t.importe,
      semaforo: t.semaforo,
      aduana: '240',
      patente: '3596',
    })
    if (!error) inserted++
  }

  return NextResponse.json({ data: { inserted }, error: null })
}
