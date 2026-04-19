import { createClient } from '@supabase/supabase-js'
import type { CarrierFull } from '@/lib/carriers'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { AdminCarriersList } from './_components/AdminCarriersList'
import { requireOwner } from '@/lib/route-guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminCarriersPage() {
  // V1 · admin/broker only. Was reading raw user_role cookie (forgeable);
  // requireOwner reads the signed portal_session token via verifySession.
  await requireOwner()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, count } = await supabase
    .from('carriers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .limit(500)

  const carriers = (data ?? []) as CarrierFull[]

  return (
    <main
      className="aduana-dark"
      style={{ padding: 24, minHeight: '100vh', color: 'var(--portal-fg-1)' }}
    >
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>
          <AguilaMark size={18} tone="silver" />
          <AguilaWordmark size={14} tone="silver" />
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
          Catálogo de transportistas
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
          {count ?? 0} registros · MX · Transfer · Foreign
        </p>
      </header>
      <AdminCarriersList initialCarriers={carriers} />
    </main>
  )
}
