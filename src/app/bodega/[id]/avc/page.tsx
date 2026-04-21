import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { RegulatoryDocClient } from '@/app/embarques/[id]/doda/RegulatoryDocClient'

interface WarehouseEntryLite {
  id: string
  trafico_id: string
  company_id: string | null
  trailer_number: string
}

export default async function AvcPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const entryId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  let q = supabase
    .from('warehouse_entries')
    .select('id, trafico_id, company_id, trailer_number')
    .eq('id', entryId)
  if (!isInternal) q = q.eq('company_id', session.companyId)
  const { data: entry } = await q.maybeSingle<WarehouseEntryLite>()
  if (!entry) notFound()

  return (
    <main className="min-h-screen aduana-dark px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/bodega/recibir"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver a bodega
          </Link>
        </nav>

        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 opacity-80">
            <AguilaMark size={18} tone="silver" />
            <AguilaWordmark size={14} tone="silver" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">AVC</h1>
          <p className="mt-2 text-sm text-slate-400">
            Aviso de cruce · Caja{' '}
            <span className="font-mono text-slate-200">{entry.trailer_number}</span>
            {' · Embarque '}
            <span className="font-mono text-slate-200">{entry.trafico_id}</span>
          </p>
        </header>

        <RegulatoryDocClient
          apiPath={`/api/regulatory/avc/${encodeURIComponent(entryId)}`}
          docLabelEs="AVC"
          fallbackHref="https://trafico1web.globalpc.net/traficos/avc"
          fallbackLabel="AVC"
        />
      </div>
    </main>
  )
}
