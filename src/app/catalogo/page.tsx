import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getCatalogo, groupCatalogoByFraccion, summarizeCatalogo } from '@/lib/catalogo/products'
import { CatalogoTable } from './_components/CatalogoTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CatalogoPageProps {
  searchParams: Promise<{ q?: string; view?: string }>
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { q, view } = await searchParams
  const supabase = createServerClient()
  const rows = await getCatalogo(supabase, session.companyId, { q, limit: 500 })
  const groups = groupCatalogoByFraccion(rows)
  const summary = summarizeCatalogo(rows, groups)
  const mode: 'partes' | 'fracciones' = view === 'partes' ? 'partes' : 'fracciones'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
        Catálogo
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.6)' }}>
        Productos agrupados por fracción arancelaria · proveedores y consolidación de un vistazo.
      </p>
      <CatalogoTable rows={rows} groups={groups} summary={summary} query={q ?? ''} mode={mode} />
    </div>
  )
}
