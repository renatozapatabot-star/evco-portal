'use client'

import { ACCENT_SILVER_BRIGHT, TEXT_MUTED, TEXT_SECONDARY, GOLD_GRADIENT } from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'

export type CockpitRole = 'client' | 'operator' | 'owner' | 'warehouse' | 'accounting'

export interface MetaPill {
  label: string
  value: string | number
  tone?: 'silver' | 'warning'
}

interface Props {
  role: CockpitRole
  name: string
  /** Client only — company name. */
  companyName?: string
  /** Role-aware live signal chips shown under the subtitle. */
  metaPills?: MetaPill[]
}

/**
 * Role-aware brand trio. One visual language (Z-mark + AGUILA wordmark),
 * different meta line + subtitle per surface. Composed into PageShell via
 * its `brandHeader` slot.
 */
export function CockpitBanner({ role, name, companyName, metaPills }: Props) {
  const subtitle =
    role === 'client'     ? (companyName ? `Portal del cliente · ${companyName}` : 'Portal del cliente')
    : role === 'owner'    ? `Vista Águila · ${name}`
    : role === 'warehouse' ? `Bodega · ${name}`
    : role === 'accounting' ? `Contabilidad · ${name}`
    :                       `Operaciones · ${name}`

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
        fontFamily: (role === 'operator' || role === 'warehouse' || role === 'accounting')
          ? 'var(--font-jetbrains-mono), monospace'
          : undefined,
      }}>
        {meta}
      </div>
      {metaPills && metaPills.length > 0 ? (
        <div style={{
          marginTop: 8,
          marginLeft: 48,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {metaPills.map((p, i) => (
            <span key={`${p.label}-${i}`} style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              fontWeight: 600,
              color: p.tone === 'warning' ? '#FBBF24' : TEXT_SECONDARY,
              padding: '3px 10px',
              borderRadius: 999,
              background: p.tone === 'warning' ? 'rgba(251,191,36,0.12)' : 'rgba(192,197,206,0.08)',
              border: `1px solid ${p.tone === 'warning' ? 'rgba(251,191,36,0.25)' : 'rgba(192,197,206,0.15)'}`,
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}>
              <span style={{ color: TEXT_MUTED, marginRight: 6, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.08em' }}>
                {p.label}
              </span>
              {p.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
