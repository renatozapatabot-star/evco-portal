/**
 * ZAPATA AI · Block 10 — Anexo 24 generator page.
 *
 * Date range picker, optional cliente filter (broker/admin only),
 * "Generar Anexo 24" button. AMBER banner warns that the column structure
 * is placeholder until verified against a GlobalPC sample.
 */
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { Anexo24Client } from './Anexo24Client'

export const dynamic = 'force-dynamic'

export default async function ReportesAnexo24Page() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'

  return (
    <main className="min-h-screen aduana-dark px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/reportes"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver a reportes
          </Link>
        </nav>

        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 opacity-80">
            <AguilaMark size={18} tone="silver" />
            <AguilaWordmark size={14} tone="silver" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">Anexo 24</h1>
          <p className="mt-2 text-sm text-slate-400">
            Generación de reporte Anexo 24 en PDF y Excel. Filtra por periodo
            y descarga ambos formatos.
          </p>
        </header>

        <div
          role="status"
          className="mb-6 rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: 'rgba(212,149,42,0.10)',
            borderColor: 'rgba(212,149,42,0.35)',
          }}
        >
          <p className="text-sm" style={{ color: '#FBBF24' }}>
            Formato Anexo 24 pendiente verificación — comparar contra muestra
            de GlobalPC antes de uso oficial.
          </p>
        </div>

        <Anexo24Client isInternal={isInternal} companyId={session.companyId} />
      </div>
    </main>
  )
}
