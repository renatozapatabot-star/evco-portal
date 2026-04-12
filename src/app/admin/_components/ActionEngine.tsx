'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Check, Send, X } from 'lucide-react'
import { approveAction, requestChangesAction, rejectAction } from '@/app/admin/aprobaciones/actions'
import { fmtDateTime } from '@/lib/format-utils'
import { GOLD, GOLD_GRADIENT, BG_CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '@/lib/design-system'
import type { PendingDraft } from '@/types/cockpit'

interface ActionEngineProps {
  draft: PendingDraft | null
  onActionComplete: () => void
  totalPending: number
}

export function ActionEngine({ draft, onActionComplete, totalPending }: ActionEngineProps) {
  const [mode, setMode] = useState<'idle' | 'changes' | 'reject'>('idle')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    if (!draft) return
    setLoading(true)
    await approveAction(draft.id, draft.trafico_id || '', draft.company_id)
    setLoading(false)
    onActionComplete()
  }

  async function handleChanges() {
    if (!draft || !note.trim()) return
    setLoading(true)
    await requestChangesAction(draft.id, draft.trafico_id || '', draft.company_id, note)
    setLoading(false)
    setMode('idle')
    setNote('')
    onActionComplete()
  }

  async function handleReject() {
    if (!draft || !note.trim()) return
    setLoading(true)
    await rejectAction(draft.id, draft.trafico_id || '', draft.company_id, note)
    setLoading(false)
    setMode('idle')
    setNote('')
    onActionComplete()
  }

  // Extract data from draft_data defensively
  const dd = draft?.draft_data || {}
  const extraction = (dd.extraction || {}) as Record<string, unknown>
  const contributions = (dd.contributions || dd.duties || {}) as Record<string, unknown>
  const products = (dd.products || extraction.products || []) as Array<Record<string, unknown>>
  const supplier = (extraction.supplier_name || extraction.proveedor || '') as string
  const valorUSD = (contributions.valor_aduana_usd || extraction.valor_usd || 0) as number
  const totalMXN = (contributions.total_contribuciones_mxn || 0) as number
  const confidence = (dd.confidence || dd.confidence_score || 0) as number

  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid rgba(234,179,8,0.25)`,
      borderRadius: 20,
      padding: 24,
      boxShadow: '0 0 30px rgba(234,179,8,0.15), 0 10px 30px rgba(0,0,0,0.4)',
      flex: 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}>
        <Sparkles size={18} color={GOLD} />
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: GOLD,
        }}>
          Motor de Decisiones
        </span>
        {totalPending > 1 && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: TEXT_MUTED,
          }}>
            {totalPending} pendientes
          </span>
        )}
      </div>

      {/* Empty state */}
      {!draft && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(234,179,8,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Check size={28} color={GOLD} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
            Sin decisiones pendientes
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>
            Todos los pedimentos estan al corriente
          </div>
        </div>
      )}

      {/* Draft content */}
      {draft && (
        <>
          {/* Client + trafico */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
              {draft.company_name}
            </div>
            {draft.trafico_id && (
              <Link
                href={`/traficos/${draft.trafico_id}`}
                style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#C0C5CE', textDecoration: 'none' }}
              >
                {draft.trafico_id}
              </Link>
            )}
          </div>

          {/* Supplier + values */}
          {supplier && (
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>
              Proveedor: {supplier}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            {valorUSD > 0 && (
              <div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor USD</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>
                  ${valorUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {totalMXN > 0 && (
              <div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contribuciones MXN</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>
                  ${totalMXN.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {confidence > 0 && (
              <div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confianza</div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: confidence >= 0.8 ? '#22C55E' : confidence >= 0.5 ? '#FBBF24' : '#EF4444',
                }}>
                  {Math.round(confidence * 100)}%
                </div>
              </div>
            )}
          </div>

          {/* Top 3 line items */}
          {products.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 20,
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Partidas ({products.length})
              </div>
              {products.slice(0, 3).map((p, i) => (
                <div key={i} style={{
                  fontSize: 11,
                  color: TEXT_SECONDARY,
                  padding: '4px 0',
                  borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {(p.description || p.descripcion || '—') as string}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: GOLD, flexShrink: 0 }}>
                    {(p.fraccion || '—') as string}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
            Creado: {fmtDateTime(draft.created_at)}
          </div>

          {/* Inline note input */}
          {(mode === 'changes' || mode === 'reject') && (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mode === 'changes' ? 'Que cambios necesita...' : 'Razon del rechazo (requerido)...'}
                style={{
                  width: '100%',
                  minHeight: 80,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: 12,
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={mode === 'changes' ? handleChanges : handleReject}
                  disabled={loading || !note.trim()}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    background: mode === 'reject' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                    color: mode === 'reject' ? '#EF4444' : TEXT_PRIMARY,
                    border: 'none',
                    cursor: note.trim() ? 'pointer' : 'not-allowed',
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <Send size={14} />
                  {mode === 'changes' ? 'Enviar cambios' : 'Confirmar rechazo'}
                </button>
                <button
                  onClick={() => { setMode('idle'); setNote('') }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    fontSize: 13,
                    background: 'none',
                    color: TEXT_MUTED,
                    border: `1px solid ${BORDER}`,
                    cursor: 'pointer',
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {mode === 'idle' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleApprove}
                disabled={loading}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  background: GOLD_GRADIENT,
                  color: '#0D0D0C',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: 60,
                  flex: 1,
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Aprobar y Filar
              </button>
              <button
                onClick={() => setMode('changes')}
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)',
                  color: TEXT_PRIMARY,
                  border: `1px solid ${BORDER}`,
                  cursor: 'pointer',
                  minHeight: 60,
                }}
              >
                Pedir Cambios
              </button>
              <button
                onClick={() => setMode('reject')}
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'rgba(239,68,68,0.08)',
                  color: '#EF4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                  cursor: 'pointer',
                  minHeight: 60,
                }}
              >
                Rechazar
              </button>
            </div>
          )}

          {/* Footer link */}
          {totalPending > 1 && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                href="/admin/aprobaciones"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: GOLD,
                  textDecoration: 'none',
                }}
              >
                Ver cola completa ({totalPending}) →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
