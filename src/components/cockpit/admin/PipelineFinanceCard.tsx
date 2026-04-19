'use client'

import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'

interface Props {
  pipeline: AdminData['financialPipeline']
}

function fmtMXN(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function PipelineFinanceCard({ pipeline }: Props) {
  const { carteraTotal, cartera30d, cartera60d, cartera90plus } = pipeline
  const hasAging = cartera60d > 0 || cartera90plus > 0

  return (
    <IfThenCard
      id="admin-pipeline-finance"
      state={cartera90plus > 0 ? 'urgent' : hasAging ? 'active' : 'quiet'}
      title="Cartera y cobranza"
      activeCondition={hasAging ? `${fmtMXN(cartera60d + cartera90plus)} MXN con más de 60 días` : undefined}
      activeAction={hasAging ? 'Ver cartera' : undefined}
      urgentCondition={cartera90plus > 0 ? `${fmtMXN(cartera90plus)} MXN con más de 90 días` : undefined}
      urgentAction={cartera90plus > 0 ? 'Escalar cobranza' : undefined}
      actionHref="/cuentas"
      quietContent={
        carteraTotal === 0 ? (
          <div style={{ padding: '8px 0', color: '#6E7681', fontSize: 'var(--aguila-fs-body)' }}>
            Sin datos de cartera disponibles
          </div>
        ) : (
          <>
            {/* Aging bar */}
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              {cartera30d > 0 && <div style={{ flex: cartera30d, background: 'var(--portal-status-green-fg)' }} />}
              {cartera60d > 0 && <div style={{ flex: cartera60d, background: 'var(--portal-status-amber-fg)' }} />}
              {cartera90plus > 0 && <div style={{ flex: cartera90plus, background: 'var(--portal-status-red-fg)' }} />}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <AgingBucket label="0-30d" value={cartera30d} color="var(--portal-status-green-fg)" />
              <AgingBucket label="30-60d" value={cartera60d} color="var(--portal-status-amber-fg)" />
              <AgingBucket label="90+d" value={cartera90plus} color="var(--portal-status-red-fg)" />
            </div>
          </>
        )
      }
    />
  )
}

function AgingBucket({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color, lineHeight: 1 }}>
        {fmtMXN(value)}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-label)', color: '#8B949E', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}
