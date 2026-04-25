import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getCatalogo } from '@/lib/catalogo/products'
import { CatalogoTable } from './_components/CatalogoTable'
import { PageShell } from '@/components/aguila'

// 60 s revalidate smooths the 500-row slice across rapid refreshes;
// page is force-dynamic so the slice itself stays per-request.
export const dynamic = 'force-dynamic'
export const revalidate = 60

interface CatalogoPageProps {
  searchParams: Promise<{
    q?: string
    proveedor?: string
    fraccion?: string
    estado?: 'all' | 'classified' | 'unclassified'
    fuente?: 'all' | 'anexo24' | 'only_globalpc' | 'drift'
    orden?: 'alfabetico' | 'mas_usado' | 'mas_reciente' | 'valor_ytd'
  }>
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const sp = await searchParams
  const supabase = createServerClient()
  const rows = await getCatalogo(supabase, session.companyId, {
    q: sp.q,
    limit: 500,
    proveedor_id: sp.proveedor,
    fraccion_prefix: sp.fraccion,
    classified: sp.estado,
    source_filter: sp.fuente,
    sort: sp.orden,
  })

  return (
    <PageShell title="Catálogo" maxWidth={1100}>
      <CatalogoTable rows={rows} query={sp.q ?? ''} />
    </PageShell>
  )
}
