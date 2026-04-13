'use client'

import { GREEN, AMBER, TEXT_MUTED } from '@/lib/design-system'

interface Props {
  current: number
  previous: number
  /** When true (e.g. atrasados, failed counts), DOWN is good. */
  inverted?: boolean
  size?: 'sm' | 'md'
}

export function DeltaIndicator({ current, previous, inverted = false, size = 'sm' }: Props) {
  const fontSize = size === 'sm' ? 10 : 11
  const padding = size === 'sm' ? '2px 6px' : '3px 8px'

  if (previous === 0 && current === 0) {
    return <Pill color={TEXT_MUTED} fontSize={fontSize} padding={padding}>— sin cambio</Pill>
  }
  if (previous === 0 && current > 0) {
    return <Pill color={inverted ? AMBER : GREEN} fontSize={fontSize} padding={padding}>· nuevo</Pill>
  }

  const deltaPct = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (deltaPct === 0) {
    return <Pill color={TEXT_MUTED} fontSize={fontSize} padding={padding}>— sin cambio</Pill>
  }
  const up = deltaPct > 0
  const positive = inverted ? !up : up
  const arrow = up ? '↑' : '↓'
  const color = positive ? GREEN : AMBER
  return (
    <Pill color={color} fontSize={fontSize} padding={padding}>
      {arrow} {Math.abs(deltaPct)}%
    </Pill>
  )
}

function Pill({ children, color, fontSize, padding }: { children: React.ReactNode; color: string; fontSize: number; padding: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
      fontSize,
      fontWeight: 700,
      color,
      padding,
      borderRadius: 999,
      background: `${color}1A`,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {children}
    </span>
  )
}
