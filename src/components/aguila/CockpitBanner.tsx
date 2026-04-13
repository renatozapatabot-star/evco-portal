'use client'

import { ACCENT_SILVER_BRIGHT, TEXT_MUTED, TEXT_SECONDARY, GOLD_GRADIENT } from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'

export type CockpitRole = 'client' | 'operator' | 'owner'

interface Props {
  role: CockpitRole
  name: string
  /** Client only — company name. */
  companyName?: string
}

/**
 * Role-aware brand trio. One visual language (Z-mark + AGUILA wordmark),
 * different meta line + subtitle per surface. Composed into PageShell via
 * its `brandHeader` slot.
 */
export function CockpitBanner({ role, name, companyName }: Props) {
  const subtitle =
    role === 'client'   ? (companyName ? `Portal del cliente · ${companyName}` : 'Portal del cliente')
    : role === 'owner'  ? `Vista Águila · ${name}`
    :                     `Operaciones · ${name}`

  const meta =
    role === 'client'   ? 'Renato Zapata & Company · Patente 3596'
    : role === 'owner'  ? 'Patente 3596 · Aduana 240 · Laredo TX · Est. 1941'
    :                     fmtDate(new Date())

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#0D0D0C', fontFamily: 'Georgia, serif',
          }}
        >
          Z
        </div>
        <span style={{
          fontSize: 'var(--aguila-fs-section, 14px)',
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: ACCENT_SILVER_BRIGHT,
          textTransform: 'uppercase',
        }}>
          AGUILA
        </span>
        <span aria-hidden style={{ color: TEXT_MUTED }}>·</span>
        <span style={{
          fontSize: 'var(--aguila-fs-body, 13px)',
          color: TEXT_SECONDARY,
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          {subtitle}
        </span>
      </div>
      <div style={{
        marginTop: 4,
        marginLeft: 48,
        fontSize: 'var(--aguila-fs-meta, 11px)',
        color: TEXT_MUTED,
        letterSpacing: '0.02em',
        fontFamily: role === 'operator' ? 'var(--font-jetbrains-mono), monospace' : undefined,
      }}>
        {meta}
      </div>
    </div>
  )
}
