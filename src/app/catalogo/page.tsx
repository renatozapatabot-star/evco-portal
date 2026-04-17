import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getCatalogo, groupCatalogoByFraccion, summarizeCatalogo } from '@/lib/catalogo/products'
import { readFreshness } from '@/lib/cockpit/freshness'
import { CatalogoTable } from './_components/CatalogoTable'
import { PageShell, FreshnessBanner } from '@/components/aguila'

// 60 s revalidate smooths the 500-row slice so Ursula doesn't see KPIs
// fluctuate on rapid refresh. Still force-dynamic at the page level —
// the ISR window is a safety net for KPI stability, not a cache-replace.
export const dynamic = 'force-dynamic'
export const revalidate = 60

interface CatalogoPageProps {
  searchParams: Promise<{
    q?: string
    view?: string
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
  const freshness = await readFreshness(supabase, session.companyId)
  const rows = await getCatalogo(supabase, session.companyId, {
    q: sp.q,
    limit: 500,
    proveedor_id: sp.proveedor,
    fraccion_prefix: sp.fraccion,
    classified: sp.estado,
    source_filter: sp.fuente,
    sort: sp.orden,
  })
  const groups = groupCatalogoByFraccion(rows)
  const summary = summarizeCatalogo(rows, groups)
  const mode: 'partes' | 'fracciones' = sp.view === 'partes' ? 'partes' : 'fracciones'

  // Coverage stats for the merged KPI strip — Formato 53 backed vs GlobalPC-only.
  const anexoCovered = rows.filter((r) => r.source_of_truth === 'anexo24_parts').length
  const coveragePct = rows.length > 0 ? Math.round((anexoCovered / rows.length) * 100) : 0
  const driftCount = rows.filter((r) => r.drift === 'fraccion_mismatch' || r.drift === 'description_mismatch').length

  return (
    <PageShell
      title="Catálogo"
      subtitle="Partes de EVCO, proveedores y cobertura del Formato 53 — fuente SAT autoritativa."
      maxWidth={1100}
    >
      <FreshnessBanner reading={freshness} />
      <CatalogoTable
        rows={rows}
        groups={groups}
        summary={summary}
        query={sp.q ?? ''}
        mode={mode}
        coveragePct={coveragePct}
        driftCount={driftCount}
      />
    </PageShell>
  )
}
