'use client'

/**
 * V1 Polish Pack · Block 5 — Supplier document request composer.
 *
 * Replaces the "Disponible próximamente" stub on AccionesRapidasPanel.
 * Three-step modal:
 *   1. Check which missing docs to request (pre-checked from Block 10)
 *   2. Review/edit Spanish email (subject + recipient + body)
 *   3. Send → POST /api/solicitations/send
 *
 * On send the endpoint:
 *   - Inserts one documento_solicitudes row per doc type (tenant-scoped)
 *   - Emits a `docs.solicitation_sent` workflow_events row with the
 *     missing_document_types array (upstream of the bug fixed earlier —
 *     processor now gets a populated array)
 *   - Sends the email via Resend from sistema@renatozapata.com
 *   - Logs to operational_decisions via decision-logger
 *
 * Design: dark glass card matching ClientHome. 60px CTA, JetBrains Mono
 * for the tráfico id, Spanish es-MX throughout.
 */

import { useMemo, useState } from 'react'
import { X, Send, Loader2, Check, Mail } from 'lucide-react'
import {
  ACCENT_CYAN,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GOLD,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'
import { labelForDocType, type DocType } from '@/lib/doc-requirements'

interface SolicitarDocsModalProps {
  traficoId: string
  cliente: string
  proveedor?: string | null
  missingDocs: DocType[]
  operatorName: string
  onClose: () => void
}

interface SendResponse {
  data: { solicitationId: string; sent: number } | null
  error: { code: string; message: string } | null
}

function buildEmailBody(params: {
  proveedor: string
  traficoId: string
  cliente: string
  docs: DocType[]
  operatorName: string
}): string {
  const { proveedor, traficoId, cliente, docs, operatorName } = params
  const lines = docs.map((d) => `  • ${labelForDocType(d)}`).join('\n')
  return (
    `Estimado/a ${proveedor || 'proveedor'},\n\n` +
    `Le escribo en relación al tráfico ${traficoId} del cliente ${cliente}.\n\n` +
    `Para completar el expediente, necesitamos los siguientes documentos:\n${lines}\n\n` +
    `Le agradecemos su envío a la brevedad.\n\n` +
    `Saludos cordiales,\n${operatorName}\n` +
    `Renato Zapata & Company\n` +
    `Patente 3596 · Aduana 240 Nuevo Laredo`
  )
}

function buildSubject(traficoId: string, cliente: string): string {
  return `Solicitud de documentos — Tráfico ${traficoId} · ${cliente}`
}

export function SolicitarDocsModal({
  traficoId,
  cliente,
  proveedor,
  missingDocs,
  operatorName,
  onClose,
}: SolicitarDocsModalProps) {
  const { toast } = useToast()
  const track = useTrack()

  const [selected, setSelected] = useState<Set<DocType>>(() => new Set(missingDocs))
  const [recipientEmail, setRecipientEmail] = useState('')
  const [subject, setSubject] = useState(() => buildSubject(traficoId, cliente))
  const [body, setBody] = useState(() =>
    buildEmailBody({
      proveedor: proveedor ?? '',
      traficoId,
      cliente,
      docs: missingDocs,
      operatorName,
    }),
  )
  const [sending, setSending] = useState(false)

  const selectedList = useMemo(() => Array.from(selected), [selected])

  function toggleDoc(doc: DocType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(doc)) next.delete(doc)
      else next.add(doc)
      return next
    })
    // Re-derive body from current selection so the operator's edits to
    // subject/recipient are preserved but the list stays in sync.
    const nextDocs = (() => {
      const n = new Set(selected)
      if (n.has(doc)) n.delete(doc)
      else n.add(doc)
      return Array.from(n)
    })()
    setBody(
      buildEmailBody({
        proveedor: proveedor ?? '',
        traficoId,
        cliente,
        docs: nextDocs,
        operatorName,
      }),
    )
  }

  async function handleSend() {
    const emailTrim = recipientEmail.trim()
    if (!emailTrim) {
      toast('Ingresa un correo del proveedor', 'error')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast('Correo inválido', 'error')
      return
    }
    if (selectedList.length === 0) {
      toast('Selecciona al menos un documento', 'error')
      return
    }
    if (!subject.trim() || !body.trim()) {
      toast('Asunto y cuerpo del correo son requeridos', 'error')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/solicitations/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          traficoId,
          docTypes: selectedList,
          recipientEmail: emailTrim,
          recipientName: proveedor ?? '',
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      const json = (await res.json().catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[SolicitarDocsModal] bad JSON', err)
        }
        return null
      })) as SendResponse | null

      if (!res.ok || !json?.data) {
        const msg = json?.error?.message ?? 'No se pudo enviar la solicitud'
        toast(msg, 'error')
        return
      }

      track('solicitation_sent', {
        entityType: 'trafico',
        entityId: traficoId,
        metadata: {
          doc_count: selectedList.length,
          solicitation_id: json.data.solicitationId,
          recipient: emailTrim,
        },
      })
      toast(`Solicitud enviada a ${emailTrim}`, 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al enviar', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Solicitar documentos al proveedor"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,5,8,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '20px 22px',
          boxShadow: GLASS_SHADOW,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={18} style={{ color: ACCENT_CYAN }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>
                Solicitar documentos
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
                Tráfico {traficoId} · {cliente}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Cerrar"
            style={{
              all: 'unset',
              cursor: sending ? 'not-allowed' : 'pointer',
              padding: 10,
              minWidth: 60,
              minHeight: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: TEXT_MUTED,
              borderRadius: 12,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1 — checklist */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Documentos a solicitar ({selectedList.length} / {missingDocs.length})
          </div>
          {missingDocs.length === 0 ? (
            <div style={{ fontSize: 13, color: TEXT_MUTED, padding: '12px 0' }}>
              No hay documentos faltantes según el régimen configurado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {missingDocs.map((doc, i) => {
                const checked = selected.has(doc)
                return (
                  <label
                    key={doc}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 60,
                      padding: '0 4px',
                      borderBottom: i < missingDocs.length - 1 ? `1px solid ${BORDER}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDoc(doc)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: ACCENT_CYAN,
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{labelForDocType(doc)}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Step 2 — recipient / subject / body */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="sol-recipient" style={labelStyle}>
            Correo del proveedor
          </label>
          <input
            id="sol-recipient"
            type="email"
            autoComplete="email"
            placeholder="proveedor@ejemplo.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="sol-subject" style={labelStyle}>
            Asunto
          </label>
          <input
            id="sol-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label htmlFor="sol-body" style={labelStyle}>
            Mensaje
          </label>
          <textarea
            id="sol-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Step 3 — send */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>
            Remitente: <span style={{ color: TEXT_SECONDARY }}>sistema@renatozapata.com</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                minHeight: 60,
                minWidth: 100,
                padding: '0 18px',
                background: 'transparent',
                color: TEXT_SECONDARY,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selectedList.length === 0}
              style={{
                minHeight: 60,
                minWidth: 140,
                padding: '0 20px',
                background: sending || selectedList.length === 0 ? 'rgba(234,179,8,0.35)' : GOLD,
                color: '#0B1220',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: sending || selectedList.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                letterSpacing: '0.02em',
              }}
            >
              {sending ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Enviando…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>

        {/* WCAG note: warn on empty docs */}
        {missingDocs.length === 0 && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              color: TEXT_SECONDARY,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Check size={14} style={{ color: ACCENT_CYAN }} />
            Expediente completo — nada que solicitar ahora mismo.
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: TEXT_MUTED,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 60,
  padding: '10px 14px',
  background: 'rgba(0,0,0,0.3)',
  color: TEXT_PRIMARY,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

// Silence lint: RED is only re-exported for callers that want the palette.
void RED
