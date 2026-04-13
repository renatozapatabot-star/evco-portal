import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import type { PedimentoRow } from '@/lib/pedimento-types'
import { ExportarClient } from './ExportarClient'

interface TraficoLite {
  trafico: string
  company_id: string | null
  pedimento: string | null
}

export default async function ExportarPedimentoPage({
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

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, company_id, pedimento')
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: trafico } = await traficoQ.maybeSingle<TraficoLite>()
  if (!trafico) notFound()

  const { data: pedimento } = await supabase
    .from('pedimentos')
    .select('*')
    .eq('trafico_id', traficoId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<PedimentoRow>()

  if (!pedimento) {
    redirect(`/embarques/${encodeURIComponent(traficoId)}/pedimento`)
  }

  return (
    <main className="min-h-screen aduana-dark px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm">
          <Link
            href={`/embarques/${encodeURIComponent(traficoId)}/pedimento`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver al pedimento
          </Link>
        </nav>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-100">
            Exportar pedimento
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Embarque{' '}
            <span className="font-mono text-slate-200">{trafico.trafico}</span>
            {pedimento.pedimento_number ? (
              <>
                {' · Pedimento '}
                <span className="font-mono text-slate-200">
                  {pedimento.pedimento_number}
                </span>
              </>
            ) : null}
          </p>
        </header>

        {/* AMBER placeholder banner — mandated by Block 9 spec */}
        <div
          role="status"
          className="mb-6 rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: 'rgba(212,149,42,0.10)',
            borderColor: 'rgba(212,149,42,0.35)',
          }}
        >
          <p className="text-sm" style={{ color: '#FBBF24' }}>
            Formato AduanaNet M3 pendiente — usando estructura placeholder.
            Reemplazar cuando tengamos archivo de referencia.
          </p>
        </div>

        <ExportarClient pedimentoId={pedimento.id} traficoId={traficoId} />
      </div>
    </main>
  )
}
