'use client'

import { ACCENT_SILVER, ACCENT_SILVER_DIM, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { TileShell, MONO } from './tile-shell'
import type { TraficoStatusBucket } from '@/app/api/eagle/overview/route'

export function TraficosDelDiaTile({ buckets }: { buckets: TraficoStatusBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <TileShell title="Tráficos del día" subtitle={`${total} activos`} href="/traficos">
      {buckets.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 13 }}>Sin tráficos en movimiento.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buckets.map((b) => (
            <div key={b.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 110, fontSize: 12, color: TEXT_PRIMARY }}>{b.status}</div>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(b.count / max) * 100}%`,
                    height: '100%',
                    background: ACCENT_SILVER,
                  }}
                />
              </div>
              <div style={{ width: 36, textAlign: 'right', fontFamily: MONO, color: ACCENT_SILVER_DIM, fontSize: 12 }}>
                {b.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </TileShell>
  )
}
