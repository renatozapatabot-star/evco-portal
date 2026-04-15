'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ACCENT_CYAN,
  BORDER,
  GLASS_SHADOW,
  GOLD,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { useTrack } from '@/lib/telemetry/useTrack'

/**
 * V1 Polish Pack · Block 11 — Crossing schedule client component.
 *
 * Renders a bridge-grouped horizontal timeline (6 AM → 10 PM Laredo CST)
 * with one block per embarque. Blocks click through to /embarques/[id].
 */

export interface CruceRow {
  trafico: string
  estatus: string | null
  companyId: string | null
  fechaCrucePlaneada: string | null
  fechaCruceEstimada: string | null
  bridge: string | null
  lane: string | null
  semaforo: string | null
}

interface Props {
  rows: CruceRow[]
  clientOptions: string[]
  rangeStartISO: string
  rangeEndISO: string
  lastUpdateLabel: string
}

const BRIDGES = ['Puente I', 'Puente II', 'Puente III', 'Puente IV'] as const
type BridgeLabel = (typeof BRIDGES)[number]

// Timeline window: 6 AM → 10 PM (16 hours)
const HOUR_START = 6
const HOUR_END = 22
const HOUR_SPAN = HOUR_END - HOUR_START // 16

type BlockStatus = 'scheduled' | 'ready' | 'delayed' | 'crossed'

function resolveScheduledAt(row: CruceRow): Date | null {
  const candidate = row.fechaCrucePlaneada || row.fechaCruceEstimada
  if (!candidate) return null
  const d = new Date(candidate)
  return isNaN(d.getTime()) ? null : d
}

function resolveBridge(row: CruceRow): BridgeLabel {
  const b = (row.bridge || '').trim()
  // Normalize "I", "II", "III", "IV", "Puente II", "bridge 2", numeric.
  const upper = b.toUpperCase()
  if (upper.includes('IV') || upper.includes('4')) return 'Puente IV'
  if (upper.includes('III') || upper.includes('3')) return 'Puente III'
  if (upper.includes('II') || upper.includes('2')) return 'Puente II'
  if (upper.includes('I') || upper.includes('1')) return 'Puente I'
  return 'Puente II' // WTB default for unassigned
}

function computeStatus(row: CruceRow, scheduledAt: Date): BlockStatus {
  const sem = (row.semaforo || '').toLowerCase()
  if (sem === 'verde' || (row.estatus || '').toLowerCase().includes('cruzado')) {
    return 'crossed'
  }
  const now = Date.now()
  const diff = scheduledAt.getTime() - now
  // Delayed: planned time passed >30m ago and not marked crossed.
  if (diff < -30 * 60_000) return 'delayed'
  // Ready: within 2h of planned crossing.
  if (diff < 2 * 60 * 60_000) return 'ready'
  return 'scheduled'
}

function statusColor(s: BlockStatus): string {
  switch (s) {
    case 'crossed':
      return GREEN
    case 'delayed':
      return RED
    case 'ready':
      return GOLD
    case 'scheduled':
    default:
      return ACCENT_CYAN
  }
}

function laredoHourFraction(d: Date): number {
  // Returns floating hour 0-24 in America/Chicago.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  let h = 0
  let m = 0
  for (const p of parts) {
    if (p.type === 'hour') h = Number(p.value)
    if (p.type === 'minute') m = Number(p.value)
  }
  // 24:MM → interpret as 0h
  if (h === 24) h = 0
  return h + m / 60
}

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function dayLabel(key: string): string {
  // en-CA gives YYYY-MM-DD — parse safely as UTC and format es-MX.
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('es-MX', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  })
}

function glassCard(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    boxShadow: GLASS_SHADOW,
    ...extra,
  }
}

