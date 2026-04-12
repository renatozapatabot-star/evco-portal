'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { MoreVertical } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_CYAN, RED, GREEN, GOLD,
} from '@/lib/design-system'
import type { TraficoRow } from './types'
import {
  markEntradaReceived, updateTraficoStatus, sendQuickEmail,
} from './actions'

const STATUS_OPTIONS = ['En Proceso', 'Cruzado', 'Pagado', 'Retrasado', 'Estancado']

interface Props {
  rows: TraficoRow[]
  filterKey: 'entradasHoy' | 'activos' | 'pendientes' | 'atrasados' | null
  onRefresh?: () => void
}

export function ActiveTraficos({ rows, filterKey, onRefresh }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const clients = useMemo(
    () => Array.from(new Set(rows.map(r => r.company_id).filter(Boolean))) as string[],
    [rows]
  )

  const visible = useMemo(() => {
    const now = Date.now()
    return rows.filter(r => {
      if (clientFilter && r.company_id !== clientFilter) return false
      if (statusFilter && r.estatus !== statusFilter) return false
      if (filterKey === 'atrasados') {
        if (!r.updated_at) return false
        const days = (now - new Date(r.updated_at).getTime()) / 86400000
        return days > 7
      }
      if (filterKey === 'pendientes') return !r.pedimento
      return true
    })
  }, [rows, clientFilter, statusFilter, filterKey])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const handleStatusChange = (t: TraficoRow, next: string) => {
    setMenuOpenId(null)
    startTransition(async () => {
      const res = await updateTraficoStatus(t.trafico, t.company_id || '', t.estatus || '', next)
      showToast(res.success ? `Estado actualizado: ${next}` : `Error: ${res.error}`)
      if (res.success) onRefresh?.()
    })
  }

  const handleMarkReceived = (t: TraficoRow) => {
    setMenuOpenId(null)
    startTransition(async () => {
      const res = await markEntradaReceived(t.trafico, t.company_id || '')
      showToast(res.success ? 'Entrada marcada como recibida' : `Error: ${res.error}`)
      if (res.success) onRefresh?.()
    })
  }

  const handleSendEmail = (t: TraficoRow) => {
    setMenuOpenId(null)
    startTransition(async () => {
      const res = await sendQuickEmail(t.trafico, t.company_id || '', 'docs_request')
      showToast(res.success ? 'Solicitud de documentos encolada' : `Error: ${res.error}`)
      if (res.success) onRefresh?.()
    })
  }

  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>
            Tráficos activos
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            {visible.length} de {rows.length} · orden por última actualización
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FilterSelect value={clientFilter} onChange={setClientFilter} options={clients} placeholder="Cliente" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Estatus" />
        </div>
      </div>

      <div className="inicio-table" style={{ overflowX: 'auto' }}>
        <style>{`
          @media (max-width: 768px) {
            .inicio-table table { font-size: 11px; }
            .inicio-table .col-hide { display: none; }
          }
        `}</style>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: TEXT_MUTED, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.08em' }}>
              <Th>Tráfico</Th>
              <Th className="col-hide">Cliente</Th>
              <Th className="col-hide">Proveedor</Th>
              <Th>Descripción</Th>
              <Th>Estatus</Th>
              <Th className="col-hide">Actualizado</Th>
              <Th>Días</Th>
              <Th style={{ width: 48 }}></Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: TEXT_MUTED }}>
                  Sin tráficos que coincidan con el filtro
                </td>
              </tr>
            ) : visible.map((r) => {
              const daysActive = r.updated_at
                ? Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000)
                : 0
              const isStale = daysActive > 7
              return (
                <tr key={r.trafico} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td>
                    <Link
                      href={`/traficos/${encodeURIComponent(r.trafico)}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: ACCENT_CYAN,
                        textDecoration: 'none',
                      }}
                    >
                      {r.trafico}
                    </Link>
                  </Td>
                  <Td className="col-hide">
                    <span style={{ fontFamily: 'var(--font-mono)', color: TEXT_SECONDARY }}>
                      {r.company_id || '—'}
                    </span>
                  </Td>
                  <Td className="col-hide">
                    <span style={{ color: TEXT_SECONDARY }}>
                      {truncate(r.proveedores, 24) || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: TEXT_PRIMARY }}>
                      {truncate(r.descripcion_mercancia, 48) || '—'}
                    </span>
                  </Td>
                  <Td>
                    <EstatusChip estatus={r.estatus} />
                  </Td>
                  <Td className="col-hide">
                    <span style={{ fontFamily: 'var(--font-mono)', color: TEXT_MUTED, fontSize: 11 }}>
                      {fmtDateTime(r.updated_at)}
                    </span>
                  </Td>
                  <Td>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: isStale ? RED : (daysActive > 3 ? GOLD : GREEN),
                    }}>
                      {daysActive}d
                    </span>
                  </Td>
                  <Td>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === r.trafico ? null : r.trafico)}
                        aria-label="Acciones"
                        style={{
                          width: 32,
                          height: 32,
                          background: 'transparent',
                          border: 'none',
                          color: TEXT_SECONDARY,
                          cursor: 'pointer',
                          borderRadius: 8,
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpenId === r.trafico && (
                        <RowMenu
                          trafico={r}
                          onClose={() => setMenuOpenId(null)}
                          onStatus={(next) => handleStatusChange(r, next)}
                          onReceive={() => handleMarkReceived(r)}
                          onSendEmail={() => handleSendEmail(r)}
                        />
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
          {isPending ? 'Guardando…' : '\u00A0'}
        </span>
        <Link href="/traficos" style={{ color: ACCENT_CYAN, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          Ver todos →
        </Link>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'rgba(10,14,22,0.95)',
          border: `1px solid ${ACCENT_CYAN}`,
          borderRadius: 12,
          padding: '12px 18px',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: GLASS_SHADOW,
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Th({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <th className={className} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, ...style }}>{children}</th>
}

function Td({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={className} style={{ padding: '10px 16px', verticalAlign: 'middle', ...style }}>{children}</td>
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        color: TEXT_PRIMARY,
        padding: '8px 12px',
        fontSize: 12,
        height: 40,
        minWidth: 140,
        outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function EstatusChip({ estatus }: { estatus: string | null }) {
  const color = estatus === 'Cruzado' || estatus === 'Pagado' ? GREEN
    : estatus === 'Retrasado' || estatus === 'Estancado' ? RED
    : GOLD
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color,
      background: `${color}1A`,
      border: `1px solid ${color}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {estatus || '—'}
    </span>
  )
}

function RowMenu({ trafico, onClose, onStatus, onReceive, onSendEmail }: {
  trafico: TraficoRow
  onClose: () => void
  onStatus: (next: string) => void
  onReceive: () => void
  onSendEmail: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
      />
      <div style={{
        position: 'absolute',
        top: 36,
        right: 0,
        background: 'rgba(10,14,22,0.98)',
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: GLASS_SHADOW,
        padding: 6,
        minWidth: 220,
        zIndex: 50,
      }}>
        <MenuItem onClick={onReceive} label="Marcar entrada recibida" />
        <MenuItem onClick={onSendEmail} label="Solicitar documentos" />
        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '6px 0' }} />
        <div style={{ padding: '6px 12px', fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Cambiar estatus
        </div>
        {STATUS_OPTIONS.filter(s => s !== trafico.estatus).map(s => (
          <MenuItem key={s} onClick={() => onStatus(s)} label={s} />
        ))}
        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '6px 0' }} />
        <Link
          href={`/traficos/${encodeURIComponent(trafico.trafico)}`}
          style={{
            display: 'block',
            padding: '10px 12px',
            fontSize: 12,
            color: ACCENT_CYAN,
            textDecoration: 'none',
          }}
        >
          Ver detalle →
        </Link>
      </div>
    </>
  )
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        color: TEXT_PRIMARY,
        fontSize: 12,
        cursor: 'pointer',
        borderRadius: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </button>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
