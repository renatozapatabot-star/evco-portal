import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { SubirClient, type TraficoOption } from '@/app/operador/subir/SubirClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const EXCLUDED_ESTATUS = ['Cruzado', 'Cancelado']

/**
 * /bodega/subir — warehouse-scoped document upload landing.
 *
 * Shares the operator SubirClient component (embarque picker + DocUploader).
 * Warehouse role sees all active embarques across clients — Vicente works the floor.
 */
export default async function BodegaSubirPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (session.role === 'client' || session.role === 'operator') redirect('/inicio')
  if (!['warehouse', 'admin', 'broker'].includes(session.role)) redirect('/login')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: traficos } = await sb
    .from('traficos')
    .select('id, trafico, estatus, company_id, fecha_llegada')
    .not('estatus', 'in', `(${EXCLUDED_ESTATUS.map((s) => `"${s}"`).join(',')})`)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('fecha_llegada', { ascending: false })
    .limit(200)

  const companyIds = Array.from(
    new Set((traficos ?? []).map((t) => t.company_id).filter((x): x is string => Boolean(x))),
  )
  const companyNameById = new Map<string, string>()
  if (companyIds.length > 0) {
    const { data: companies } = await sb
      .from('companies')
      .select('id, razon_social, nombre_comercial')
      .in('id', companyIds)
    for (const c of companies ?? []) {
      const id = c.id as string
      const display = (c.nombre_comercial as string | null) || (c.razon_social as string | null) || id
      companyNameById.set(id, display)
    }
  }

  const options: TraficoOption[] = (traficos ?? []).map((t) => ({
    id: t.id as string,
    trafico: (t.trafico as string | null) ?? '',
    estatus: (t.estatus as string | null) ?? '—',
    clienteName:
      (t.company_id && companyNameById.get(t.company_id as string)) ||
      (t.company_id as string | null) ||
      '—',
  }))

  return <SubirClient traficos={options} />
}
