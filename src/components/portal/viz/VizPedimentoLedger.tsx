'use client'

export interface PedimentoLedgerRow {
  id: string
  type: 'A1' | 'A3' | 'IN' | string
  /** 'LIVE' for the current in-firma pedimento; anything else renders dimmed. */
  status: 'LIVE' | 'OK' | string
}

export interface VizPedimentoLedgerProps {
  rows?: PedimentoLedgerRow[]
}

const DEFAULT_ROWS: PedimentoLedgerRow[] = [
  { id: '6002104', type: 'A1', status: 'OK' },
  { id: '6002103', type: 'A1', status: 'OK' },
  { id: '6002102', type: 'IN', status: 'LIVE' },
  { id: '6002101', type: 'A1', status: 'OK' },
  { id: '6002100', type: 'A3', status: 'OK' },
]

/**
 * Compact tabular ledger of 5 pedimento rows with live-indicator dot,
 * type chip, and status column. Dims progressively down the stack via
 * opacity, fades to ink-2 at the bottom. Used on the Pedimentos module.
 *
 * Ported from screen-dashboard.jsx:295-349.
 */
export function VizPedimentoLedger({ rows = DEFAULT_ROWS }: VizPedimentoLedgerProps) {
  return (
    <div style={{ position: 'relative', height: 44, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((r, i) => {
          const live = r.status === 'LIVE'
          return (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr auto auto',
                gap: 8,
                alignItems: 'center',
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 9,
                opacity: 1 - i * 0.14,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: live
                    ? 'var(--portal-green-2)'
                    : 'color-mix(in oklch, var(--portal-green-2) 50%, transparent)',
                  boxShadow: live ? '0 0 6px var(--portal-green-glow)' : 'none',
                  animation: live ? 'portalPulse 1.4s ease-in-out infinite' : undefined,
                }}
              />
              <span style={{ color: 'var(--portal-fg-2)', letterSpacing: '0.04em' }}>
                240-2601-{r.id}
              </span>
              <span
                style={{
                  padding: '1px 4px',
                  borderRadius: 2,
                  border: `1px solid ${live ? 'var(--portal-green-3)' : 'var(--portal-line-2)'}`,
                  color: live ? 'var(--portal-green-2)' : 'var(--portal-fg-4)',
                  fontSize: 8,
                  letterSpacing: '0.1em',
                }}
              >
                {r.type}
              </span>
              <span
                style={{
                  color: live ? 'var(--portal-green-2)' : 'var(--portal-fg-5)',
                  fontSize: 8,
                  letterSpacing: '0.12em',
                }}
              >
                {live ? 'EN FIRMA' : 'LIBERADO'}
              </span>
            </div>
          )
        })}
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 14,
          background: 'linear-gradient(to bottom, transparent, var(--portal-ink-2))',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
