import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import type { PedimentoRow } from '@/lib/pedimento-types'
import { PagoPeceClient } from './PagoPeceClient'

interface TraficoLite {
  trafico: string
  company_id: string | null
  pedimento: string | null
}

interface ExistingPayment {
  id: string
  status: 'intent' | 'submitted' | 'confirmed' | 'rejected'
  bank_code: string
  amount: number
  reference: string
  confirmation_number: string | null
  created_at: string
}

export default async function PagoPecePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(
    cookieStore.get('portal_session')?.value ?? '',
  )
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

  const { data: existing } = await supabase
    .from('pece_payments')
    .select('id, status, bank_code, amount, reference, confirmation_number, created_at')
    .eq('pedimento_id', pedimento.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ExistingPayment>()

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
            Pago PECE
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

        <PagoPeceClient
          pedimentoId={pedimento.id}
          traficoId={traficoId}
          pedimentoNumber={pedimento.pedimento_number ?? null}
          existing={existing ?? null}
        />
      </div>
    </main>
  )
}