export function CruceClient({
  rows,
  clientOptions,
  rangeStartISO,
  rangeEndISO,
  lastUpdateLabel,
}: Props) {
  const track = useTrack()
  const [clientFilter, setClientFilter] = useState<string>('')
  const [bridgeFilter, setBridgeFilter] = useState<Record<BridgeLabel, boolean>>({
    'Puente I': true,
    'Puente II': true,
    'Puente III': true,
    'Puente IV': true,
  })

  useEffect(() => {
    track('page_view', { entityType: 'cruce' })
  }, [track])

  const rangeStart = useMemo(() => new Date(rangeStartISO), [rangeStartISO])
  const rangeEnd = useMemo(() => new Date(rangeEndISO), [rangeEndISO])

  // Filter rows by client + bridge, and build day buckets.
  const filtered = useMemo(() => {
    return rows
      .map((r) => {
        const scheduled = resolveScheduledAt(r)
        if (!scheduled) return null
        const bridge = resolveBridge(r)
        if (!bridgeFilter[bridge]) return null
        if (clientFilter && r.companyId !== clientFilter) return null
        const status = computeStatus(r, scheduled)
        return { row: r, scheduled, bridge, status }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [rows, clientFilter, bridgeFilter])

  // Build list of day keys in range for the timeline rendering order.
  const dayKeys = useMemo(() => {
    const keys: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart.getTime() + i * 86_400_000)
      keys.push(dayKey(d))
    }
    return keys
  }, [rangeStart])

  // Hero metrics.
  const todayKey = dayKey(new Date())
  const metrics = useMemo(() => {
    let hoy = 0
    let listos = 0
    let atrasados = 0
    for (const item of filtered) {
      if (dayKey(item.scheduled) === todayKey) hoy++
      if (item.status === 'ready') listos++
      if (item.status === 'delayed') atrasados++
    }
    return { hoy, listos, atrasados, semana: filtered.length }
  }, [filtered, todayKey])

  const hasAnyData = filtered.length > 0

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: 'var(--aguila-fs-title)',
              fontWeight: 800,
              color: TEXT_PRIMARY,
              margin: 0,
              letterSpacing: '-0.03em',
            }}
          >
            Programación de cruces
          </h1>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono)',
              fontSize: 'var(--aguila-fs-meta)',
              color: TEXT_MUTED,
            }}
          >
            Actualizado {lastUpdateLabel}
          </span>
        </div>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_SECONDARY, marginTop: 4 }}>
          Rango: hoy + 7 días · Zona America/Chicago
        </p>
      </div>

      {/* Hero strip */}
      <div
        className="cruce-hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <HeroTile label="Cruces hoy" value={metrics.hoy} color={ACCENT_CYAN} />
        <HeroTile label="Listos esperando" value={metrics.listos} color={GOLD} />
        <HeroTile label="Atrasados" value={metrics.atrasados} color={RED} />
        <HeroTile label="Total semana" value={metrics.semana} color={TEXT_PRIMARY} />
      </div>

      {/* Filters */}
      <div
        style={{
          ...glassCard({ padding: 16, marginBottom: 20 }),
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {clientOptions.length > 0 && (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 'var(--aguila-fs-meta)',
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Cliente
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              style={{
                minHeight: 40,
                minWidth: 180,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                color: TEXT_PRIMARY,
                fontSize: 'var(--aguila-fs-body)',
                fontFamily: 'var(--font-jetbrains-mono)',
              }}
            >
              <option value="">Todos</option>
              {clientOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 'var(--aguila-fs-meta)',
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Puente
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BRIDGES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() =>
                  setBridgeFilter((prev) => ({ ...prev, [b]: !prev[b] }))
                }
                style={{
                  minHeight: 40,
                  minWidth: 60,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: bridgeFilter[b]
                    ? 'rgba(192,197,206,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    bridgeFilter[b] ? 'rgba(192,197,206,0.35)' : BORDER
                  }`,
                  color: bridgeFilter[b] ? ACCENT_CYAN : TEXT_SECONDARY,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 12,
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
        }}
      >
        <LegendDot color={ACCENT_CYAN} label="Programado" />
        <LegendDot color={GOLD} label="Listo esperando" />
        <LegendDot color={RED} label="Atrasado" />
        <LegendDot color={GREEN} label="Cruzado" />
      </div>

      {!hasAnyData ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {dayKeys.map((dk) => {
            const dayItems = filtered.filter((x) => dayKey(x.scheduled) === dk)
            if (dayItems.length === 0) return null
            return (
              <div key={dk}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: TEXT_SECONDARY,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  {dayLabel(dk)}
                  {dk === todayKey ? (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(192,197,206,0.12)',
                        color: ACCENT_CYAN,
                        fontSize: 'var(--aguila-fs-label)',
                      }}
                    >
                      Hoy
                    </span>
                  ) : null}
                </div>

                {BRIDGES.filter((b) => bridgeFilter[b]).map((b) => {
                  const bridgeItems = dayItems.filter((x) => x.bridge === b)
                  return (
                    <BridgeRow
                      key={b}
                      bridge={b}
                      items={bridgeItems}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .cruce-hero-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .bridge-timeline-desktop { display: none !important; }
          .bridge-cards-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

function HeroTile({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div style={glassCard({ padding: 20 })}>
      <div
        style={{
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono)',
          fontSize: 'var(--aguila-fs-kpi-compact)',
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

interface BridgeRowItem {
  row: CruceRow
  scheduled: Date
  bridge: BridgeLabel
  status: BlockStatus
}

function BridgeRow({
  bridge,
  items,
}: {
  bridge: BridgeLabel
  items: BridgeRowItem[]
}) {
  return (
    <div
      style={{
        ...glassCard({ padding: 12 }),
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            minWidth: 90,
          }}
        >
          {bridge}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono)',
            fontSize: 'var(--aguila-fs-label)',
            color: TEXT_MUTED,
          }}
        >
          {items.length} cruce{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div
        className="bridge-timeline-desktop"
        style={{
          position: 'relative',
          height: 56,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
        }}
      >
        {/* Hour ticks */}
        {Array.from({ length: HOUR_SPAN + 1 }).map((_, i) => {
          const pct = (i / HOUR_SPAN) * 100
          const hour = HOUR_START + i
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -14,
                  left: -10,
                  fontSize: 9,
                  color: TEXT_MUTED,
                  fontFamily: 'var(--font-jetbrains-mono)',
                }}
              >
                {String(hour).padStart(2, '0')}
              </span>
            </div>
          )
        })}

        {items.map((item, idx) => {
          const hour = laredoHourFraction(item.scheduled)
          const clamped = Math.max(
            HOUR_START,
            Math.min(HOUR_END - 0.5, hour)
          )
          const leftPct = ((clamped - HOUR_START) / HOUR_SPAN) * 100
          const color = statusColor(item.status)
          return (
            <Link
              key={`${item.row.trafico}-${idx}`}
              href={`/embarques/${encodeURIComponent(item.row.trafico)}`}
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: `${leftPct}%`,
                minWidth: 64,
                minHeight: 40,
                padding: '4px 8px',
                borderRadius: 8,
                background: `${color}22`,
                border: `1px solid ${color}`,
                boxShadow: `0 0 12px -4px ${color}`,
                color: TEXT_PRIMARY,
                fontFamily: 'var(--font-jetbrains-mono)',
                fontSize: 'var(--aguila-fs-label)',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              title={`${item.row.trafico} · ${fmtDateTime(
                item.scheduled.toISOString()
              )}${item.row.lane ? ` · Carril ${item.row.lane}` : ''}`}
            >
              <span style={{ color, fontSize: 'var(--aguila-fs-label)' }}>{item.row.trafico}</span>
              {item.row.lane ? (
                <span style={{ color: TEXT_MUTED, fontSize: 9 }}>
                  Carril {item.row.lane}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>

      {/* Mobile vertical card list (< 600px) */}
      <div
        className="bridge-cards-mobile"
        style={{ display: 'none', flexDirection: 'column', gap: 8, marginTop: 8 }}
      >
        {items.length === 0 ? (
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, padding: 8 }}>Sin cruces</div>
        ) : (
          items.map((item, idx) => {
            const color = statusColor(item.status)
            return (
              <Link
                key={`m-${item.row.trafico}-${idx}`}
                href={`/embarques/${encodeURIComponent(item.row.trafico)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  minHeight: 60,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: `${color}1A`,
                  border: `1px solid ${color}55`,
                  color: TEXT_PRIMARY,
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 12, fontWeight: 700, color }}>
                    {item.row.trafico}
                  </span>
                  <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {fmtDateTime(item.scheduled.toISOString())}
                    {item.row.lane ? ` · Carril ${item.row.lane}` : ''}
                  </span>
                </div>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                    flexShrink: 0,
                  }}
                />
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        ...glassCard({ padding: 40 }),
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 12 }}>🛰️</div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          margin: '0 0 8px',
        }}
      >
        Recolectando datos de cruce
      </h2>
      <p
        style={{
          fontSize: 'var(--aguila-fs-body)',
          color: TEXT_SECONDARY,
          margin: 0,
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Los embarques aparecerán cuando <code style={{ fontFamily: 'var(--font-jetbrains-mono)', color: ACCENT_CYAN }}>fecha_cruce_planeada</code>{' '}
        esté poblada en la tabla traficos.
      </p>
    </div>
  )
}
