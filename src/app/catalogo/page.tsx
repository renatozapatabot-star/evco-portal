import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getCatalogo } from '@/lib/catalogo/products'
import { CatalogoTable } from './_components/CatalogoTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CatalogoPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { q } = await searchParams
  const supabase = createServerClient()
  const rows = await getCatalogo(supabase, session.companyId, { q, limit: 100 })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
        Catálogo de productos
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        Tu inventario de productos con fracción arancelaria y último embarque.
      </p>
      <CatalogoTable rows={rows} query={q ?? ''} total={rows.length} />
    </div>
  )
}
