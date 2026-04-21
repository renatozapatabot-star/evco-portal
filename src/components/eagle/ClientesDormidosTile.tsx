'use client'

import { ACCENT_SILVER_DIM, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { TileShell, MONO } from './tile-shell'
import type { DormantClient } from '@/app/api/eagle/overview/route'

function mxn(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

export function ClientesDormidosTile({ dormant }: { dormant: DormantClient[] }) {
  return (
    <TileShell title="Clientes dormidos" subtitle="14+ días" href="/admin/clientes-dormidos">
      {dormant.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Todos los clientes con movimiento reciente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dormant.map((d) => (
            <div
              key={d.companyId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                paddingBottom: 8,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    aria-hidden
                    className={d.diasSinMovimiento >= 14 ? 'silver-pulse' : undefined}
                    style={{ width: 5, height: 5, borderRadius: 999, background: ACCENT_SILVER_DIM, flexShrink: 0 }}
                  />
                  {d.razonSocial}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER_DIM, fontFamily: MONO }}>
                  {d.diasSinMovimiento}d sin movimiento
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, whiteSpace: 'nowrap' }}>
                {d.ultimoMonto != null ? mxn(d.ultimoMonto) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </TileShell>
  )
}
