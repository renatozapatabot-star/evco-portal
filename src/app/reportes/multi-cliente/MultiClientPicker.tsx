'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TEXT_PRIMARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'

interface Props {
  defaultWeek: string
}

const inputStyle = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: TEXT_PRIMARY,
  fontSize: 'var(--aguila-fs-section)',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  outline: 'none',
  fontVariantNumeric: 'tabular-nums' as const,
} as const

function isoWeekPattern(v: string): boolean {
  return /^\d{4}-W\d{2}$/.test(v)
}

export function MultiClientPicker({ defaultWeek }: Props) {
  const router = useRouter()
  const [week, setWeek] = useState(defaultWeek)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function apply(value: string) {
    if (!isoWeekPattern(value)) {
      setErr('Formato inválido · usa YYYY-W##')
      return
    }
    setErr(null)
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      params.set('week', value)
      router.push(`/reportes/multi-cliente?${params.toString()}`)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label style={{
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED,
      }}>
        Semana (ISO-8601)
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={week}
          onChange={e => setWeek(e.target.value.toUpperCase())}
          onBlur={() => apply(week)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(week) } }}
          placeholder="2026-W13"
          style={{ ...inputStyle, maxWidth: 180 }}
        />
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER }}>
          {pending ? 'Actualizando…' : 'Enter para aplicar'}
        </span>
      </div>
      {err && <p style={{ fontSize: 'var(--aguila-fs-compact)', color: '#EF4444', margin: 0 }}>{err}</p>}
    </div>
  )
}
