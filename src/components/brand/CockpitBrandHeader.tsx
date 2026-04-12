/**
 * AGUILA · V1.5 H1 — Shared cockpit brand header
 *
 * Renders the AGUILA brand trio (Mark + Wordmark + CoordinatesBadge) at the top
 * of every role cockpit, so the page is unambiguously AGUILA on first paint.
 * Eagle View established the visual pattern; this component is the reusable
 * distillation for `/inicio`, `/operador/inicio`, `/bodega/inicio`, `/contabilidad`.
 */

import { AguilaMark } from './AguilaMark'
import { AguilaWordmark } from './AguilaWordmark'
import { CoordinatesBadge } from './CoordinatesBadge'
import { ACCENT_SILVER_BRIGHT, TEXT_MUTED } from '@/lib/design-system'

export interface CockpitBrandHeaderProps {
  /** Subtitle line under the wordmark — e.g. "Inicio · Ursula" */
  subtitle?: string
  /** Right-side greeting / status pill — e.g. "Buenos días, Tito" */
  greeting?: string
  /** Optional action node rendered to the right of the greeting. */
  right?: React.ReactNode
}

export function CockpitBrandHeader({ subtitle, greeting, right }: CockpitBrandHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 24,
        position: 'relative',
      }}
    >
      {/* Topo hairline overlay — decorative, top-right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 220,
          height: 80,
          backgroundImage: 'url(/brand/topo-hairline.svg)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          opacity: 0.18,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AguilaMark size={40} tone="silver" />
        <div>
          <AguilaWordmark />
          {subtitle && (
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CoordinatesBadge />
        {greeting && (
          <div style={{ fontSize: 14, color: ACCENT_SILVER_BRIGHT, fontWeight: 600 }}>
            {greeting}
          </div>
        )}
        {right}
      </div>
    </header>
  )
}
