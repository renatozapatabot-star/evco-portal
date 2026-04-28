import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { formatPedimento } from '@/lib/format/pedimento'
import { isCleared, clearanceLabelES } from '@/lib/pedimentos/clearance'
import { linkForTrafico } from '@/lib/links/entity-links'
import { formatDateDMY } from '@/lib/format'
import { EmptyState } from '@/components/ui/empty-state'
import { SyncChip } from '@/components/ui/sync-chip'
import { readFreshness } from '@/lib/cockpit/freshness'
import styles from './page.module.css'

/**
 * Expediente Digital — standalone detail (audit lock-in 2026-04-25).
 *
 * Single purpose: list every PDF / document already synced from
 * GlobalPC for one expediente (keyed by trafico slug, since
 * `expediente_documentos.pedimento_id` stores the trafico slug).
 *
 * Security envelope mirrors /pedimentos/[id]:
 *   1. Trafico ownership check (HARD invariant — tenant isolation;
 *      not a "new" query, this is required defense-in-depth).
 *   2. ONE additional query — expediente_documentos — anchored to
 *      the verified ownerCompanyId.
 */

/** Pretty doc-type labels — pure presentational mapping of the
 *  string already on the row; no derivation. */
const DOC_TYPE_LABEL: Record<string, string> = {
  factura_comercial: 'Factura comercial',
  packing_list: 'Lista de empaque',
  pedimento_detallado: 'Pedimento',
  pedimento_simplificado: 'Pedimento simplificado',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  doda: 'DODA',
  carta_porte: 'Carta porte',
  bol: 'B/L',
  mve: 'MVE',
  archivos_validacion: 'Validación',
  otro: 'Otro',
}

function labelForDocType(t: string | null | undefined): string {
  if (!t) return 'Sin tipo'
  return DOC_TYPE_LABEL[t] ?? t.replace(/_/g, ' ')
}

/** Required-doc set — same constant the /expedientes list uses for X/Y completeness. */
const REQUIRED_EXPEDIENTE_TYPES = [
  'factura_comercial',
  'packing_list',
  'pedimento_detallado',
  'cove',
  'acuse_cove',
  'doda',
] as const

export default async function ExpedienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId).trim()

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  const TRAFICO_COLS =
    'trafico, pedimento, estatus, fecha_llegada, fecha_cruce, fecha_pago, regimen, aduana, patente, company_id'

  let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const traficoRes = await traficoQ.maybeSingle()
  if (traficoRes.error || !traficoRes.data) notFound()
  const ownerCompanyId = (traficoRes.data as { company_id: string | null }).company_id
  if (!ownerCompanyId) notFound()

  const [{ data: docsData }, freshness] = await Promise.all([
    supabase
      .from('expediente_documentos')
      .select('id, doc_type, file_name, file_url, uploaded_at')
      .eq('pedimento_id', traficoId)
      .eq('company_id', ownerCompanyId)
      .order('uploaded_at', { ascending: false })
      .limit(500),
    readFreshness(supabase, ownerCompanyId),
  ])

  const docs = (docsData ?? []) as Array<{
    id: string
    doc_type: string | null
    file_name: string | null
    file_url: string | null
    uploaded_at: string | null
  }>

  const trafico = traficoRes.data as {
    trafico: string
    pedimento: string | null
    estatus: string | null
    fecha_llegada: string | null
    fecha_cruce: string | null
    fecha_pago: string | null
    regimen: string | null
    aduana: string | null
    patente: string | null
    company_id: string | null
  }

  const status = clearanceLabelES({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const cleared = isCleared({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const pedimentoDisplay = trafico.pedimento
    ? formatPedimento(trafico.pedimento, trafico.pedimento, { dd: '26', ad: '24', pppp: trafico.patente ?? '3596' })
    : null
  const embarqueHref = linkForTrafico(trafico.trafico) ?? '#'

  // Hide status pill entirely when 0 docs — no "Liberado" on an empty
  // expediente.
  const showStatus = docs.length > 0

  // Empty-state ghosted chips: which required docs are missing.
  const presentTypes = new Set(docs.map((d) => d.doc_type).filter(Boolean) as string[])
  const ghostedRequired = REQUIRED_EXPEDIENTE_TYPES
    .filter((t) => !presentTypes.has(t))
    .map((t) => ({ label: DOC_TYPE_LABEL[t] ?? t.replace(/_/g, ' ') }))

  return (
    <main className={styles.detail}>
      <Link href="/expedientes" className={styles.crumb}>
        <ChevronLeft size={14} aria-hidden /> Volver a expedientes
      </Link>

      <header className={styles.header}>
        <div className={styles.eyebrow}>Expediente Digital</div>
        <div className={styles.titleRow}>
          <h1 className={styles.number}>{trafico.trafico}</h1>
          {showStatus && (
            <span className={`${styles.status} ${cleared ? styles.statusCleared : styles.statusPending}`}>
              <span className={styles.statusDot} />
              {status}
            </span>
          )}
          <SyncChip lastSyncIso={freshness.lastSyncedAt} />
        </div>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Embarque</span>
            <Link href={embarqueHref} className={styles.metaLink}>{trafico.trafico}</Link>
          </span>
          {pedimentoDisplay && (
            <span className={styles.metaItem}>
              <span className={styles.metaLabel}>Pedimento</span>
              <span className={styles.metaMono}>{pedimentoDisplay}</span>
            </span>
          )}
          {trafico.regimen && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Régimen</span>{trafico.regimen}</span>
          )}
          {trafico.aduana && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Aduana</span>{trafico.aduana}</span>
          )}
          {trafico.fecha_llegada && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Llegada</span><span className={styles.metaMono}>{formatDateDMY(trafico.fecha_llegada)}</span></span>
          )}
          {trafico.fecha_cruce && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Cruce</span><span className={styles.metaMono}>{formatDateDMY(trafico.fecha_cruce)}</span></span>
          )}
          {trafico.fecha_pago && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Pago</span><span className={styles.metaMono}>{formatDateDMY(trafico.fecha_pago)}</span></span>
          )}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Documentos sincronizados
          <span className={styles.sectionCount}>{docs.length}</span>
        </h2>

        {docs.length === 0 ? (
          <EmptyState
            title="No hay documentos sincronizados aún"
            description="Estos documentos se sincronizarán automáticamente desde nuestro sistema cuando estén disponibles."
            ghosted={ghostedRequired}
            action={{
              label: 'Solicitar documento',
              href: '/mensajeria?asunto=' + encodeURIComponent('Solicitud de documento'),
            }}
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} role="table" aria-label="Documentos del expediente">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th style={{ width: 180 }}>Tipo</th>
                  <th style={{ width: 130 }}>Fecha</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const display = d.file_name ?? labelForDocType(d.doc_type)
                  return (
                    <tr key={d.id}>
                      <td className={styles.cellDocName} title={display}>{display}</td>
                      <td className={styles.cellMeta}>{labelForDocType(d.doc_type)}</td>
                      <td className={styles.cellMono}>{formatDateDMY(d.uploaded_at) || '—'}</td>
                      <td className={styles.cellAction}>
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.docAction}
                          >
                            Abrir PDF
                          </a>
                        ) : (
                          <span className={`${styles.docAction} ${styles.docActionDisabled}`}>Sin URL</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
