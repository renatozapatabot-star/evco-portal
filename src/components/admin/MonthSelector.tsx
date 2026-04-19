'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, BORDER_HAIRLINE } from '@/lib/design-system'

export interface MonthSelectorProps {
  /** Selected YYYY-MM. */
  ym: string
  /** Human label for the selected month (e.g. "abril 2026"). */
  label: string
  /** Prior YYYY-MM for the back arrow. */
  prev: string
  /** Next YYYY-MM for the forward arrow, or null when at current month. */
  next: string | null
  /** List of months to offer in the dropdown, newest first. */
  options: Array<{ ym: string; label: string }>
  /** Optional override — otherwise the current pathname is used. */
  basePath?: string
}

export function MonthSelector({ ym, label, prev, next, options, basePath }: MonthSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const navigate = (target: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('month', target)
    const path = basePath ?? pathname ?? '/admin/eagle'
    startTransition(() => {
      router.push(`${path}?${params.toString()}`)
    })
  }

  return (
    <GlassCard size="compact" padding="12px 16px">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT_SECONDARY }}>
          <Calendar size={16} aria-hidden />
          <span style={{
            fontSize: 'var(--aguila-fs-label, 10px)',
            letterSpacing: 'var(--aguila-ls-label, 0.08em)',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}>
            Mes en vista
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate(prev)}
          disabled={isPending}
          aria-label="Mes anterior"
          style={arrowButtonStyle}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>

        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: '1 1 auto', minWidth: 180 }}>
          <select
            value={ym}
            onChange={(e) => navigate(e.target.value)}
            disabled={isPending}
            aria-label="Seleccionar mes"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              width: '100%',
              minHeight: 60,
              padding: '0 44px 0 16px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER_HAIRLINE}`,
              color: TEXT_PRIMARY,
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: 600,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              letterSpacing: '0.02em',
              cursor: isPending ? 'wait' : 'pointer',
            }}
          >
            {options.map((opt) => (
              <option key={opt.ym} value={opt.ym} style={{ background: 'var(--portal-ink-1)', color: TEXT_PRIMARY }}>
                {opt.label}
              </option>
            ))}
          </select>
          <span aria-hidden style={{
            position: 'absolute',
            right: 16,
            color: TEXT_SECONDARY,
            pointerEvents: 'none',
            fontSize: 'var(--aguila-fs-compact)',
          }}>
            ▾
          </span>
        </label>

        <button
          type="button"
          onClick={() => next && navigate(next)}
          disabled={isPending || !next}
          aria-label="Mes siguiente"
          style={{ ...arrowButtonStyle, opacity: next ? 1 : 0.35, cursor: next ? 'pointer' : 'not-allowed' }}
        >
          <ChevronRight size={20} aria-hidden />
        </button>

        <div style={{
          marginLeft: 'auto',
          color: TEXT_SECONDARY,
          fontSize: 'var(--aguila-fs-compact)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}>
          {label}
        </div>
      </div>
    </GlassCard>
  )
}

const arrowButtonStyle: React.CSSProperties = {
  minWidth: 60,
  minHeight: 60,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER_HAIRLINE}`,
  color: TEXT_PRIMARY,
  cursor: 'pointer',
}
