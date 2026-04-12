'use client'

/**
 * AGUILA · V1.5 F3 — Anabel accounting cockpit client UI.
 *
 * Silver glass 3x2 grid. Every tile is an action. Mono on amounts and
 * timestamps. es-MX copy. No blue/cyan/gold.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { CoordinatesBadge } from '@/components/brand/CoordinatesBadge'
import type { OverviewData } from './page'

const MONO = 'var(--font-mono)'

function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function formatAmount(amount: number, currency: 'MXN' | 'USD'): string {
  return currency === 'USD' ? formatUsd(amount) : formatMxn(amount)
}

function monthLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T06:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Chicago',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

interface CardShellProps {
  title: string
  subtitle?: string
  href?: string
  children: React.ReactNode
}

function CardShell({ title, subtitle, href, children }: CardShellProps) {
  const body = (
    <div
      style={{
        background: 'rgba(9,9,11,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 20,
        padding: 20,
        boxShadow: GLASS_SHADOW,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 240,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '0.02em', margin: 0 }}>
          {title}
        </h2>
        {subtitle ? (
          <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: MONO }}>{subtitle}</span>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
  if (!href) return body
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      {body}
    </Link>
  )
}

function BucketBar({ buckets }: { buckets: { bucket: string; amount: number; count: number }[] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        {buckets.map((b, i) => {
          const pct = total > 0 ? (b.amount / total) * 100 : 0
          const opacity = 0.9 - i * 0.18
          return (
            <div
              key={b.bucket}
              title={`${b.bucket} días`}
              style={{ width: `${pct}%`, background: ACCENT_SILVER, opacity }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_MUTED, fontFamily: MONO }}>
        {buckets.map(b => (
          <span key={b.bucket}>{b.bucket}d · {b.count}</span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AR Tile
// ---------------------------------------------------------------------------
function ARAgingTile({ data }: { data: OverviewData['ar'] }) {
  return (
    <CardShell
      title="Cuentas por cobrar"
      subtitle={`${data.count} facturas`}
      href="/cobranzas"
    >
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: TEXT_PRIMARY }}>
          {formatAmount(data.total, data.currency)}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>Total pendiente</div>
      </div>
      <BucketBar buckets={data.byBucket} />
      {data.topDebtors.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Top deudores
          </div>
          {data.topDebtors.slice(0, 5).map(d => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: TEXT_SECONDARY,
                minHeight: 24,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
              <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{formatAmount(d.amount, data.currency)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>Sin cuentas pendientes.</div>
      )}
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// AP Tile
// ---------------------------------------------------------------------------
function APAgingTile({ data }: { data: OverviewData['ap'] }) {
  if (data.sourceMissing) {
    return (
      <CardShell title="Cuentas por pagar" href="/pagos">
        <div
          style={{
            fontSize: 13,
            color: TEXT_MUTED,
            padding: 16,
            border: `1px dashed ${BORDER}`,
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          Datos pendientes — conecta el catálogo de proveedores para calcular el envejecimiento.
        </div>
      </CardShell>
    )
  }
  return (
    <CardShell
      title="Cuentas por pagar"
      subtitle={`${data.count} facturas`}
      href="/pagos"
    >
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: TEXT_PRIMARY }}>
          {formatAmount(data.total, data.currency)}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>Total por pagar</div>
      </div>
      <BucketBar buckets={data.byBucket} />
      {data.topDebtors.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Proveedores principales
          </div>
          {data.topDebtors.slice(0, 5).map(d => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: TEXT_SECONDARY,
                minHeight: 24,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
              <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{formatAmount(d.amount, data.currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// Monthly Close Tile
// ---------------------------------------------------------------------------
function CloseTile({ month, items: initial }: { month: string; items: OverviewData['close'] }) {
  const [items, setItems] = useState(initial)
  const [pending, startTransition] = useTransition()
  const done = items.filter(i => i.is_done).length
  const pct = items.length > 0 ? (done / items.length) * 100 : 0

  function toggle(id: string) {
    // Optimistic flip
    const prev = items
    setItems(items.map(i => i.id === id ? { ...i, is_done: !i.is_done } : i))
    startTransition(async () => {
      try {
        const res = await fetch(`/api/contabilidad/checklist/${id}/toggle`, { method: 'POST' })
        if (!res.ok) setItems(prev)
      } catch {
        setItems(prev)
      }
    })
  }

  return (
    <CardShell title="Cierre mensual" subtitle={monthLabel(month)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: 56, height: 56, borderRadius: '50%',
            background: `conic-gradient(${ACCENT_SILVER_BRIGHT} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            position: 'absolute', inset: 4, borderRadius: '50%', background: BG_DEEP,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: MONO, fontSize: 12, color: TEXT_PRIMARY,
          }}>
            {done}/{items.length}
          </div>
        </div>
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          {done === items.length && items.length > 0 ? 'Mes cerrado ✓' : `${items.length - done} pendientes`}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto', maxHeight: 220 }}>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            disabled={pending}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', minHeight: 44,
              background: item.is_done ? 'rgba(192,197,206,0.06)' : 'transparent',
              border: `1px solid ${BORDER_HAIRLINE}`,
              borderRadius: 10,
              textAlign: 'left', cursor: 'pointer',
              color: item.is_done ? TEXT_MUTED : TEXT_SECONDARY,
              textDecoration: item.is_done ? 'line-through' : 'none',
              fontSize: 12,
            }}
            aria-pressed={item.is_done}
          >
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: `1px solid ${item.is_done ? ACCENT_SILVER : ACCENT_SILVER_DIM}`,
              background: item.is_done ? ACCENT_SILVER : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: BG_DEEP, fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {item.is_done ? '✓' : ''}
            </span>
            <span style={{ flex: 1 }}>{item.item_label}</span>
          </button>
        ))}
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// MVE Tile
// ---------------------------------------------------------------------------
function MveTile({ data }: { data: OverviewData['mve'] }) {
  return (
    <CardShell title="Cumplimiento MVE" href="/mve/alerts">
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: data.critical > 0 ? '#EF4444' : TEXT_PRIMARY }}>
            {data.critical}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Críticas</div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: data.warning > 0 ? '#FBBF24' : TEXT_PRIMARY }}>
            {data.warning}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Advertencias</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
        {data.total === 0
          ? 'Sin alertas abiertas.'
          : `${data.total} alertas abiertas en total.`}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 12, color: ACCENT_SILVER }}>
        Revisar alertas →
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// Facturas Ready Tile
// ---------------------------------------------------------------------------
function FacturasReadyTile({ data }: { data: OverviewData['facturasReady'] }) {
  return (
    <CardShell title="Facturas listas" subtitle={`${data.count} borradores`} href="/facturacion">
      {data.count === 0 ? (
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>No hay facturas pendientes de envío.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.recent.slice(0, 5).map(f => (
            <div
              key={String(f.id)}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${BORDER_HAIRLINE}`,
                fontSize: 12, color: TEXT_SECONDARY,
              }}
            >
              <span style={{ fontFamily: MONO }}>{f.invoice_number ?? `#${f.id}`}</span>
              <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>
                {formatAmount(Number(f.total) || 0, (f.currency as 'MXN' | 'USD') || 'MXN')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 'auto', fontSize: 12, color: ACCENT_SILVER }}>
        Revisar todas →
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// QuickBooks Export Tile
// ---------------------------------------------------------------------------
const QB_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', running: 'Generando', ready: 'Lista', failed: 'Falló',
}

function QbExportTile({ data }: { data: OverviewData['lastQbExport'] }) {
  return (
    <CardShell title="Última exportación QB" href="/admin/quickbooks-export">
      {!data ? (
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>Aún no se ha generado ninguna exportación.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: data.status === 'ready' ? 'rgba(34,197,94,0.15)'
                  : data.status === 'failed' ? 'rgba(239,68,68,0.15)'
                  : 'rgba(192,197,206,0.10)',
                color: data.status === 'ready' ? '#22C55E'
                  : data.status === 'failed' ? '#EF4444'
                  : ACCENT_SILVER_BRIGHT,
                fontFamily: MONO, letterSpacing: '0.04em',
              }}
            >
              {QB_STATUS_LABEL[data.status] ?? data.status}
            </span>
            <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: MONO }}>
              {data.format} · {data.entity}
            </span>
          </div>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: MONO }}>
            {data.completed_at ? fmtDateTime(data.completed_at) : fmtDateTime(data.created_at)}
          </div>
          {data.row_count != null ? (
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>
              <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{data.row_count}</span> renglones exportados
            </div>
          ) : null}
        </div>
      )}
      <div style={{ marginTop: 'auto', fontSize: 12, color: ACCENT_SILVER }}>
        Ver historial →
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function ContabilidadCockpitClient({ data }: { data: OverviewData }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        color: TEXT_PRIMARY,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AguilaMark size={40} />
          <div>
            <AguilaWordmark size={18} />
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
              Contabilidad · {fmtDate(new Date())}
            </div>
          </div>
        </div>
        <CoordinatesBadge />
      </header>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, margin: '0 0 16px' }}>
        Panorama contable
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        <ARAgingTile data={data.ar} />
        <APAgingTile data={data.ap} />
        <CloseTile month={data.month} items={data.close} />
        <MveTile data={data.mve} />
        <FacturasReadyTile data={data.facturasReady} />
        <QbExportTile data={data.lastQbExport} />
      </div>
    </div>
  )
}
