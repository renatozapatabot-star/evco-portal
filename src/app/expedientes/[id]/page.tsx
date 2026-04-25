import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { formatPedimento } from '@/lib/format/pedimento'
import { clearanceLabel, isCleared } from '@/lib/pedimentos/clearance'
import { linkForTrafico } from '@/lib/links/entity-links'

/**
 * Expediente Digital — standalone detail (2026-04-24).
 *
 * Single purpose: list every PDF / document already synced from
 * GlobalPC for one expediente (keyed by trafico slug, since
 * `expediente_documentos.pedimento_id` stores the trafico slug per
 * the canonical join in /pedimentos/[id]).
 *
 * Security envelope mirrors /pedimentos/[id]:
 *   1. Trafico ownership check (HARD invariant — tenant isolation;
 *      not a "new" query, this is required defense-in-depth).
 *   2. ONE additional query — expediente_documentos — anchored to
 *      the verified ownerCompanyId.
 * No partidas, no entradas, no contabilidad. Just the docs list.
 */

/** DD/MM/YYYY — shipper-friendly, locale-agnostic. */
function fmtDateDMY(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.split('T')[0]
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

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

  // Step A — confirm trafico ownership (tenant-isolation contract;
  // mirrors /pedimentos/[id] pattern). Required by security audit
  // 2026-04-24 finding F1; NOT counted toward the relaxed query budget.
  const TRAFICO_COLS =
    'trafico, pedimento, estatus, fecha_llegada, fecha_cruce, fecha_pago, regimen, aduana, patente, company_id'

  let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const traficoRes = await traficoQ.maybeSingle()
  if (traficoRes.error || !traficoRes.data) notFound()
  const ownerCompanyId = (traficoRes.data as { company_id: string | null }).company_id
  if (!ownerCompanyId) notFound()

  // Step B — the ONE relaxed query: documents for this expediente.
  // Unconditional company_id anchor on the verified owner.
  const { data: docsData } = await supabase
    .from('expediente_documentos')
    .select('id, doc_type, file_name, file_url, uploaded_at')
    .eq('pedimento_id', traficoId)
    .eq('company_id', ownerCompanyId)
    .order('uploaded_at', { ascending: false })
    .limit(500)

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

  const status = clearanceLabel({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const cleared = isCleared({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const pedimentoDisplay = trafico.pedimento
    ? formatPedimento(trafico.pedimento, trafico.pedimento, { dd: '26', ad: '24', pppp: trafico.patente ?? '3596' })
    : null
  const embarqueHref = linkForTrafico(trafico.trafico) ?? '#'

  return (
    <main className="exp-detail">
      {/* Header */}
      <header className="exp-header">
        <div className="exp-eyebrow">Expediente Digital</div>
        <div className="exp-title-row">
          <h1 className="exp-number">{trafico.trafico}</h1>
          <span className={`exp-status ${cleared ? 'exp-status--cleared' : 'exp-status--pending'}`}>
            <span className="exp-status-dot" />
            {status}
          </span>
        </div>
        <div className="exp-meta">
          <span className="exp-meta-item">
            <span className="exp-meta-label">Embarque</span>
            <Link href={embarqueHref} className="exp-meta-link">{trafico.trafico}</Link>
          </span>
          {pedimentoDisplay && (
            <span className="exp-meta-item">
              <span className="exp-meta-label">Pedimento</span>
              <span className="exp-meta-mono">{pedimentoDisplay}</span>
            </span>
          )}
          {trafico.regimen && (
            <span className="exp-meta-item"><span className="exp-meta-label">Régimen</span>{trafico.regimen}</span>
          )}
          {trafico.aduana && (
            <span className="exp-meta-item"><span className="exp-meta-label">Aduana</span>{trafico.aduana}</span>
          )}
          {trafico.fecha_llegada && (
            <span className="exp-meta-item"><span className="exp-meta-label">Llegada</span><span className="exp-meta-mono">{fmtDateDMY(trafico.fecha_llegada)}</span></span>
          )}
          {trafico.fecha_cruce && (
            <span className="exp-meta-item"><span className="exp-meta-label">Cruce</span><span className="exp-meta-mono">{fmtDateDMY(trafico.fecha_cruce)}</span></span>
          )}
          {trafico.fecha_pago && (
            <span className="exp-meta-item"><span className="exp-meta-label">Pago</span><span className="exp-meta-mono">{fmtDateDMY(trafico.fecha_pago)}</span></span>
          )}
        </div>
      </header>

      {/* Document list */}
      <section className="exp-section">
        <h2 className="exp-section-title">
          Documentos sincronizados
          <span className="exp-section-count">{docs.length}</span>
        </h2>

        {docs.length === 0 ? (
          <div className="exp-empty">No hay documentos sincronizados aún</div>
        ) : (
          <div className="exp-table-wrap">
            <table className="exp-table" role="table" aria-label="Documentos del expediente">
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
                      <td className="cell-doc-name" title={display}>{display}</td>
                      <td className="cell-meta">{labelForDocType(d.doc_type)}</td>
                      <td className="cell-mono">{fmtDateDMY(d.uploaded_at) || '—'}</td>
                      <td className="cell-action">
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exp-doc-action"
                          >
                            Abrir PDF
                          </a>
                        ) : (
                          <span className="exp-doc-action exp-doc-action--disabled">Sin URL</span>
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

      {/* Page-scoped polish — shadcn-feel chrome on this surface only. */}
      <style>{`
        .exp-detail {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          color: var(--text-primary);
        }
        @media (max-width: 600px) {
          .exp-detail { padding: 16px 14px 48px; }
        }

        /* Header */
        .exp-header { margin-bottom: 28px; }
        .exp-eyebrow {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .exp-title-row {
          display: flex; align-items: center; gap: 14px;
          flex-wrap: wrap;
        }
        .exp-number {
          font-family: var(--font-mono);
          font-size: 28px; font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 0;
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 600px) {
          .exp-number { font-size: 22px; }
        }
        .exp-status {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 9999px;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .exp-status-dot {
          width: 6px; height: 6px; border-radius: 50%;
          flex-shrink: 0;
        }
        .exp-status--cleared {
          background: rgba(34,197,94,0.10);
          color: #4ade80;
        }
        .exp-status--cleared .exp-status-dot { background: #22c55e; }
        .exp-status--pending {
          background: rgba(192,197,206,0.10);
          color: var(--accent-silver, #C0C5CE);
        }
        .exp-status--pending .exp-status-dot { background: var(--accent-silver-dim, #7A7E86); }

        .exp-meta {
          display: flex; flex-wrap: wrap; gap: 8px 18px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-secondary);
        }
        .exp-meta-item {
          display: inline-flex; align-items: baseline; gap: 6px;
        }
        .exp-meta-label {
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .exp-meta-mono {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }
        .exp-meta-link {
          font-family: var(--font-mono);
          color: var(--accent-silver-bright, #E8EAED);
          text-decoration: none;
          border-bottom: 1px dashed rgba(192,197,206,0.3);
        }
        .exp-meta-link:hover { border-bottom-color: var(--accent-silver-bright, #E8EAED); }

        /* Section */
        .exp-section {
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .exp-section-title {
          display: flex; align-items: baseline; gap: 10px;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
          margin: 0 0 14px;
        }
        .exp-section-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0;
          text-transform: none;
        }

        /* Table */
        .exp-table-wrap {
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow-x: auto;
        }
        .exp-table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          min-width: 640px;
        }
        .exp-table th {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--text-muted);
          padding: 10px 12px;
          text-align: left;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 1;
        }
        .exp-table td {
          padding: 10px 12px;
          font-size: 13px;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .exp-table tbody tr { transition: background 120ms ease; }
        .exp-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.015); }
        .exp-table tbody tr:hover { background: rgba(192,197,206,0.06); }
        .exp-table tbody tr:last-child td { border-bottom: 0; }

        .cell-doc-name {
          color: var(--text-primary);
          font-weight: 500;
          max-width: 360px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cell-meta { color: var(--text-secondary); }
        .cell-mono { font-family: var(--font-mono); color: var(--text-secondary); }
        .cell-action { text-align: right; }

        .exp-doc-action {
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600;
          padding: 6px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
          white-space: nowrap;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .exp-doc-action:hover {
          background: rgba(192,197,206,0.10);
          border-color: rgba(192,197,206,0.3);
        }
        .exp-doc-action--disabled {
          color: var(--text-muted);
          background: transparent;
          cursor: default;
        }
        .exp-doc-action--disabled:hover {
          background: transparent;
          border-color: var(--border);
        }

        /* Empty */
        .exp-empty {
          padding: 32px 16px;
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: 10px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </main>
  )
}
