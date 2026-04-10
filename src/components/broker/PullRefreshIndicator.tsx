'use client'

interface PullRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  progress: number
}

/**
 * Gold spinner indicator for pull-to-refresh.
 * Opacity and rotation driven by pull progress.
 * Shows "Actualizando..." during refresh.
 */
export function PullRefreshIndicator({ pullDistance, isRefreshing, progress }: PullRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null

  const rotation = progress * 360
  const opacity = Math.min(progress * 1.5, 1)

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px',
        borderRadius: 24,
        background: 'var(--glass-bg, rgba(255,255,255,0.85))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border, rgba(255,255,255,0.3))',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        opacity,
        transition: isRefreshing ? 'opacity 200ms ease' : 'none',
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 20 20"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isRefreshing ? 'none' : 'transform 50ms linear',
          animation: isRefreshing ? 'pullSpinner 800ms linear infinite' : 'none',
        }}
      >
        <circle
          cx={10}
          cy={10}
          r={8}
          fill="none"
          stroke="var(--gold, #eab308)"
          strokeWidth={2.5}
          strokeDasharray="38 12"
          strokeLinecap="round"
        />
      </svg>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--gold-dark, #8B6914)',
      }}>
        {isRefreshing ? 'Actualizando...' : progress >= 1 ? 'Soltar para actualizar' : 'Deslizar para actualizar'}
      </span>
    </div>
  )
}
