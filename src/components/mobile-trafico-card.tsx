'use client'
import { memo } from 'react'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtDate } from '@/lib/format-utils'

interface Props { trafico: any; onClick: () => void }

export const MobileTraficoCard = memo(function MobileTraficoCard({ trafico: r, onClick }: Props) {
  const isCruzado = (r.estatus ?? '').toLowerCase().includes('cruz')
  const isHold = (r.estatus ?? '').toLowerCase().includes('hold') || (r.estatus ?? '').toLowerCase().includes('deten')
  const dotClass = isCruzado ? 'm-card-dot--success' : isHold ? 'm-card-dot--danger' : 'm-card-dot--warning'

  return (
    <button className="m-card" onClick={onClick}>
      <div className="m-card-top">
        <div className="m-card-id-group">
          <span className={`m-card-dot ${dotClass}`} />
          <span className="m-card-id">{fmtId(r.trafico)}</span>
        </div>
        <div className="m-card-right">
          <span className={`badge ${isCruzado ? 'badge-success' : isHold ? 'badge-danger' : 'badge-warning'}`} style={{ height: 20, fontSize: 11 }}>
            <span className="badge-dot" /><span className="sr-only">Estado: </span>{isCruzado ? 'Cruzado' : isHold ? 'Detenido' : 'Proceso'}
          </span>
        </div>
      </div>
      {r.descripcion_mercancia && <div className="m-card-desc">{fmtDesc(r.descripcion_mercancia)}</div>}
      <div className="m-card-bottom">
        {r.pedimento && <span className="ped-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{r.pedimento}</span>}
        <span className="m-card-meta">{fmtDate(r.fecha_llegada)}</span>
        {r.peso_bruto && <span className="m-card-meta">{fmtKg(r.peso_bruto)} kg</span>}
        {r.importe_total && <span className="m-card-meta" style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--n-800)' }}>{fmtUSD(r.importe_total)}</span>}
      </div>
    </button>
  )
})
