// CRUZ · /anexo-24 — Formato 53 report surface, 13-column GlobalPC parity.
//
// Single source of truth: `fetchAnexo24Rows` (src/lib/anexo24/fetchRows.ts).
// The screen, the PDF, the Excel, and the CSV all read from the same
// helper and the same `ANEXO24_COLUMNS` contract — drift between
// surfaces is what shipped a `(placeholder)` XLSX to a client; this
// surface ends that drift.

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { CockpitSkeleton, CockpitErrorCard } from '@/components/aguila'
import { Anexo24DownloadCta } from './Anexo24DownloadCta'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateDMY, formatNumber, formatCurrencyUSD } from '@/lib/format'
import { fetchAnexo24Rows, type Anexo24Row } from '@/lib/anexo24/fetchRows'
import { ANEXO24_COLUMNS } from '@/lib/anexo24/columns'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

type SessionLike = { companyId: string; role: string; name?: string }

export default async function Anexo24Page({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const sp = await searchParams
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Anexo24Content session={session} from={sp.from} to={sp.to} />
    </Suspense>
  )
}

async function Anexo24Content({
  session,
  from,
  to,
}: {
  session: SessionLike
  from?: string
  to?: string
}) {
  try {
    const supabase = createServerClient()
    const cookieStore = await cookies()
    const rawClientName = decodeURIComponent(cookieStore.get('company_name')?.value ?? '')
    const clientName = cleanCompanyDisplayName(rawClientName) || 'Cliente'
    const isInternal = session.role === 'broker' || session.role === 'admin'
    const ownerCompanyId = session.companyId
    if (!ownerCompanyId) notFound()

    const today = new Date().toISOString().slice(0, 10)
    const yearStart = `${new Date().getUTCFullYear()}-01-01`
    const dateFrom = from ?? yearStart
    const dateTo = to ?? today

    const { rows, truncated } = await fetchAnexo24Rows({
      supabase,
      companyId: ownerCompanyId,
      dateFrom,
      dateTo,
    })

    const meta: Array<[string, string]> = [
      ['Cliente', clientName],
      ['Patente', '3596'],
      ['Aduana', '240'],
      ['Periodo', `${formatDateDMY(dateFrom)} a ${formatDateDMY(dateTo)}`],
      ['Partidas', formatNumber(rows.length)],
    ]

    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Inteligencia aduanal · Patente 3596</div>
          <h1 className={styles.title}>ANEXO 24 · FORMATO 53</h1>
          <div className={styles.meta}>
            {meta.map(([label, value]) => (
              <span key={label} className={styles.metaItem}>
                <span className={styles.metaLabel}>{label}</span>
                <span className={styles.metaValue}>{value}</span>
              </span>
            ))}
          </div>
        </header>

        <section className={styles.cta}>
          <Anexo24DownloadCta companyId={ownerCompanyId} isInternal={isInternal} />
        </section>

        {truncated && (
          <EmptyState
            title="Rango parcial · descarga deshabilitada"
            description="El periodo solicitado excede el límite de partidas que podemos garantizar en una sola corrida. Reduce el rango antes de exportar."
          />
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="Sin partidas en este periodo"
            description="Sube el Formato 53 más reciente o ajusta el rango."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} role="table" aria-label="Partidas Anexo 24">
              <thead>
                <tr>
                  {ANEXO24_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={col.align === 'right' ? { textAlign: 'right' } : undefined}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.embarque}-${r.consecutivo}`}>
                    {ANEXO24_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={cellClasses(col.mono, col.align === 'right')}
                        title={col.key === 'descripcion' ? r.descripcion ?? undefined : col.key === 'proveedor' ? r.proveedor : undefined}
                      >
                        {renderCell(r, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'NEXT_REDIRECT' || msg === 'NEXT_NOT_FOUND') throw err
    return <CockpitErrorCard message={`No se pudo cargar Anexo 24: ${msg}`} />
  }
}

function cellClasses(mono: boolean, right: boolean): string {
  const out: string[] = []
  if (mono) out.push(styles.cellMono)
  if (right) out.push(styles.cellRight)
  return out.join(' ')
}

function renderCell(row: Anexo24Row, key: (typeof ANEXO24_COLUMNS)[number]['key']): string {
  switch (key) {
    case 'consecutivo':
      return String(row.consecutivo)
    case 'pedimento':
      return row.pedimento ?? '—'
    case 'fecha':
      return formatDateDMY(row.fecha) || '—'
    case 'embarque':
      return row.embarque || '—'
    case 'fraccion':
      return row.fraccion || '—'
    case 'descripcion':
      return row.descripcion || '—'
    case 'cantidad':
      return formatNumber(row.cantidad) || '—'
    case 'umc':
      return row.umc || '—'
    case 'valor_usd':
      return row.valor_usd != null ? formatCurrencyUSD(row.valor_usd) : '—'
    case 'proveedor':
      return row.proveedor || '—'
    case 'pais':
      return row.pais || '—'
    case 'regimen':
      return row.regimen || '—'
    case 'tmec':
      return row.tmec ? 'Sí' : 'No'
    default:
      return '—'
  }
}
