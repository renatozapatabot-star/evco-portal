import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { RegulatoryDocClient } from './RegulatoryDocClient'

interface TraficoLite {
  trafico: string
  company_id: string | null
  pedimento: string | null
}

export default async function DodaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  let q = supabase
    .from('traficos')
    .select('trafico, company_id, pedimento')
    .eq('trafico', traficoId)
  if (!isInternal) q = q.eq('company_id', session.companyId)
  const { data: trafico } = await q.maybeSingle<TraficoLite>()
  if (!trafico) notFound()

  return (
    <main className="min-h-screen aduana-dark px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm">
          <Link
            href={`/traficos/${encodeURIComponent(traficoId)}`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver al tráfico
          </Link>
        </nav>

        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 opacity-80">
            <AguilaMark size={18} tone="silver" />
            <AguilaWordmark size={14} tone="silver" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">DODA</h1>
          <p className="mt-2 text-sm text-slate-400">
            Documento de operación para despacho aduanero · Tráfico{' '}
            <span className="font-mono text-slate-200">{trafico.trafico}</span>
            {trafico.pedimento ? (
              <>
                {' · Pedimento '}
                <span className="font-mono text-slate-200">{trafico.pedimento}</span>
              </>
            ) : null}
          </p>
        </header>

        <RegulatoryDocClient
          apiPath={`/api/regulatory/doda/${encodeURIComponent(traficoId)}`}
          docLabelEs="DODA"
        />
      </div>
    </main>
  )
}
