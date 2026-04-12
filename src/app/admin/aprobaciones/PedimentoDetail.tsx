'use client'

import { useState } from 'react'
import { FileText, CheckCircle, XCircle, Edit3 } from 'lucide-react'
import { fmtDateTime, fmtMXN, fmtUSD } from '@/lib/format-utils'
import { useToast } from '@/components/Toast'
import { LineItemsTable } from './LineItemsTable'
import { ComplianceFlags } from './ComplianceFlags'
import { approveAction, requestChangesAction, rejectAction } from './actions'

interface DraftRow {
  id: string
  trafico_id: string | null
  draft_data: Record<string, unknown>
  status: string
  company_id: string
  created_at: string
  company_name?: string
}

interface Props {
  draft: DraftRow
  onActionComplete: () => void
}

export function PedimentoDetail({ draft, onActionComplete }: Props) {
  const { toast } = useToast()
  const [actionState, setActionState] = useState<'idle' | 'approving' | 'changes' | 'rejecting'>('idle')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const dd = draft.draft_data || {}
  const extraction = (dd.extraction || {}) as Record<string, unknown>
  const contributions = (dd.contributions || dd.duties || {}) as Record<string, unknown>
  const approvalMeta = (dd.approval_metadata || {}) as Record<string, unknown>
  const products = (dd.products || dd.classifications || []) as Record<string, unknown>[]
  const flags = ((approvalMeta.compliance_flags || dd.flags || []) as string[])
  const missingDocs = (dd.missing_docs || []) as string[]

  const supplier = (extraction.supplier_name || dd.supplier || '—') as string
  const regimen = (dd.regimen || '—') as string
  const valorUSD = (contributions.valor_aduana_usd || extraction.total_value || dd.valor_total_usd || 0) as number
  const tipoCambio = (contributions.tipo_cambio || dd.tipo_cambio || 0) as number
  const valorMXN = tipoCambio > 0 ? valorUSD * tipoCambio : 0
  const dta = (contributions.dta || 0) as number
  const igi = ((contributions.igi as Record<string, unknown>)?.total || contributions.igi || 0) as number
  const iva = ((contributions.iva as Record<string, unknown>)?.total || contributions.iva || 0) as number

  const confAvg = (approvalMeta.confidence_avg || 0) as number
  const confTier = (approvalMeta.confidence_tier || dd.confianza || 'media') as string
  const lineCount = (approvalMeta.line_item_count || products.length) as number

  const tierColor = confTier === 'alta' ? '#22C55E' : confTier === 'media' ? '#FBBF24' : '#EF4444'
  const tierLabel = confTier === 'alta' ? 'Alta confianza' : confTier === 'media' ? 'Confianza media' : 'Baja confianza'

  async function handleApprove() {
    if (!draft.trafico_id) return
    setActionState('approving')
    const result = await approveAction(draft.id, draft.trafico_id, draft.company_id)
    if (result.success) {
      toast('Pedimento aprobado — procediendo a cruce', 'celebration')
      onActionComplete()
    } else {
      toast(result.error || 'Error al aprobar', 'error')
    }
    setActionState('idle')
  }

  async function handleRequestChanges() {
    if (!draft.trafico_id || !note.trim()) return
    setActionState('changes')
    const result = await requestChangesAction(draft.id, draft.trafico_id, draft.company_id, note.trim())
    if (result.success) {
      toast('Cambios solicitados', 'success')
      setNote('')
      onActionComplete()
    } else {
      toast(result.error || 'Error al solicitar cambios', 'error')
    }
    setActionState('idle')
  }

  async function handleReject() {
    if (!draft.trafico_id || !reason.trim()) return
    setActionState('rejecting')
    const result = await rejectAction(draft.id, draft.trafico_id, draft.company_id, reason.trim())
    if (result.success) {
      toast('Pedimento rechazado', 'info')
      setReason('')
      onActionComplete()
    } else {
      toast(result.error || 'Error al rechazar', 'error')
    }
    setActionState('idle')
  }

  const sectionStyle = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  } as const

  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
    marginBottom: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 100 }}>

      {/* Header */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: '#E6EDF3',
          }}>
            {draft.trafico_id || '—'}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: `${tierColor}18`, color: tierColor,
            border: `1px solid ${tierColor}33`,
          }}>
            {tierLabel} · {confAvg}%
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            <div style={labelStyle}>Cliente</div>
            <div style={{ fontSize: 14, color: '#E6EDF3', fontWeight: 600 }}>{draft.company_name || draft.company_id}</div>
          </div>
          <div>
            <div style={labelStyle}>Proveedor</div>
            <div style={{ fontSize: 14, color: '#E6EDF3' }}>{supplier}</div>
          </div>
          <div>
            <div style={labelStyle}>Régimen</div>
            <div style={{ fontSize: 14, color: '#E6EDF3' }}>{regimen}</div>
          </div>
          <div>
            <div style={labelStyle}>Recibido</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              {fmtDateTime(draft.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Value Summary */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Resumen de valor</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
          {[
            { label: 'Valor Aduana USD', value: fmtUSD(valorUSD) },
            { label: 'Valor Aduana MXN', value: valorMXN > 0 ? fmtMXN(valorMXN) : '—' },
            { label: 'DTA', value: dta > 0 ? fmtMXN(dta) : '—' },
            { label: 'IGI', value: igi > 0 ? fmtMXN(igi) : '—' },
            { label: 'IVA', value: iva > 0 ? fmtMXN(iva) : '—' },
          ].map(item => (
            <div key={item.label}>
              <div style={labelStyle}>{item.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#E6EDF3' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line Items */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>
          Líneas de producto ({lineCount})
        </div>
        <LineItemsTable products={products as Parameters<typeof LineItemsTable>[0]['products']} />
      </div>

      {/* Missing Documents */}
      {missingDocs.length > 0 && (
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>Documentos faltantes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {missingDocs.map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <FileText size={14} color="#FBBF24" />
                <span style={{ fontSize: 13, color: '#E6EDF3' }}>{doc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Flags */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Cumplimiento</div>
        <ComplianceFlags flags={flags} />
      </div>

      {/* Action Bar — sticky bottom */}
      <div className="approval-action-bar" style={{
        position: 'sticky', bottom: 0,
        background: 'rgba(5,7,11,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
        borderRadius: '20px 20px 0 0',
        zIndex: 10,
      }}>
        {actionState === 'idle' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleApprove}
              style={{
                flex: 2, minHeight: 60, borderRadius: 14,
                background: '#eab308', color: '#111',
                fontSize: 16, fontWeight: 800, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}
            >
              <CheckCircle size={20} /> Aprobar
            </button>
            <button
              onClick={() => setActionState('changes')}
              style={{
                flex: 1, minHeight: 60, borderRadius: 14,
                background: 'transparent', color: '#00E5FF',
                fontSize: 14, fontWeight: 700,
                border: '1px solid rgba(0,229,255,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6,
              }}
            >
              <Edit3 size={16} /> Cambios
            </button>
            <button
              onClick={() => setActionState('rejecting')}
              style={{
                minHeight: 60, minWidth: 60, borderRadius: 14,
                background: 'transparent', color: '#EF4444',
                fontSize: 14, fontWeight: 600,
                border: '1px solid rgba(239,68,68,0.2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={18} />
            </button>
          </div>
        )}

        {actionState === 'changes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Describe los cambios necesarios..."
              style={{
                width: '100%', minHeight: 80, padding: 12, borderRadius: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#E6EDF3', fontSize: 14, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleRequestChanges}
                disabled={!note.trim()}
                style={{
                  flex: 1, minHeight: 48, borderRadius: 10,
                  background: note.trim() ? '#00E5FF' : 'rgba(0,229,255,0.2)',
                  color: '#111', fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: note.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Enviar
              </button>
              <button
                onClick={() => { setActionState('idle'); setNote('') }}
                style={{
                  minHeight: 48, padding: '0 20px', borderRadius: 10,
                  background: 'transparent', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {actionState === 'rejecting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Razón del rechazo (requerido)..."
              style={{
                width: '100%', minHeight: 80, padding: 12, borderRadius: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                color: '#E6EDF3', fontSize: 14, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReject}
                disabled={!reason.trim()}
                style={{
                  flex: 1, minHeight: 48, borderRadius: 10,
                  background: reason.trim() ? '#EF4444' : 'rgba(239,68,68,0.2)',
                  color: '#FFF', fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: reason.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Confirmar rechazo
              </button>
              <button
                onClick={() => { setActionState('idle'); setReason('') }}
                style={{
                  minHeight: 48, padding: '0 20px', borderRadius: 10,
                  background: 'transparent', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {actionState === 'approving' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 60, color: '#eab308', fontSize: 16, fontWeight: 700,
          }}>
            Aprobando...
          </div>
        )}
      </div>
    </div>
  )
}
