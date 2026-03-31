'use client'

import { CSSProperties } from 'react'

/* ── Original shimmer skeleton (default export, used by page.tsx) ── */

interface SkeletonBaseProps {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: CSSProperties
  className?: string
}

export default function SkeletonBase({
  width,
  height = 16,
  borderRadius = 4,
  style,
  className = '',
}: SkeletonBaseProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/** KPI-shaped skeleton: big number + label */
export function SkeletonKPI() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonBase width={120} height={12} />
      <SkeletonBase width={80} height={32} borderRadius={4} />
      <SkeletonBase width={100} height={10} />
    </div>
  )
}

/** Table row skeleton */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 20px' }}>
          <SkeletonBase width={i === 0 ? '70%' : '50%'} height={14} />
        </td>
      ))}
    </tr>
  )
}

/* ── Variant-based skeleton for loading.tsx screens ── */

const SHIMMER: CSSProperties = {
  background: 'linear-gradient(90deg, var(--skeleton-base, #252219) 25%, var(--skeleton-shine, #302C23) 50%, var(--skeleton-base, #252219) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-loading 1.5s infinite',
}

export function Skeleton({
  variant,
  lines = 3,
}: {
  variant: 'card' | 'stat' | 'row' | 'text'
  lines?: number
}) {
  if (variant === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...SHIMMER,
              height: 16,
              width: i === lines - 1 ? '60%' : '100%',
              borderRadius: 4,
            }}
          />
        ))}
      </div>
    )
  }

  const dims: Record<'card' | 'stat' | 'row', { height: number; radius: number }> = {
    card: { height: 200, radius: 8 },
    stat: { height: 80, radius: 6 },
    row: { height: 48, radius: 4 },
  }

  const d = dims[variant]
  return (
    <div
      style={{
        ...SHIMMER,
        width: '100%',
        height: d.height,
        borderRadius: d.radius,
      }}
      aria-hidden="true"
    />
  )
}
