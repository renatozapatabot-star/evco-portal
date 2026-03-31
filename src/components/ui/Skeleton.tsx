'use client'

import { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: CSSProperties
  className?: string
}

/**
 * Shimmer skeleton loader — uses the .skeleton CSS class from globals.css.
 * Drop-in replacement for 'loading...' text or blank states during data fetch.
 */
export default function Skeleton({
  width,
  height = 16,
  borderRadius = 4,
  style,
  className = '',
}: SkeletonProps) {
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
      <Skeleton width={120} height={12} />
      <Skeleton width={80} height={32} borderRadius={4} />
      <Skeleton width={100} height={10} />
    </div>
  )
}

/** Table row skeleton */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 20px' }}>
          <Skeleton width={i === 0 ? '70%' : '50%'} height={14} />
        </td>
      ))}
    </tr>
  )
}
