'use client'

import { useState, useTransition } from 'react'
import type {
  PortalAccent,
  PortalBg,
  PortalDensity,
  PortalMotion,
  PortalTheme,
  PortalType,
} from '@/lib/portal/theme'

type Props = {
  initial: PortalTheme
}

const ACCENTS: PortalAccent[] = ['emerald', 'teal', 'lime']
const BGS: PortalBg[] = ['void', 'near', 'blueprint']
const DENSITIES: PortalDensity[] = ['compact', 'comfortable', 'spacious']
const TYPES: PortalType[] = ['editorial', 'grotesque', 'mono-all']
const MOTIONS: PortalMotion[] = ['on', 'off']

function applyToDocument(theme: PortalTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.accent = theme.accent
  root.dataset.bg = theme.bg
  root.dataset.density = theme.density
  root.dataset.type = theme.type
  root.dataset.motion = theme.motion
}

export function ThemeSwitcher({ initial }: Props) {
  const [theme, setTheme] = useState<PortalTheme>(initial)
  const [pending, startTransition] = useTransition()

  const patch = (next: Partial<PortalTheme>) => {
    const merged = { ...theme, ...next }
    setTheme(merged)
    applyToDocument(merged)
    startTransition(() => {
      void fetch('/api/portal/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      })
    })
  }

  return (
    <div
      className="portal-card portal-card--raised"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, minWidth: 280 }}
      data-pending={pending ? 'true' : undefined}
    >
      <Row label="Acento" values={ACCENTS} current={theme.accent} onPick={v => patch({ accent: v })} />
      <Row label="Canvas" values={BGS} current={theme.bg} onPick={v => patch({ bg: v })} />
      <Row label="Densidad" values={DENSITIES} current={theme.density} onPick={v => patch({ density: v })} />
      <Row label="Tipografía" values={TYPES} current={theme.type} onPick={v => patch({ type: v })} />
      <Row label="Motion" values={MOTIONS} current={theme.motion} onPick={v => patch({ motion: v })} />
    </div>
  )
}

function Row<T extends string>({
  label,
  values,
  current,
  onPick,
}: {
  label: string
  values: readonly T[]
  current: T
  onPick: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="portal-eyebrow">{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {values.map(v => {
          const active = v === current
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              className={active ? 'portal-btn portal-btn--sm' : 'portal-btn portal-btn--ghost portal-btn--sm'}
              style={{ textTransform: 'capitalize' }}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}
