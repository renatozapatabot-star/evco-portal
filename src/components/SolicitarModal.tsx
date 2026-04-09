'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useToast } from '@/components/Toast'
import { getCookieValue } from '@/lib/client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RECIPIENTS = [
  { id: 'contacto-principal', name: 'Contacto principal' },
  { id: 'coordinacion', name: 'Coordinación logística' },
]

const DEADLINE_OPTIONS = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas (recomendado)' },
  { value: '72', label: '72 horas' },
]

interface Props {
  traficoId: string
  missingDocs: string[]
  onClose: () => void
  onSuccess: () => void
}

export function SolicitarModal({ traficoId, missingDocs, onClose, onSuccess }: Props) {
  const companyId = getCookieValue('company_id') ?? ''
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(missingDocs)
  const [recipient, setRecipient] = useState(RECIPIENTS[0].id)
  const [deadline, setDeadline] = useState('48')
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const toggle = (doc: string) => {
    setSelected(prev =>
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    )
  }

  const handleSend = async () => {
    if (selected.length === 0 || sendState !== 'idle') return
    setSendState('sending')

    const deadlineHours = parseInt(deadline, 10)
    const now = new Date()
    const deadlineDate = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000)
    const escalateDate = new Date(now.getTime() + (deadlineHours + 24) * 60 * 60 * 1000)

    const selectedRecipient = RECIPIENTS.find(r => r.id === recipient)

    try {
      // Duplicate check: if solicitud exists for this tráfico in last 24h
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('documento_solicitudes')
        .select('id')
        .eq('trafico_id', traficoId)
        .eq('company_id', companyId)
        .gte('solicitado_at', twentyFourHoursAgo)
        .limit(1)

      if (existing && existing.length > 0) {
        toast('Solicitud ya enviada recientemente', 'error')
        setSendState('idle')
        return
      }

      // Insert into documento_solicitudes with doc_types as TEXT[]
      const { error: solError } = await supabase
        .from('documento_solicitudes')
        .insert({
          trafico_id: traficoId,
          company_id: companyId,
          doc_types: selected,
          recipient_name: selectedRecipient?.name ?? 'Contacto principal',
          deadline: deadlineDate.toISOString(),
          escalate_after: escalateDate.toISOString(),
          status: 'solicitado',
          solicitado_at: now.toISOString(),
        })

      if (solError) {
        toast('Error al crear solicitud', 'error')
        setSendState('idle')
        return
      }

      // Insert notification (non-fatal)
      await supabase
        .from('notifications')
        .insert({
          type: 'documento_solicitado',
          title: `Documentos solicitados para ${traficoId}`,
          body: `${selected.length} documento${selected.length !== 1 ? 's' : ''} solicitado${selected.length !== 1 ? 's' : ''} con plazo de ${deadlineHours}h`,
          company_id: companyId,
          metadata: { trafico_id: traficoId, doc_types: selected },
        })
        .then(() => { /* non-fatal — ignore result */ })

      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate(50)

      setSendState('sent')
      onSuccess()

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose()
        router.refresh()
      }, 2000)
    } catch {
      toast('Error al enviar solicitud', 'error')
      setSendState('idle')
    }
  }

  const selectedRecipient = RECIPIENTS.find(r => r.id === recipient)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 998,
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 440, maxWidth: '90vw', maxHeight: '80vh',
        overflow: 'auto',
        background: 'var(--card-bg)', borderRadius: 12, padding: 24,
        zIndex: 999,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Solicitar documentos
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Tráfico {traficoId} · {selected.length} {selected.length === 1 ? 'documento' : 'documentos'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9C9890', minHeight: 60, minWidth: 60,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Checkboxes */}
        <div style={{ marginBottom: 16 }}>
          {missingDocs.map(doc => (
            <label
              key={doc}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', cursor: 'pointer', fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(doc)}
                onChange={() => toggle(doc)}
              />
              {doc}
            </label>
          ))}
        </div>

        {/* Recipient */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            display: 'block', marginBottom: 4,
          }}>
            Enviar a:
          </label>
          <select
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px',
              border: '1px solid #E8E5E0', borderRadius: 8, fontSize: 13,
            }}
          >
            {RECIPIENTS.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Deadline */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            display: 'block', marginBottom: 4,
          }}>
            Plazo:
          </label>
          <select
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px',
              border: '1px solid #E8E5E0', borderRadius: 8, fontSize: 13,
            }}
          >
            {DEADLINE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Preview */}
        {selected.length > 0 && (
          <div style={{
            marginBottom: 20, padding: '12px 16px',
            background: 'var(--bg-main)', border: '1px solid #E8E5E0',
            borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Vista previa
            </div>
            Se solicitarán <strong>{selected.length}</strong>{' '}
            documento{selected.length !== 1 ? 's' : ''} a{' '}
            <strong>{selectedRecipient?.name}</strong> con plazo de{' '}
            <strong>{deadline}h</strong>:
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {selected.map(doc => <li key={doc}>{doc}</li>)}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: 8,
              border: '1px solid #E8E5E0', background: 'var(--card-bg)',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', minHeight: 60,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sendState !== 'idle' || selected.length === 0}
            style={{
              flex: 2, padding: '12px', borderRadius: 8,
              border: 'none',
              background: sendState === 'sent' ? '#2D8540'
                : selected.length > 0 && sendState === 'idle' ? 'var(--gold)'
                : 'var(--border)',
              color: sendState === 'sent' || (selected.length > 0 && sendState === 'idle') ? 'var(--bg-card)' : '#9C9890',
              fontSize: 14, fontWeight: 700,
              cursor: sendState === 'idle' && selected.length > 0 ? 'pointer' : 'default',
              minHeight: 60,
              transition: 'background 0.2s ease',
            }}
          >
            {sendState === 'sent'
              ? '\u2713 Solicitud enviada'
              : sendState === 'sending'
              ? 'Enviando...'
              : `Enviar solicitud (${selected.length} ${selected.length === 1 ? 'documento' : 'documentos'}) \u2192`}
          </button>
        </div>
      </div>
    </>
  )
}
