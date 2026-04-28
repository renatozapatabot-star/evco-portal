'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Shield, Check, X, Edit3, Undo2, AlertTriangle, Clock } from 'lucide-react'
import { fmtDateTime, fmtUSD } from '@/lib/format-utils'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { approveDraft, rejectDraft, correctDraft, cancelApproval } from './actions'
import { AguilaTextarea } from '@/components/aguila'

// ── Types ──────────────────────────────────────────────

interface DraftData {
  supplier?: string
  valor_total_usd?: number
  regimen?: string
  pais_origen?: string
  confidence?: number
  confianza?: string
  flags?: string[]
  classifications?: Array<{ fraccion?: string; confidence?: number }>
  extraction?: {
    supplier_name?: string
    invoice_number?: string
    products?: Array<{ description?: string; fraccion?: string }>
  }
  correction_note?: string
  rejection_reason?: string
  [key: string]: unknown
}

interface DraftRow {
  id: string
  trafico_id: string | null
  draft_data: DraftData | null
  status: string
  created_at: string
  updated_at: string
  company_id: string | null
}

export interface EscalationRow {
  id: string
  workflow: string
  event_type: string
  trigger_id: string | null
  company_id: string
  error_message: string | null
  created_at: string
  [key: string]: unknown
}

interface Props {
  initialPending: DraftRow[]
  initialRecent: DraftRow[]
  initialEscalations: EscalationRow[]
}

// ── Helpers ──────────────────────────────────────────────

function resolveStatus(draft: DraftRow): string {
  if (draft.status === 'approved_pending') {
    const elapsed = Date.now() - new Date(draft.updated_at).getTime()
    if (elapsed > 5000) return 'approved'
  }
  return draft.status
}

function confidenceColor(conf: number): string {
  if (conf >= 85) return 'var(--portal-status-green-fg)'
  if (conf >= 70) return 'var(--portal-status-amber-fg)'
  return 'var(--portal-status-red-fg)'
}

function confidenceLabel(conf: number): string {
  if (conf >= 85) return 'Alta'
  if (conf >= 70) return 'Media'
  return 'Baja'
}

// ── Component ──────────────────────────────────────────────

