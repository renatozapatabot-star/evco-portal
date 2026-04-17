'use client'

// /monitor · live ops surface.
//
// Reuses the existing Supabase realtime channel pattern from
// use-realtime-trafico.ts. Unlike that hook, this page merges updates into
// a local rowset instead of raising a slide-in — operator scans the grid
// continuously.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  ACCENT_SILVER, AMBER, BG_CARD, BORDER,
  GLASS_BLUR, GLASS_SHADOW, GREEN, RED,
  TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'
import { FallbackLink, SectionHeader } from '@/components/aguila'
import { renderNull } from '@/lib/ui/cell-renderers'

export interface MonitorRow {
  trafico: string
  company_id: string | null
  estatus: string | null
  semaforo: number | null
  descripcion_mercancia: string | null
  fecha_llegada: string | null
  fecha_cruce: string | null
  updated_at: string | null
  pedimento: string | null
}

interface Props {
  initialRows: MonitorRow[]
  role: string
  companyId: string
  isInternal: boolean
}

type StatusFilter = 'all' | 'En Proceso' | 'Documentacion' | 'En Aduana' | 'Pedimento Pagado'

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'En Proceso', label: 'En proceso' },
  { key: 'Documentacion', label: 'Documentación' },
  { key: 'En Aduana', label: 'En aduana' },
  { key: 'Pedimento Pagado', label: 'Pedimento pagado' },
]

function semaforoColor(s: number | null | undefined): { label: string; bg: string; fg: string } {
  if (s === 2) return { label: 'Rojo', bg: 'rgba(239,68,68,0.14)', fg: '#FCA5A5' }
  if (s === 1) return { label: 'Amarillo', bg: 'rgba(251,191,36,0.14)', fg: '#FDE68A' }
  if (s === 0) return { label: 'Verde', bg: 'rgba(34,197,94,0.14)', fg: '#86EFAC' }
  return { label: '—', bg: 'rgba(148,163,184,0.1)', fg: TEXT_MUTED }
}

function elapsedSince(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff) || diff < 0) return '—'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function MonitorClient({ initialRows, role, companyId, isInternal }: Props) {
  void role
  const [rows, setRows] = useState<MonitorRow[]>(initialRows)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [lastTick, setLastTick] = useState(Date.now())

  // Force a re-render of the "elapsed" column every 60s.
  useEffect(() => {
    const id = setInterval(() => setLastTick(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  void lastTick

  // Realtime subscription — reuses the proven cruz-realtime pattern.
  useEffect(() => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const filter = isInternal ? undefined : `company_id=eq.${companyId}`
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const channel = sb
      .channel('monitor-live')
      .on(
        'postgres_changes' as any, // any-ok: supabase-js realtime event name type lacks string literals
        { event: 'UPDATE', schema: 'public', table: 'traficos', ...(filter ? { filter } : {}) },
        (payload: { new: Record<string, unknown> }) => {
          const next = payload.new as Partial<MonitorRow> & { trafico?: string }
          if (!next.trafico) return
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.trafico === next.trafico)
            if (idx === -1) {
              return [next as MonitorRow, ...prev].slice(0, 500)
            }
            const merged: MonitorRow = { ...prev[idx], ...(next as MonitorRow) }
            const copy = [...prev]
            copy[idx] = merged
            return copy
          })
        },
      )
      .subscribe()
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return () => {
      sb.removeChannel(channel)
    }
  }, [isInternal, companyId])

  const clientOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.company_id) set.add(r.company_id)
    return ['all', ...Array.from(set).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.estatus !== statusFilter) return false
      if (clientFilter !== 'all' && r.company_id !== clientFilter) return false
      return true
    })
  }, [rows, statusFilter, clientFilter])

  const redCount = rows.filter((r) => r.semaforo === 2).length
  const totalActive = rows.length

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>
      <SectionHeader title="Monitor de operaciones" count={totalActive} />

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
        padding: '16px 20px', marginTop: 16,
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: GLASS_SHADOW,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: `1px solid ${statusFilter === opt.key ? ACCENT_SILVER : BORDER}`,
                background: statusFilter === opt.key ? 'rgba(192,197,206,0.14)' : 'transparent',
                color: statusFilter === opt.key ? TEXT_PRIMARY : TEXT_SECONDARY,
                fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {isInternal && clientOptions.length > 2 && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: TEXT_PRIMARY,
              fontSize: 'var(--aguila-fs-compact)',
            }}
          >
            {clientOptions.map((c) => (
              <option key={c} value={c} style={{ background: '#0B1220' }}>
                {c === 'all' ? 'Todos los clientes' : c}
              </option>
            ))}
          </select>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {redCount > 0 ? (
            <span style={{ color: '#FCA5A5', fontWeight: 600 }}>
              {redCount} semáforo{redCount === 1 ? '' : 's'} rojo{redCount === 1 ? '' : 's'}
            </span>
          ) : (
            `${filtered.length} visibles · realtime activo`
          )}
        </div>
      </div>

      <div style={{
        marginTop: 16,
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(80px, 0.8fr) minmax(140px, 1.5fr) 90px minmax(100px, 1fr) 70px 70px',
          gap: 12,
          padding: '12px 16px',
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 'var(--aguila-fs-label)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          color: TEXT_MUTED,
        }}>
          <div>Tráfico</div>
          <div>Cliente</div>
          <div>Mercancía</div>
          <div>Semáforo</div>
          <div>Estatus</div>
          <div>Pedim.</div>
          <div style={{ textAlign: 'right' }}>Act.</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
            Sin tráficos activos con los filtros seleccionados.
          </div>
        ) : (
          filtered.slice(0, 200).map((r) => {
            const sem = semaforoColor(r.semaforo)
            return (
              <Link
                key={r.trafico}
                href={`/embarques/${encodeURIComponent(r.trafico)}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(80px, 0.8fr) minmax(140px, 1.5fr) 90px minmax(100px, 1fr) 70px 70px',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  color: TEXT_PRIMARY,
                  textDecoration: 'none',
                  fontSize: 'var(--aguila-fs-body)',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontWeight: 600 }}>
                  {r.trafico}
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-compact)' }}>{r.company_id ?? renderNull()}</div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-compact)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.descripcion_mercancia ?? renderNull()}
                </div>
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 20,
                    background: sem.bg,
                    color: sem.fg,
                    fontSize: 'var(--aguila-fs-meta)',
                    fontWeight: 600,
                  }}>
                    {sem.label}
                  </span>
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-compact)' }}>{r.estatus ?? renderNull()}</div>
                <div style={{ color: r.pedimento ? GREEN : TEXT_MUTED, fontSize: 'var(--aguila-fs-meta)' }}>
                  {r.pedimento ? 'sí' : renderNull()}
                </div>
                <div style={{ textAlign: 'right', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  {elapsedSince(r.updated_at)}
                </div>
              </Link>
            )
          })
        )}
      </div>

      <FallbackLink
        href="https://trafico1web.globalpc.net/utilerias/monitor"
        label="Monitor"
        isIncomplete={rows.length === 0}
        message="Sin tráficos activos en CRUZ — consulta el Monitor de GlobalPC."
      />

      {/* Reserved: colors map to red/amber/green/silver without relying on decorative imports */}
      <span style={{ display: 'none' }}>{RED}{AMBER}</span>
    </div>
  )
}
