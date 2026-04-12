'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { MoreVertical } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_CYAN, RED, GREEN, GOLD,
} from '@/lib/design-system'
import type { TraficoRow } from '@/app/operador/inicio/types'
import {
  markEntradaReceived, updateTraficoStatus, sendQuickEmail,
} from '@/app/operador/inicio/actions'

const STATUS_OPTIONS = ['En Proceso', 'Cruzado', 'Pagado', 'Retrasado', 'Estancado']

interface Props {
  rows: TraficoRow[]
  scope: 'operator' | 'admin'
  onRefresh?: () => void
}

export function ActiveTraficosTable({ rows, scope: _scope, onRefresh }: Props) {
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
    return rows.filter(r => {
      if (clientFilter && r.company_id !== clientFilter) return false
      if (statusFilter && r.estatus !== statusFilter) return false
      return true
    })
  }, [rows, clientFilter, statusFilter])

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
    <>
      <details style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}>
        <summary style={{
          cursor: 'pointer',
          padding: '14px 20px',
          fontSize: 12,
          fontWeight: 700,
          color: ACCENT_CYAN,
          listStyle: 'none',
        }}>
          Ver tabla completa ({rows.length}) →
        </summary>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>
            {visible.length} de {rows.length} · orden por última actualización
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FilterSelect value={clientFilter} onChange={setClientFilter} options={clients} placeholder="Cliente" />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Estatus" />
          </div>
        </div>

        {/* Mobile card list with swipe gestures (< 600px) */}
        <div className="inicio-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: 8, padding: '8px 12px' }}>
          {visible.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED, fontSize: 12 }}>
              Sin tráficos que coincidan con el filtro
            </div>
          ) : visible.map((r) => (
            <SwipeCard
              key={`m-${r.trafico}`}
              row={r}
              onSwipeRight={() => handleMarkReceived(r)}
              onSwipeLeft={() => handleSendEmail(r)}
            />
          ))}
        </div>

        <div className="inicio-table" style={{ overflowX: 'auto' }}>
          <style>{`
            @media (max-width: 768px) {
              .inicio-table table { font-size: 11px; }
              .inicio-table .col-hide { display: none; }
            }
            @media (max-width: 600px) {
              .inicio-table { display: none !important; }
              .inicio-mobile-cards { display: flex !important; }
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
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          fontWeight: 700,
                          color: ACCENT_CYAN,
                          textDecoration: 'none',
                        }}
                      >
                        {r.trafico}
                      </Link>
                    </Td>
                    <Td className="col-hide">
                      <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY }}>
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
                      <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_MUTED, fontSize: 11 }}>
                        {fmtDateTime(r.updated_at)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
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
                            width: 32, height: 32,
                            background: 'transparent', border: 'none',
                            color: TEXT_SECONDARY, cursor: 'pointer', borderRadius: 8,
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
      </details>

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
    </>
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

/**
 * Mobile swipe card for ActiveTraficosTable.
 * - Right swipe (≥ 80px): mark entrada recibida (with confirm toast via parent).
 * - Left swipe (≥ 80px): open doc request (sendQuickEmail via parent).
 * - Tap: navigate to /traficos/[id].
 * Uses pointerdown/pointermove/pointerup for trackpad + touch parity.
 */
function SwipeCard({
  row,
  onSwipeRight,
  onSwipeLeft,
}: {
  row: TraficoRow
  onSwipeRight: () => void
  onSwipeLeft: () => void
}) {
  const [dx, setDx] = useState(0)
  const [confirming, setConfirming] = useState<'right' | 'left' | null>(null)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const isSwiping = useRef(false)
  const SWIPE_THRESHOLD = 80

  const daysActive = row.updated_at
    ? Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86400000)
    : 0
  const isStale = daysActive > 7
  const daysColor = isStale ? RED : daysActive > 3 ? GOLD : GREEN

  const onPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    startX.current = e.clientX
    startY.current = e.clientY
    isSwiping.current = false
  }

  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (startX.current == null || startY.current == null) return
    const deltaX = e.clientX - startX.current
    const deltaY = e.clientY - startY.current
    if (!isSwiping.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
      isSwiping.current = true
    }
    if (isSwiping.current) {
      setDx(Math.max(-140, Math.min(140, deltaX)))
    }
  }

  const onPointerUp = () => {
    if (isSwiping.current) {
      if (dx >= SWIPE_THRESHOLD) {
        setConfirming('right')
        setTimeout(() => {
          onSwipeRight()
          setConfirming(null)
        }, 400)
      } else if (dx <= -SWIPE_THRESHOLD) {
        setConfirming('left')
        setTimeout(() => {
          onSwipeLeft()
          setConfirming(null)
        }, 400)
      }
    }
    setDx(0)
    startX.current = null
    startY.current = null
    isSwiping.current = false
  }

  const rightBg = 'rgba(34,197,94,0.18)'
  const leftBg = 'rgba(192,197,206,0.18)'

  return (
    <div style={{ position: 'relative', minHeight: 72, touchAction: 'pan-y' }}>
      {/* Swipe action backgrounds (revealed as the card moves) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: dx > 0 ? 'flex-start' : 'flex-end',
          padding: '0 16px',
          borderRadius: 14,
          background: dx > 0 ? rightBg : dx < 0 ? leftBg : 'transparent',
          fontSize: 11,
          fontWeight: 700,
          color: dx > 0 ? GREEN : GOLD,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {dx > 20 ? 'Marcar recibida →' : dx < -20 ? '← Solicitar docs' : ''}
      </div>

      <Link
        href={`/traficos/${encodeURIComponent(row.trafico)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          // Prevent nav if we're mid-swipe
          if (Math.abs(dx) > 8 || confirming) e.preventDefault()
        }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 72,
          padding: '12px 14px',
          borderRadius: 14,
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          boxShadow: GLASS_SHADOW,
          color: 'inherit',
          textDecoration: 'none',
          transform: `translateX(${dx}px)`,
          transition: isSwiping.current ? 'none' : 'transform 160ms ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 13,
              fontWeight: 700,
              color: ACCENT_CYAN,
            }}
          >
            {row.trafico}
          </span>
          <EstatusChip estatus={row.estatus} />
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {truncate(row.descripcion_mercancia, 64) || '—'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          <span>{row.company_id || '—'}</span>
          <span style={{ color: daysColor, fontWeight: 700 }}>{daysActive}d</span>
        </div>
      </Link>
    </div>
  )
}