export function ApprovalQueue({ initialPending, initialRecent, initialEscalations }: Props) {
  const [pending, setPending] = useState(initialPending)
  const [recent, setRecent] = useState(initialRecent)
  const [escalations] = useState(initialEscalations)
  const [activeTab, setActiveTab] = useState<'pending' | 'recent' | 'escalations'>('pending')
  const [actionModal, setActionModal] = useState<{ draft: DraftRow; type: 'reject' | 'correct' } | null>(null)
  const [modalText, setModalText] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [blessingId, setBlessingId] = useState<string | null>(null)
  const [cancelCountdowns, setCancelCountdowns] = useState<Map<string, number>>(new Map())

  // Blessing auto-dismiss
  useEffect(() => {
    if (blessingId) {
      const t = setTimeout(() => setBlessingId(null), 3000)
      return () => clearTimeout(t)
    }
  }, [blessingId])

  // Countdown ticks for approved_pending items
  useEffect(() => {
    const interval = setInterval(() => {
      const newMap = new Map<string, number>()
      let changed = false
      for (const d of pending) {
        if (d.status === 'approved_pending') {
          const elapsed = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 1000)
          const remaining = Math.max(0, 5 - elapsed)
          newMap.set(d.id, remaining)
          if (remaining === 0) {
            // Auto-advance to approved
            setPending(prev => prev.filter(p => p.id !== d.id))
            setRecent(prev => [{ ...d, status: 'approved' }, ...prev])
            setBlessingId(d.id)
            changed = true
          }
        }
      }
      if (!changed) setCancelCountdowns(newMap)
    }, 500)
    return () => clearInterval(interval)
  }, [pending])

  // Polling refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/data?table=pedimento_drafts&limit=50&order_by=created_at&order_dir=asc')
        const json = await res.json()
        const all = (json.data || []) as DraftRow[]
        setPending(all.filter(d => ['draft', 'pending', 'approved_pending'].includes(d.status)))
      } catch { /* silent */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // ── Actions ──────────────────────────────────────────────

  const handleApprove = useCallback(async (draft: DraftRow) => {
    setActionLoading(draft.id)
    const result = await approveDraft(draft.id)
    setActionLoading(null)
    if (result.success) {
      // Move to approved_pending state (5-second window starts)
      setPending(prev => prev.map(d =>
        d.id === draft.id ? { ...d, status: 'approved_pending', updated_at: new Date().toISOString() } : d
      ))
    }
  }, [])

  const handleReject = useCallback(async () => {
    if (!actionModal || actionModal.type !== 'reject') return
    setActionLoading(actionModal.draft.id)
    const result = await rejectDraft(actionModal.draft.id, modalText)
    setActionLoading(null)
    if (result.success) {
      setPending(prev => prev.filter(d => d.id !== actionModal.draft.id))
      setRecent(prev => [{ ...actionModal.draft, status: 'rejected' }, ...prev])
      setActionModal(null)
      setModalText('')
    }
  }, [actionModal, modalText])

  const handleCorrect = useCallback(async () => {
    if (!actionModal || actionModal.type !== 'correct') return
    setActionLoading(actionModal.draft.id)
    const result = await correctDraft(actionModal.draft.id, modalText)
    setActionLoading(null)
    if (result.success) {
      setPending(prev => prev.filter(d => d.id !== actionModal.draft.id))
      setRecent(prev => [{ ...actionModal.draft, status: 'approved_corrected' }, ...prev])
      setBlessingId(actionModal.draft.id)
      setActionModal(null)
      setModalText('')
    }
  }, [actionModal, modalText])

  const handleCancel = useCallback(async (draft: DraftRow) => {
    setActionLoading(draft.id)
    const result = await cancelApproval(draft.id)
    setActionLoading(null)
    if (result.success) {
      setPending(prev => prev.map(d =>
        d.id === draft.id ? { ...d, status: 'draft', updated_at: new Date().toISOString() } : d
      ))
    }
  }, [])

  // ── Render ──────────────────────────────────────────────

  const pendingCount = pending.filter(d => resolveStatus(d) !== 'approved').length

  return (
    <>
      {/* Blessing overlay */}
      {blessingId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          animation: 'fadeIn 300ms ease',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🦀</div>
            <div style={{
              fontSize: 'var(--aguila-fs-headline)', fontWeight: 800, color: 'var(--portal-fg-1)',
              letterSpacing: '-0.02em',
            }}>
              Patente 3596 honrada.
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-4)', marginTop: 8 }}>
              Gracias, Tito.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(192,197,206,0.1)',
          border: '1px solid rgba(192,197,206,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={20} color="var(--portal-fg-1)" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--portal-fg-1)', margin: 0 }}>
            Aprobaciones
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', margin: '2px 0 0' }}>
            {pendingCount > 0 ? `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}` : 'Todo aprobado'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { key: 'pending' as const, label: 'Pendientes', count: pendingCount },
          { key: 'recent' as const, label: 'Recientes', count: recent.length },
          { key: 'escalations' as const, label: 'Escalaciones', count: escalations.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', borderRadius: 20, border: 'none',
              fontSize: 'var(--aguila-fs-body)', fontWeight: 600, cursor: 'pointer',
              minHeight: 44,
              background: activeTab === tab.key ? 'rgba(192,197,206,0.12)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab.key ? 'var(--portal-fg-3)' : 'var(--portal-fg-4)',
              transition: 'all 150ms',
            }}
          >
            {tab.label} {tab.count > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 'var(--aguila-fs-meta)', fontWeight: 700,
                padding: '2px 8px', borderRadius: 10,
                background: activeTab === tab.key ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.06)',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PENDING TAB ───────────────────────────── */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingCount === 0 ? (
            <EmptyState
              icon="✅"
              title="Sin borradores pendientes"
              description="Todos los borradores han sido revisados."
            />
          ) : (
            pending.filter(d => resolveStatus(d) !== 'approved').map(draft => {
              const dd = (draft.draft_data || {}) as DraftData
              const supplier = dd.supplier || dd.extraction?.supplier_name || 'Proveedor desconocido'
              const valor = dd.valor_total_usd || 0
              const confidence = dd.confidence || 0
              const fraccion = dd.classifications?.[0]?.fraccion || ''
              const flags = dd.flags || []
              const isApproving = draft.status === 'approved_pending'
              const countdown = cancelCountdowns.get(draft.id)
              const isLoading = actionLoading === draft.id

              return (
                <div key={draft.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `1px solid ${isApproving ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 20,
                  padding: 20,
                  transition: 'all 300ms',
                  boxShadow: isApproving
                    ? '0 0 20px rgba(192,197,206,0.15)'
                    : '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}>
                  {/* Top row: company + confidence + trafico */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(192,197,206,0.08)', color: 'var(--portal-fg-3)',
                      }}>
                        {draft.company_id || 'SIN CLAVE'}
                      </span>
                      {draft.trafico_id && (
                        <Link
                          href={`/embarques/${encodeURIComponent(draft.trafico_id)}`}
                          style={{
                            fontSize: 'var(--aguila-fs-body)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                            color: 'var(--portal-fg-3)', textDecoration: 'none',
                          }}
                        >
                          {draft.trafico_id.substring(0, 12)}
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: `${confidenceColor(confidence)}15`,
                        color: confidenceColor(confidence),
                      }}>
                        {confidence}% {confidenceLabel(confidence)}
                      </span>
                    </div>
                  </div>

                  {/* Supplier + value */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--portal-fg-1)' }}>
                      {supplier}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
                      {valor > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {fmtUSD(valor)} USD
                        </span>
                      )}
                      {fraccion && (
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {fraccion}
                        </span>
                      )}
                      {dd.regimen && <span>{dd.regimen}</span>}
                    </div>
                  </div>

                  {/* Flags */}
                  {flags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {flags.map(f => (
                        <span key={f} style={{
                          fontSize: 'var(--aguila-fs-label)', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          background: 'var(--portal-status-red-bg)', color: 'var(--portal-status-red-fg)',
                        }}>
                          🚩 {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-5)',
                    marginBottom: 16,
                  }}>
                    {fmtDateTime(draft.created_at)}
                  </div>

                  {/* ── ACTION BUTTONS ───────────────────── */}
                  {isApproving ? (
                    /* Cancellation window active */
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(192,197,206,0.08)',
                      border: '1px solid rgba(192,197,206,0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} color="var(--portal-fg-1)" />
                        <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', fontWeight: 600 }}>
                          Aprobando... {countdown !== undefined ? `${countdown}s` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancel(draft)}
                        disabled={isLoading}
                        style={{
                          padding: '8px 16px', borderRadius: 10, border: '1px solid var(--portal-status-red-ring)',
                          background: 'var(--portal-status-red-bg)', color: 'var(--portal-status-red-fg)',
                          fontSize: 'var(--aguila-fs-body)', fontWeight: 600, cursor: 'pointer', minHeight: 44,
                        }}
                      >
                        <Undo2 size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    /* Normal action buttons */
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* ONE TAP APPROVE — the big gold button */}
                      <button
                        onClick={() => handleApprove(draft)}
                        disabled={isLoading}
                        style={{
                          flex: 1, minWidth: 140, padding: '12px 20px', borderRadius: 12,
                          border: 'none', cursor: 'pointer', minHeight: 60,
                          background: isLoading ? 'rgba(192,197,206,0.3)' : 'var(--portal-fg-1)',
                          color: '#000', fontSize: 15, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          transition: 'all 150ms',
                        }}
                      >
                        <Check size={20} strokeWidth={3} />
                        {isLoading ? 'Aprobando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => { setActionModal({ draft, type: 'correct' }); setModalText('') }}
                        style={{
                          padding: '12px 16px', borderRadius: 12, minHeight: 60,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--portal-fg-4)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Edit3 size={14} /> Corregir
                      </button>
                      <button
                        onClick={() => { setActionModal({ draft, type: 'reject' }); setModalText('') }}
                        style={{
                          padding: '12px 16px', borderRadius: 12, minHeight: 60,
                          border: '1px solid rgba(239,68,68,0.15)',
                          background: 'var(--portal-status-red-bg)',
                          color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── RECENT TAB ───────────────────────────── */}
      {activeTab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.length === 0 ? (
            <EmptyState icon="📋" title="Sin actividad reciente" description="Las aprobaciones aparecerán aquí." />
          ) : (
            recent.map(draft => {
              const dd = (draft.draft_data || {}) as DraftData
              const supplier = dd.supplier || 'Proveedor'
              const resolved = resolveStatus(draft)
              const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
                approved: { icon: '✅', color: 'var(--portal-status-green-fg)', label: 'Aprobado' },
                approved_corrected: { icon: '✏️', color: 'var(--portal-status-amber-fg)', label: 'Corregido' },
                rejected: { icon: '❌', color: 'var(--portal-status-red-fg)', label: 'Rechazado' },
              }
              const sc = statusConfig[resolved] || { icon: '⏳', color: 'var(--portal-fg-5)', label: resolved }

              return (
                <div key={draft.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ fontSize: 'var(--aguila-fs-kpi-small)' }}>{sc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--portal-fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {supplier}
                    </div>
                    <div style={{ fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-5)' }}>
                      {fmtDateTime(draft.updated_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                    background: `${sc.color}15`, color: sc.color,
                  }}>
                    {sc.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── ESCALATIONS TAB ───────────────────────── */}
      {activeTab === 'escalations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {escalations.length === 0 ? (
            <EmptyState icon="🫡" title="Sin escalaciones" description="Los operadores no han escalado nada." />
          ) : (
            escalations.map(esc => (
              <div key={String(esc.id)} style={{
                padding: '14px 16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--portal-status-red-bg)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={14} color="var(--portal-status-red-fg)" />
                    <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--portal-fg-1)' }}>
                      {String(esc.event_type || '').replace(/\./g, ' → ')}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(192,197,206,0.08)', color: 'var(--portal-fg-3)' }}>
                    {esc.company_id}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-status-red-fg)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                  {esc.error_message || 'Sin detalle'}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-5)' }}>
                  {fmtDateTime(String(esc.created_at))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── REJECT / CORRECT MODAL ───────────────── */}
      <BottomSheet
        open={!!actionModal}
        onClose={() => { setActionModal(null); setModalText('') }}
        title={actionModal?.type === 'reject' ? 'Rechazar Borrador' : 'Aprobar con Corrección'}
      >
        {actionModal && (
          <div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginBottom: 16 }}>
              {actionModal.type === 'reject'
                ? `Rechazar borrador de ${((actionModal.draft.draft_data || {}) as DraftData).supplier || 'proveedor'}. Escribe el motivo:`
                : `Aprobar con corrección para ${((actionModal.draft.draft_data || {}) as DraftData).supplier || 'proveedor'}. Escribe la nota:`
              }
            </div>
            <AguilaTextarea
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={actionModal.type === 'reject' ? 'Motivo de rechazo...' : 'Nota de corrección...'}
              rows={3}
              style={{ resize: 'none' }}
              required={actionModal.type === 'reject'}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={actionModal.type === 'reject' ? handleReject : handleCorrect}
                disabled={!modalText.trim() || actionLoading === actionModal.draft.id}
                style={{
                  flex: 1, padding: '14px 20px', borderRadius: 12, border: 'none',
                  background: actionModal.type === 'reject' ? 'var(--portal-status-red-fg)' : 'var(--portal-fg-1)',
                  color: actionModal.type === 'reject' ? '#FFF' : '#000',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', minHeight: 60,
                  opacity: !modalText.trim() ? 0.4 : 1,
                }}
              >
                {actionModal.type === 'reject' ? 'Rechazar' : 'Aprobar con Corrección'}
              </button>
              <button
                onClick={() => { setActionModal(null); setModalText('') }}
                style={{
                  padding: '14px 20px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'var(--portal-fg-4)',
                  fontSize: 'var(--aguila-fs-section)', fontWeight: 600, cursor: 'pointer', minHeight: 60,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}
