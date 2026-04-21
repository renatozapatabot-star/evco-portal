'use client'

import { TEXT_MUTED, TEXT_SECONDARY } from '@/lib/design-system'
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
 * Role-aware brand trio. One visual language (Z-mark + CRUZ wordmark),
 * different meta line + subtitle per surface. Composed into PageShell via
 * its `brandHeader` slot.
 */
export function CockpitBanner({ role, name, companyName, metaPills }: Props) {
  // Client surface drops the "Portal del cliente · <company>" subtitle
  // — it duplicates the H1 company name shown below. Operator / owner
  // / warehouse / accounting still get their role-scoped subtitle
  // because it adds real context those surfaces need.
  const subtitle =
    role === 'client'     ? null
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Z mark retired from the cockpit banner 2026-04-15 — the topbar
            logo already carries brand identity. Second Z below it was
            redundant. Banner now leads with the live signal + subtitle. */}
        {/* Live signal pulse — ambient liveness indicator on every cockpit banner. */}
        <span
          aria-label="Sistema en vivo"
          title="Datos en vivo"
          className="portal-badge portal-badge--live"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
          }}
        >
          <span className="portal-pulse" aria-hidden />
          EN VIVO
        </span>
        {subtitle && (
          <>
            <span aria-hidden style={{ color: TEXT_MUTED }}>·</span>
            <span style={{
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: TEXT_SECONDARY,
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}>
              {subtitle}
            </span>
          </>
        )}
      </div>
      <div style={{
        marginTop: 4,
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
