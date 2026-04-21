'use client'

/**
 * ChainVincularModal — per-kind picker that wires into /api/chain/link.
 *
 * Opens when a ChainView node with status='missing' is tapped. Each kind
 * gets a tailored input:
 *   · factura    — search invoice bank by supplier / invoice number
 *   · entrada    — search recent entradas (last 30 days) by cve_entrada
 *   · pedimento  — masked input DD AD PPPP SSSSSSS with live validation
 *   · expediente — search expediente_documentos by filename / doc_type
 *
 * On submit → POST /api/chain/link with `{ trafico_id, node_type, target_id }`.
 * On success → onLinked() fires so the parent can optimistically update + toast.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ChainNodeKind } from './ChainView'
import { formatPedimento, isValidPedimento } from '@/lib/format/pedimento'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  SHADOW_HERO, BORDER_SILVER, GLASS_HERO,
  TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
  ACCENT_SILVER, AMBER,
} from '@/lib/design-system'

interface Props {
  open: boolean
  kind: ChainNodeKind | null
  traficoId: string
  onClose: () => void
  onLinked: (kind: ChainNodeKind, targetId: string) => void
}

interface PickerRow {
  id: string
  primary: string
  secondary?: string
  meta?: string
}

const KIND_LABEL: Record<ChainNodeKind, string> = {
  factura: 'Factura',
  entrada: 'Entrada',
  pedimento: 'Pedimento',
  trafico: 'Tráfico',
  expediente: 'Expediente',
}

export function ChainVincularModal({ open, kind, traficoId, onClose, onLinked }: Props) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PickerRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pedimentoInput, setPedimentoInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery(''); setRows([]); setSelectedId(null)
      setPedimentoInput(''); setError(null)
    }
  }, [open])

  // Fetch candidate rows when the query changes (pedimento skips — it's manual entry)
  useEffect(() => {
    if (!open || kind === 'pedimento' || kind === 'trafico' || kind === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const q = query.trim()
    const endpointFor = (k: Exclude<ChainNodeKind, 'pedimento' | 'trafico'>): string => {
      if (k === 'factura') return `/api/invoice-bank?status=unassigned&supplier_q=${encodeURIComponent(q)}&limit=20`
      if (k === 'entrada') return `/api/entradas/search?q=${encodeURIComponent(q)}&limit=20`
      return `/api/expedientes/search?q=${encodeURIComponent(q)}&limit=20`
    }
    fetch(endpointFor(kind))
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.results) ? json.data.results : []
        setRows(list.map(shapeRow(kind)))
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el listado. Inténtalo de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, kind, query])

  async function handleLink() {
    if (!kind || kind === 'trafico') return
    const targetId = kind === 'pedimento' ? pedimentoInput.trim() : selectedId
    if (!targetId) return
    if (kind === 'pedimento' && !isValidPedimento(targetId)) {
      setError('Formato DD AD PPPP SSSSSSS requerido.')
      return
    }
    setLinking(true)
    setError(null)
    try {
      const res = await fetch('/api/chain/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trafico_id: traficoId, node_type: kind, target_id: targetId }),
      })
      const json = await res.json()
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'No se pudo vincular.')
        return
      }
      onLinked(kind, targetId)
      onClose()
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setLinking(false)
    }
  }

  if (!open || !kind) return null

  const canSubmit =
    (kind === 'pedimento' && isValidPedimento(pedimentoInput))
    || (kind !== 'pedimento' && selectedId !== null)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vincular ${KIND_LABEL[kind]}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: GLASS_HERO,
          backdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER_SILVER}`,
          borderRadius: 20,
          boxShadow: SHADOW_HERO,
          overflow: 'hidden',
          color: TEXT_PRIMARY,
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <div>
            <div style={{
              fontSize: 'var(--aguila-fs-label)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 'var(--aguila-ls-dramatic)',
              color: TEXT_MUTED,
            }}>
              Vincular
            </div>
            <h2 style={{
              margin: '4px 0 0 0',
              fontSize: 'var(--aguila-fs-title)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: TEXT_PRIMARY,
            }}>
              {KIND_LABEL[kind]} → {traficoId}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              minWidth: 44, minHeight: 44,
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              color: TEXT_SECONDARY,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kind === 'pedimento' ? (
            <>
              <label style={{
                fontSize: 'var(--aguila-fs-label)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 'var(--aguila-ls-dramatic)',
                color: TEXT_MUTED,
              }}>
                Número de pedimento
              </label>
              <input
                type="text"
                value={pedimentoInput}
                onChange={(e) => setPedimentoInput(e.target.value)}
                placeholder="DD AD PPPP SSSSSSS"
                autoFocus
                style={{
                  minHeight: 60,
                  padding: '0 16px',
                  fontSize: 16,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${BORDER_SILVER}`,
                  borderRadius: 10,
                  color: TEXT_PRIMARY,
                  outline: 'none',
                }}
              />
              {pedimentoInput && !isValidPedimento(pedimentoInput) && (
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: AMBER }}>
                  Formato esperado: DD AD PPPP SSSSSSS (ej. 26 24 3596 6500441)
                </div>
              )}
              {isValidPedimento(pedimentoInput) && (
                <div style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  color: ACCENT_SILVER,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                }}>
                  ✓ {formatPedimento(pedimentoInput)}
                </div>
              )}
            </>
          ) : (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${KIND_LABEL[kind].toLowerCase()}…`}
                autoFocus
                style={{
                  minHeight: 60,
                  padding: '0 16px',
                  fontSize: 14,
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${BORDER_SILVER}`,
                  borderRadius: 10,
                  color: TEXT_PRIMARY,
                  outline: 'none',
                }}
              />
              <div style={{
                maxHeight: 320, overflowY: 'auto',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                backdropFilter: `blur(${GLASS_BLUR})`,
                boxShadow: GLASS_SHADOW,
              }}>
                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
                    Buscando…
                  </div>
                ) : rows.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
                    {query ? 'Sin resultados.' : 'Escribe para buscar.'}
                  </div>
                ) : (
                  rows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '12px 16px',
                        background: selectedId === r.id ? 'rgba(192,197,206,0.14)' : 'transparent',
                        border: 'none',
                        borderLeft: selectedId === r.id ? `2px solid ${ACCENT_SILVER}` : '2px solid transparent',
                        borderBottom: `1px solid ${BORDER}`,
                        color: TEXT_PRIMARY,
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>{r.primary}</div>
                      {r.secondary && (
                        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>{r.secondary}</div>
                      )}
                      {r.meta && (
                        <div style={{
                          fontSize: 'var(--aguila-fs-meta)',
                          color: TEXT_MUTED,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                        }}>{r.meta}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              color: '#FCA5A5',
              fontSize: 'var(--aguila-fs-body)',
            }}>
              {error}
            </div>
          )}
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '16px 20px', borderTop: `1px solid ${BORDER}`,
        }}>
          <button
            onClick={onClose}
            style={{
              minHeight: 44, padding: '0 20px',
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              color: TEXT_SECONDARY,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleLink()}
            disabled={!canSubmit || linking}
            style={{
              minHeight: 44, padding: '0 24px',
              background: canSubmit && !linking
                ? 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)'
                : 'rgba(148,163,184,0.2)',
              color: canSubmit && !linking ? '#0A0A0C' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: 10,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 700,
              cursor: canSubmit && !linking ? 'pointer' : 'not-allowed',
            }}
          >
            {linking ? 'Vinculando…' : `Vincular ${KIND_LABEL[kind].toLowerCase()}`}
          </button>
        </footer>
      </div>
    </div>
  )
}

function shapeRow(kind: ChainNodeKind) {
  return (raw: unknown): PickerRow => {
    const r = raw as Record<string, unknown>
    if (kind === 'factura') {
      return {
        id: String(r.id ?? ''),
        primary: String(r.supplier_name ?? r.invoice_number ?? 'Sin etiqueta'),
        secondary: r.invoice_number ? `Factura ${r.invoice_number}` : undefined,
        meta: r.amount != null && r.currency
          ? `${r.currency} ${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          : undefined,
      }
    }
    if (kind === 'entrada') {
      return {
        id: String(r.cve_entrada ?? r.id ?? ''),
        primary: String(r.cve_entrada ?? 'Entrada'),
        secondary: r.descripcion_mercancia ? String(r.descripcion_mercancia).slice(0, 60) : undefined,
        meta: r.fecha_llegada_mercancia ? String(r.fecha_llegada_mercancia).slice(0, 10) : undefined,
      }
    }
    // expediente
    return {
      id: String(r.id ?? ''),
      primary: String(r.nombre ?? r.doc_type ?? 'Documento'),
      secondary: r.doc_type ? String(r.doc_type) : undefined,
      meta: r.uploaded_at ? String(r.uploaded_at).slice(0, 10) : undefined,
    }
  }
}
