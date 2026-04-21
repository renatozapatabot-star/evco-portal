'use client'
import { memo } from 'react'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtDate } from '@/lib/format-utils'
import { getTraficoUrgency } from '@/lib/trafico-urgency'

interface Props { trafico: { trafico: string; estatus?: string | null; descripcion_mercancia?: string | null; pedimento?: string | null; fecha_llegada?: string | null; peso_bruto?: number | null; importe_total?: number | null; doc_count?: number; [key: string]: unknown }; onClick: () => void }

const URGENCY_BADGE: Record<string, string> = {
  completed: 'badge-success',
  active: 'badge-warning',
  overdue: 'badge-danger',
  stalled: 'badge-danger',
  zombie: 'badge-muted',
}

export const MobileTraficoCard = memo(function MobileTraficoCard({ trafico: r, onClick }: Props) {
  const urgency = getTraficoUrgency({
    estatus: r.estatus ?? '',
    fecha_llegada: r.fecha_llegada ?? null,
    pedimento: r.pedimento,
    doc_count: r.doc_count,
  })
  const badgeClass = URGENCY_BADGE[urgency.class] ?? 'badge-warning'
  const dotClass = urgency.class === 'completed' ? 'm-card-dot--success'
    : urgency.class === 'active' ? 'm-card-dot--warning'
    : 'm-card-dot--danger'

  return (
    <button className="m-card" onClick={onClick} style={{ borderLeft: `3px solid ${urgency.color}` }}>
      <div className="m-card-top">
        <div className="m-card-id-group">
          <span className={`m-card-dot ${dotClass}`} />
          <span className="m-card-id">{fmtId(r.trafico)}</span>
        </div>
        <div className="m-card-right">
          <span className={`badge ${badgeClass}`} style={{ height: 20, fontSize: 'var(--aguila-fs-meta)' }}>
            <span className="badge-dot" /><span className="sr-only">Estado: </span>{urgency.label}
          </span>
        </div>
      </div>
      {r.descripcion_mercancia && <div className="m-card-desc">{fmtDesc(r.descripcion_mercancia)}</div>}
      <div className="m-card-bottom">
        {r.pedimento && <span className="ped-pill" style={{ fontSize: 'var(--aguila-fs-meta)', padding: '2px 7px' }}>{r.pedimento}</span>}
        <span className="m-card-meta">{fmtDate(r.fecha_llegada)}</span>
        {r.peso_bruto && <span className="m-card-meta">{fmtKg(r.peso_bruto)} kg</span>}
        {r.importe_total && <span className="m-card-meta" style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--n-800)' }}>{fmtUSD(r.importe_total)}</span>}
      </div>
    </button>
  )
})
