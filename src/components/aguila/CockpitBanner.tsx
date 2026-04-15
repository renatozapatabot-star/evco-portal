'use client'

import { TEXT_MUTED, TEXT_SECONDARY, ZAPATA_GOLD_BRIGHT, ZAPATA_GOLD_BASE, ZAPATA_GOLD_DIM, ZAPATA_GOLD_GLOW } from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'
import { AguilaMark } from '@/components/brand/AguilaMark'

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
 * Role-aware brand trio. One visual language (Z-mark + ZAPATA AI wordmark),
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
        {/* Gold Z mark with circuit traces — login parity */}
        <div
          aria-hidden
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            flexShrink: 0,
            filter: `drop-shadow(0 0 12px ${ZAPATA_GOLD_GLOW})`,
          }}
        >
          <AguilaMark size={36} />
        </div>
        <span style={{
          fontSize: 'var(--aguila-fs-section, 14px)',
          fontWeight: 700,
          letterSpacing: '0.18em',
          background: `linear-gradient(135deg, ${ZAPATA_GOLD_BRIGHT} 0%, ${ZAPATA_GOLD_BASE} 50%, ${ZAPATA_GOLD_DIM} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textTransform: 'uppercase',
        }}>
          ZAPATA AI
        </span>
        {/* Live signal pulse — ambient liveness indicator on every cockpit banner. */}
        <span
          aria-label="Sistema en vivo"
          title="Datos en vivo"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px 2px 6px',
            borderRadius: 999,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#22C55E',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          <span
            aria-hidden
            className="aguila-dot-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 8px rgba(34,197,94,0.8)',
            }}
          />
          EN VIVO
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
        marginLeft: 52,
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
          marginLeft: 52,
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
