'use client'

import { useState } from 'react'
import { SemaforoPill } from '@/components/aguila/SemaforoPill'
import { formatPedimento } from '@/lib/format/pedimento'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BORDER_SILVER,
  GLASS_HERO,
} from '@/lib/design-system'

export interface TraficoUsRow {
  trafico: string | null
  pedimento: string | null
  fecha_cruce: string | null
  fecha_llegada: string | null
  estatus: string | null
  semaforo: 0 | 1 | 2 | null
  company_id: string | null
}

type BucketKey = 'recien' | 'semana' | 'historico'

interface Props {
  recien: TraficoUsRow[]
  semana: TraficoUsRow[]
  historico: TraficoUsRow[]
}

const BUCKETS: Array<{ key: BucketKey; label: string; helper: string }> = [
  { key: 'recien', label: 'Recién cruzado', helper: 'Últimas 48 horas' },
  { key: 'semana', label: 'Esta semana', helper: '2 a 7 días' },
  { key: 'historico', label: 'Últimos 30 días', helper: '7 a 30 días' },
]

function hoursSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.floor(ms / 3_600_000)
}

function formatCrossedAt(iso: string | null): string {
  const hours = hoursSince(iso)
  if (hours == null) return '—'
  if (hours < 1) return 'hace minutos'
  if (hours < 48) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function TraficoUsClient({ recien, semana, historico }: Props) {
  const [active, setActive] = useState<BucketKey>('recien')
  const buckets: Record<BucketKey, TraficoUsRow[]> = {
    recien,
    semana,
    historico,
  }
  const rows = buckets[active]

  return (
    <div style={{ marginTop: 24 }}>
      <TabBar active={active} buckets={buckets} onSelect={setActive} />
      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {rows.length === 0 ? (
          <EmptyBucket bucket={active} />
        ) : (
          rows.map((row) => (
            <TraficoRow key={`${active}:${row.trafico ?? 'x'}`} row={row} />
          ))
        )}
      </div>
    </div>
  )
}

function TabBar({
  active,
  buckets,
  onSelect,
}: {
  active: BucketKey
  buckets: Record<BucketKey, TraficoUsRow[]>
  onSelect: (key: BucketKey) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Buckets de tráfico US"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        background: GLASS_HERO,
        border: `1px solid ${BORDER_SILVER}`,
        borderRadius: 16,
        padding: 6,
        backdropFilter: 'blur(20px) saturate(1.2)',
      }}
    >
      {BUCKETS.map((b) => {
        const isActive = active === b.key
        const count = buckets[b.key].length
        return (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(b.key)}
            style={{
              minHeight: 60,
              padding: '8px 10px',
              borderRadius: 12,
              border: 'none',
              background: isActive ? 'rgba(192,197,206,0.12)' : 'transparent',
              color: isActive ? ACCENT_SILVER_BRIGHT : ACCENT_SILVER_DIM,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 2,
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--aguila-fs-label)',
                letterSpacing: 'var(--aguila-ls-label)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {b.label}
            </span>
            <span
              className="portal-num"
              style={{
                fontSize: 'var(--aguila-fs-kpi-small)',
                fontWeight: 700,
                color: isActive ? ACCENT_SILVER_BRIGHT : ACCENT_SILVER,
              }}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TraficoRow({ row }: { row: TraficoUsRow }) {
  const formattedPedimento = row.pedimento ? formatPedimento(row.pedimento) : null
  const pedimentoDisplay = formattedPedimento ?? row.pedimento ?? 'Sin pedimento'
  const estatus = row.estatus?.trim() || 'Sin estado'
  const company = row.company_id?.toUpperCase() ?? '—'
  return (
    <article
      style={{
        minHeight: 60,
        background: GLASS_HERO,
        border: `1px solid ${BORDER_SILVER}`,
        borderRadius: 'var(--aguila-radius-card)',
        padding: '14px 16px',
        backdropFilter: 'blur(20px) saturate(1.2)',
        display: 'grid',
        gap: 10,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="portal-num"
          style={{
            fontSize: 'var(--aguila-fs-kpi-small)',
            fontWeight: 700,
            color: ACCENT_SILVER_BRIGHT,
            letterSpacing: '0.02em',
          }}
        >
          {pedimentoDisplay}
        </span>
        <SemaforoPill value={row.semaforo} size="compact" />
      </header>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 'var(--aguila-fs-body)',
          color: ACCENT_SILVER_DIM,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 9999,
            background: 'rgba(192,197,206,0.08)',
            color: ACCENT_SILVER,
            fontSize: 'var(--aguila-fs-meta)',
            letterSpacing: 'var(--aguila-ls-label)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {company}
        </span>
        <span>{estatus}</span>
      </div>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 'var(--aguila-fs-meta)',
          color: ACCENT_SILVER_DIM,
        }}
      >
        <span className="portal-num">
          Tráfico {row.trafico ?? '—'}
        </span>
        <span>·</span>
        <span>
          Cruzó <span className="portal-num">{formatCrossedAt(row.fecha_cruce)}</span>
        </span>
        <span>·</span>
        <span className="portal-num">{formatAbsolute(row.fecha_cruce)}</span>
      </footer>
    </article>
  )
}

function EmptyBucket({ bucket }: { bucket: BucketKey }) {
  const copy: Record<BucketKey, string> = {
    recien: 'Nada ha cruzado en las últimas 48 horas.',
    semana: 'Sin cruces entre 2 y 7 días atrás.',
    historico: 'Sin datos aún · tu primer registro activará este panel.',
  }
  return (
    <div
      style={{
        minHeight: 120,
        background: GLASS_HERO,
        border: `1px solid ${BORDER_SILVER}`,
        borderRadius: 'var(--aguila-radius-card)',
        padding: '24px 20px',
        backdropFilter: 'blur(20px) saturate(1.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontSize: 'var(--aguila-fs-label)',
          letterSpacing: 'var(--aguila-ls-label)',
          textTransform: 'uppercase',
          color: ACCENT_SILVER_DIM,
          fontWeight: 600,
        }}
      >
        Tu operación está en calma
      </span>
      <span
        style={{
          fontSize: 'var(--aguila-fs-body)',
          color: ACCENT_SILVER,
          maxWidth: 420,
        }}
      >
        {copy[bucket]}
      </span>
    </div>
  )
}
