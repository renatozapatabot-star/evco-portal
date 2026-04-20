/**
 * Loading skeleton for /prospect/[token].
 * Family-resembles the cockpit so the prospect sees glass chrome instantly,
 * never an infinite spinner. Mono numbers placeholder keep the rhythm.
 */

'use client'

import { GlassCard } from '@/components/aguila/GlassCard'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'

function ShimmerBar({ width = '100%', height = 12 }: { width?: number | string; height?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width, height, borderRadius: 6,
        background: 'linear-gradient(90deg, rgba(192,197,206,0.05) 0%, rgba(192,197,206,0.18) 50%, rgba(192,197,206,0.05) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

function SkeletonTile() {
  return (
    <GlassCard tier="hero" padding={20}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 100 }}>
        <ShimmerBar width="40%" height={10} />
        <ShimmerBar width="55%" height={32} />
        <ShimmerBar width="80%" height={10} />
      </div>
    </GlassCard>
  )
}

export default function Loading() {
  return (
    <div
      className="aguila-dark aguila-canvas"
      style={{ minHeight: '100vh', padding: '24px 16px', color: ACCENT_SILVER }}
    >
      <div className="aguila-aura" aria-hidden="true" />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <ShimmerBar width="60%" height={28} />
          <div style={{ marginTop: 8 }}>
            <ShimmerBar width="40%" height={12} />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
        </div>
        <p style={{
          marginTop: 32, textAlign: 'center', fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          Cargando vista preliminar…
        </p>
      </div>
    </div>
  )
}
