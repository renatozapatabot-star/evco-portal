'use client'

import Link from 'next/link'
import { ArrowRight, Receipt, Package, FileText, Truck, FolderOpen, Link2Off } from 'lucide-react'
import {
  ACCENT_SILVER, AMBER, BG_ELEVATED, BORDER_HAIRLINE, GREEN, RED,
  TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY,
} from '@/lib/design-system'
import { GlassCard } from './GlassCard'

/**
 * Cadena documental: Factura → Entrada → Pedimento → Embarque → Expediente.
 * Broken links render amber with a "Vincular" action; callers supply the
 * handler via `onVincular` so linking UX stays owned by the surface.
 */

export type ChainNodeStatus = 'linked' | 'missing' | 'pending' | 'error'

export type ChainNodeKind = 'factura' | 'entrada' | 'pedimento' | 'trafico' | 'expediente'

export interface ChainNode {
  kind: ChainNodeKind
  label: string
  value?: string | null
  date?: string | null
  href?: string | null
  status: ChainNodeStatus
  onVincular?: (kind: ChainNodeKind) => void
}

export interface ChainViewProps {
  nodes: ChainNode[]
  compact?: boolean
  ariaLabel?: string
}

const ICONS: Record<ChainNodeKind, typeof Receipt> = {
  factura: Receipt,
  entrada: Package,
  pedimento: FileText,
  trafico: Truck,
  expediente: FolderOpen,
}

function statusTone(status: ChainNodeStatus): { color: string; label: string } {
  if (status === 'linked') return { color: GREEN, label: 'Vinculado' }
  if (status === 'missing') return { color: AMBER, label: 'Sin vincular' }
  if (status === 'pending') return { color: ACCENT_SILVER, label: 'Pendiente' }
  return { color: RED, label: 'Error' }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Chicago',
  })
}

export function ChainView({ nodes, compact = false, ariaLabel }: ChainViewProps) {
  return (
    <GlassCard
      size={compact ? 'compact' : 'card'}
      ariaLabel={ariaLabel || 'Cadena documental'}
      style={{ padding: compact ? '12px 14px' : '16px 20px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: compact ? 6 : 10,
          flexWrap: 'wrap',
        }}
        role="list"
      >
        {nodes.map((node, i) => (
          <ChainNodeCell
            key={`${node.kind}-${i}`}
            node={node}
            compact={compact}
            last={i === nodes.length - 1}
          />
        ))}
      </div>
    </GlassCard>
  )
}

function ChainNodeCell({
  node,
  compact,
  last,
}: {
  node: ChainNode
  compact: boolean
  last: boolean
}) {
  const tone = statusTone(node.status)
  const Icon = ICONS[node.kind]
  const broken = node.status === 'missing'

  const cellStyle = {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    minWidth: compact ? 110 : 140,
    minHeight: compact ? 60 : 68,
    padding: compact ? '8px 10px' : '10px 12px',
    background: BG_ELEVATED,
    border: `1px solid ${broken ? 'rgba(251,191,36,0.35)' : BORDER_HAIRLINE}`,
    borderRadius: compact ? 10 : 12,
    color: TEXT_PRIMARY,
    textDecoration: 'none',
  }

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={compact ? 12 : 14} color={tone.color} aria-hidden />
        <span
          style={{
            fontSize: 'var(--aguila-fs-label, 10px)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 'var(--aguila-ls-label, 0.08em)',
            color: TEXT_MUTED,
          }}
        >
          {node.label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
          fontSize: compact ? 'var(--aguila-fs-body, 13px)' : 'var(--aguila-fs-kpi-small, 18px)',
          fontWeight: broken ? 500 : 700,
          lineHeight: 1.1,
          // V1: missing nodes render in muted + amber DOT to the left so the
          // chain breathes calm (amber = actionable, not alarm). Previously
          // bold full-amber text read as red-orange on some displays.
          color: broken ? TEXT_SECONDARY : TEXT_PRIMARY,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {node.value || '—'}
      </div>
      <div
        style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: TEXT_SECONDARY,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tone.color,
            display: 'inline-block',
          }}
        />
        <span>{formatDate(node.date)}</span>
      </div>
      {broken && node.onVincular && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            node.onVincular?.(node.kind)
          }}
          style={{
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minHeight: compact ? 28 : 32,
            padding: '0 10px',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: 6,
            color: AMBER,
            fontSize: 'var(--aguila-fs-meta, 11px)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label={`Vincular ${node.label}`}
        >
          <Link2Off size={10} aria-hidden />
          Vincular
        </button>
      )}
    </>
  )

  const cell = node.href && !broken ? (
    <Link href={node.href} style={cellStyle} role="listitem" aria-label={`${node.label} ${tone.label}`}>
      {body}
    </Link>
  ) : (
    <div style={cellStyle} role="listitem" aria-label={`${node.label} ${tone.label}`}>
      {body}
    </div>
  )

  return (
    <>
      {cell}
      {!last && (
        <div
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            color: TEXT_MUTED,
            flexShrink: 0,
          }}
        >
          <ArrowRight size={compact ? 12 : 14} />
        </div>
      )}
    </>
  )
}
