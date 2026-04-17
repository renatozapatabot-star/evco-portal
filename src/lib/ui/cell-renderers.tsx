/**
 * PORTAL · Canonical cell renderers (Block DD).
 *
 * Single source of truth for every null/empty/pending rendering decision
 * across every table, card, and list in the portal. Replaces ad-hoc
 * `value || '—'` / `?? 'N/A'` / `|| 'Sin datos'` drift.
 *
 * Design contract:
 *   - Missing data renders `—` (em-dash) in muted text — never blank space.
 *   - "Pendiente" (italicized, amber-ish) signals data that should arrive.
 *   - Zero values show as `0` in muted fg-4 — different from missing.
 *   - Every renderer returns a React element, not a string, so we can
 *     differentiate styles per state without polluting caller sites.
 *   - Formatting helpers (pedimento, fracción) delegate to the existing
 *     canonical formatters in `src/lib/format/*`.
 */

import type { ReactNode } from 'react'
import { formatPedimento } from '@/lib/format/pedimento'
import { formatFraccion } from '@/lib/format/fraccion'

const MUTED_STYLE = { color: 'var(--portal-fg-4, #7b7f8a)' } as const
const PENDING_STYLE = {
  fontStyle: 'italic' as const,
  color: 'var(--portal-amber, #fbbf24)',
} as const
const ZERO_STYLE = {
  fontFamily: 'var(--portal-font-mono, "Geist Mono", monospace)',
  color: 'var(--portal-fg-4, #7b7f8a)',
  fontVariantNumeric: 'tabular-nums' as const,
} as const
const MONO_STYLE = {
  fontFamily: 'var(--portal-font-mono, "Geist Mono", monospace)',
  fontVariantNumeric: 'tabular-nums' as const,
} as const

export function renderNull(): ReactNode {
  return <span aria-label="Sin datos" style={MUTED_STYLE}>—</span>
}

export function renderPending(label: string = 'pendiente'): ReactNode {
  return <span aria-label={label} style={PENDING_STYLE}>{label}</span>
}

export function renderEmpty(msg: string = 'Sin datos'): ReactNode {
  return <span style={MUTED_STYLE}>{msg}</span>
}

export function renderZero(): ReactNode {
  return <span style={ZERO_STYLE}>0</span>
}

export function renderDate(
  iso: string | Date | null | undefined,
  opts: { relative?: boolean; includeTime?: boolean } = {},
): ReactNode {
  if (iso === null || iso === undefined || iso === '') return renderNull()
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return renderNull()
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(opts.includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  })
  return <span style={MONO_STYLE}>{formatter.format(d)}</span>
}

export function renderCurrency(
  n: number | null | undefined,
  currency: 'USD' | 'MXN',
): ReactNode {
  if (n === null || n === undefined) return renderNull()
  if (!Number.isFinite(n)) return renderNull()
  if (n === 0) return renderZero()
  const formatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return <span style={MONO_STYLE}>{formatter.format(n)}</span>
}

export function renderNumber(
  n: number | null | undefined,
  opts: { decimals?: number } = {},
): ReactNode {
  if (n === null || n === undefined) return renderNull()
  if (!Number.isFinite(n)) return renderNull()
  if (n === 0) return renderZero()
  const formatter = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })
  return <span style={MONO_STYLE}>{formatter.format(n)}</span>
}

export function renderTrafico(id: string | null | undefined): ReactNode {
  if (!id) return renderNull()
  const trimmed = String(id).trim()
  if (!trimmed) return renderNull()
  return <span style={MONO_STYLE}>{trimmed}</span>
}

export function renderPedimento(p: string | null | undefined): ReactNode {
  if (!p) return renderNull()
  const formatted = formatPedimento(p, '')
  if (!formatted) return renderPending()
  return <span style={MONO_STYLE}>{formatted}</span>
}

export function renderFraccion(f: string | null | undefined): ReactNode {
  if (!f) return renderNull()
  const formatted = formatFraccion(f)
  if (!formatted) return renderNull()
  return <span style={MONO_STYLE}>{formatted}</span>
}

export function renderProveedor(
  name: string | null | undefined,
  code: string | null | undefined,
): ReactNode {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanCode = typeof code === 'string' ? code.trim() : ''
  if (cleanName && !/^PRV_/i.test(cleanName)) return <span>{cleanName}</span>
  if (cleanCode && !/^PRV_/i.test(cleanCode)) return <span>{cleanCode}</span>
  if (cleanName || cleanCode) return renderPending('pendiente')
  return renderNull()
}

export function renderTransporte(
  us: string | null | undefined,
  mx: string | null | undefined,
): ReactNode {
  const cleanUs = typeof us === 'string' ? us.trim() : ''
  const cleanMx = typeof mx === 'string' ? mx.trim() : ''
  if (cleanUs && cleanMx && cleanUs !== cleanMx) {
    return <span>{cleanUs} · {cleanMx}</span>
  }
  if (cleanUs) return <span>{cleanUs}</span>
  if (cleanMx) return <span>{cleanMx}</span>
  return renderPending()
}
