'use client'

/**
 * Block 4 · Supplier Doc Solicitation Polish — SolicitarDocsModal (rewrite).
 *
 * Extends the V1-Polish Block 5 modal with:
 *   - 50-entry catalog grouping from `src/lib/document-types.ts`
 *   - Collapsible category sections with per-category counts
 *   - "Seleccionar requeridos" quick-button
 *   - "Otro (especificar)" custom row with inline name + desc inputs
 *   - Accepts both legacy DocType[] and catalog codes via `mapLegacyDocType`
 *
 * Design: dark glass card, cinematic system. 60px CTA, es-MX.
 * Brand stays "Portal" — ZAPATA AI only appears on the outbound supplier email.
 */

import { useMemo, useState } from 'react'
import { X, Send, Loader2, Check, Mail, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  ACCENT_SILVER,
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
import type { DocType } from '@/lib/doc-requirements'
import {
  DOCUMENT_TYPE_CATEGORIES,
  getDocumentTypeByCode,
  labelForDocCode,
  mapLegacyDocType,
  type DocCategory,
  type DocTypeEntry,
} from '@/lib/document-types'

const CATEGORY_LABELS: Record<DocCategory, string> = {
  COMERCIAL: 'Comercial',
  TRANSPORTE: 'Transporte',
  ORIGEN: 'Origen',
  REGULATORIO: 'Regulatorio',
  TECNICO: 'Técnico',
  FISCAL: 'Fiscal',
  ADUANAL: 'Aduanal',
  FINANCIERO: 'Financiero',
  OTROS: 'Otros',
}
const CATEGORY_ORDER: DocCategory[] = [
  'COMERCIAL',
  'TRANSPORTE',
  'ORIGEN',
  'REGULATORIO',
  'TECNICO',
  'FISCAL',
  'ADUANAL',
  'FINANCIERO',
  'OTROS',
]

interface SolicitarDocsModalProps {
  traficoId: string
  cliente: string
  proveedor?: string | null
  /**
   * Accepts legacy DocType[] or catalog codes. Either way, rows are
   * pre-checked in the modal.
   */
  missingDocs: Array<DocType | string>
  operatorName: string
  onClose: () => void
}

interface CustomDoc {
  custom_name: string
  custom_desc: string
}

interface SendResponse {
  data: { solicitationId: string; sent: number } | null
  error: { code: string; message: string } | null
}

function normalizeToCatalog(docs: Array<DocType | string>): string[] {
  return Array.from(new Set(docs.map((d) => mapLegacyDocType(d))))
}

function buildEmailBody(params: {
  proveedor: string
  traficoId: string
  cliente: string
  codes: string[]
  customs: CustomDoc[]
  operatorName: string
}): string {
  const { proveedor, traficoId, cliente, codes, customs, operatorName } = params
  const lines: string[] = []
  for (const c of codes) lines.push(`  • ${labelForDocCode(c)}`)
  for (const c of customs) {
    if (c.custom_name.trim()) lines.push(`  • ${c.custom_name.trim()}`)
  }
  return (
    `Estimado/a ${proveedor || 'proveedor'},\n\n` +
    `En representación de ${cliente}, solicitamos los siguientes documentos ` +
    `para completar el despacho aduanero del embarque ${traficoId}:\n\n` +
    `${lines.join('\n')}\n\n` +
    `Puede cargar los documentos directamente en el enlace que le compartimos por correo.\n\n` +
    `Gracias por su apoyo.\n\n` +
    `Atentamente,\n${operatorName}\n` +
    `Renato Zapata & Co. · Patente 3596`
  )
}

function buildSubject(traficoId: string, cliente: string): string {
  return `Documentos requeridos · ${cliente} · Embarque ${traficoId}`
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

  const initialCodes = useMemo(() => normalizeToCatalog(missingDocs), [missingDocs])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialCodes))
  const [expanded, setExpanded] = useState<Record<DocCategory, boolean>>(() => ({
    COMERCIAL: true,
    TRANSPORTE: true,
    ORIGEN: true,
    REGULATORIO: true,
    TECNICO: true,
    FISCAL: true,
    ADUANAL: true,
    FINANCIERO: true,
    OTROS: true,
  }))
  const [otroEnabled, setOtroEnabled] = useState(false)
  const [customs, setCustoms] = useState<CustomDoc[]>([{ custom_name: '', custom_desc: '' }])
  const [recipientEmail, setRecipientEmail] = useState('')
  const [subject, setSubject] = useState(() => buildSubject(traficoId, cliente))
  const [body, setBody] = useState(() =>
    buildEmailBody({
      proveedor: proveedor ?? '',
      traficoId,
      cliente,
      codes: initialCodes,
      customs: [],
      operatorName,
    }),
  )
  const [sending, setSending] = useState(false)

  const selectedList = useMemo(() => Array.from(selected), [selected])
  const validCustoms = useMemo(
    () => customs.filter((c) => c.custom_name.trim().length > 0),
    [customs],
  )

  function refreshBody(nextCodes: string[], nextCustoms: CustomDoc[]) {
    setBody(
      buildEmailBody({
        proveedor: proveedor ?? '',
        traficoId,
        cliente,
        codes: nextCodes,
        customs: nextCustoms,
        operatorName,
      }),
    )
  }

  function toggleDoc(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      const on = !next.has(code)
      if (on) next.add(code)
      else next.delete(code)
      refreshBody(Array.from(next), validCustoms)
      const entry = getDocumentTypeByCode(code)
      track('checklist_item_viewed', {
        entityType: 'doc_type',
        entityId: code,
        metadata: {
          event: on ? 'doc_solicitation_doc_selected' : 'doc_solicitation_doc_deselected',
          doc_code: code,
          category: entry?.category,
        },
      })
      return next
    })
  }

  function toggleCategory(cat: DocCategory) {
    setExpanded((prev) => {
      const next = { ...prev, [cat]: !prev[cat] }
      if (next[cat]) {
        track('checklist_item_viewed', {
          entityType: 'doc_category',
          entityId: cat,
          metadata: {
            event: 'doc_solicitation_category_expanded',
            category: cat,
            doc_count: DOCUMENT_TYPE_CATEGORIES[cat].length,
          },
        })
      }
      return next
    })
  }

  function selectAllRequired() {
    const required = new Set<string>()
    for (const cat of CATEGORY_ORDER) {
      for (const entry of DOCUMENT_TYPE_CATEGORIES[cat]) {
        if (entry.required) required.add(entry.code)
      }
    }
    setSelected(required)
    refreshBody(Array.from(required), validCustoms)
  }

  function updateCustom(i: number, patch: Partial<CustomDoc>) {
    setCustoms((prev) => {
      const next = prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
      refreshBody(
        selectedList,
        next.filter((c) => c.custom_name.trim().length > 0),
      )
      return next
    })
  }

  function addCustomRow() {
    setCustoms((prev) => [...prev, { custom_name: '', custom_desc: '' }])
  }

  function handleOtroToggle() {
    setOtroEnabled((prev) => {
      const next = !prev
      if (next && customs.length === 0) {
        setCustoms([{ custom_name: '', custom_desc: '' }])
      }
      if (next) {
        track('checklist_item_viewed', {
          entityType: 'doc_type',
          entityId: 'otro',
          metadata: { event: 'doc_solicitation_otro_added' },
        })
      }
      return next
    })
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
    if (selectedList.length === 0 && validCustoms.length === 0) {
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
          customDocs: validCustoms,
          recipientEmail: emailTrim,
          recipientName: proveedor ?? '',
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      const json = (await res.json().catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
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
          event: 'doc_solicitation_sent',
          doc_count: selectedList.length,
          custom_count: validCustoms.length,
          solicitation_id: json.data.solicitationId,
          recipient_domain: emailTrim.split('@')[1] ?? null,
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

  // Fire modal-open event once on mount via useMemo trick
  useMemo(() => {
    track('checklist_item_viewed', {
      entityType: 'trafico',
      entityId: traficoId,
      metadata: { event: 'doc_solicitation_opened' },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSelected = selectedList.length + validCustoms.length

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
          maxWidth: 680,
          maxHeight: '92vh',
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
            <Mail size={18} style={{ color: ACCENT_SILVER }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>
                Solicitar documentos
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
                Embarque {traficoId} · {cliente}
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

        {/* Quick-select required */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={selectAllRequired}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '10px 14px',
              minHeight: 44,
              fontSize: 12,
              fontWeight: 700,
              color: GOLD,
              border: `1px solid ${GOLD}`,
              borderRadius: 12,
              letterSpacing: '0.02em',
            }}
          >
            Seleccionar requeridos
          </button>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: TEXT_MUTED }}>
            {totalSelected} seleccionado{totalSelected === 1 ? '' : 's'}
          </div>
        </div>

        {/* Category sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {CATEGORY_ORDER.map((cat) => (
            <CategorySection
              key={cat}
              cat={cat}
              entries={DOCUMENT_TYPE_CATEGORIES[cat]}
              selected={selected}
              expanded={expanded[cat]}
              onToggleCategory={() => toggleCategory(cat)}
              onToggleDoc={toggleDoc}
            />
          ))}
        </div>

        {/* Otro (especificar) */}
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={otroEnabled}
              onChange={handleOtroToggle}
              style={{ width: 18, height: 18, accentColor: ACCENT_SILVER, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>
              Otro (especificar)
            </span>
          </label>
          {otroEnabled && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customs.map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Nombre del documento"
                    value={c.custom_name}
                    onChange={(e) => updateCustom(i, { custom_name: e.target.value })}
                    style={inputStyle}
                    aria-label={`Nombre del documento personalizado ${i + 1}`}
                  />
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={c.custom_desc}
                    onChange={(e) => updateCustom(i, { custom_desc: e.target.value })}
                    style={inputStyle}
                    aria-label={`Descripción del documento personalizado ${i + 1}`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addCustomRow}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: ACCENT_SILVER,
                  padding: 8,
                }}
              >
                <Plus size={14} /> Agregar otro
              </button>
            </div>
          )}
        </div>

        {/* Recipient / subject / body */}
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

        {/* Summary card */}
        <SummaryCard selected={selected} customsCount={validCustoms.length} />

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>
            Remitente: <span style={{ color: TEXT_SECONDARY }}>ai@renatozapata.com</span>
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
              disabled={sending || totalSelected === 0}
              style={{
                minHeight: 60,
                minWidth: 140,
                padding: '0 20px',
                background: sending || totalSelected === 0 ? 'rgba(192,197,206,0.35)' : GOLD,
                color: '#0B1220',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: sending || totalSelected === 0 ? 'not-allowed' : 'pointer',
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

        {totalSelected === 0 && (
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
            <Check size={14} style={{ color: ACCENT_SILVER }} />
            Selecciona al menos un documento para enviar la solicitud.
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

function CategorySection({
  cat,
  entries,
  selected,
  expanded,
  onToggleCategory,
  onToggleDoc,
}: {
  cat: DocCategory
  entries: DocTypeEntry[]
  selected: Set<string>
  expanded: boolean
  onToggleCategory: () => void
  onToggleDoc: (code: string) => void
}) {
  const countSel = entries.filter((e) => selected.has(e.code)).length
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggleCategory}
        aria-expanded={expanded}
        style={{
          all: 'unset',
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 14px',
          minHeight: 48,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expanded ? <ChevronDown size={16} color={TEXT_MUTED} /> : <ChevronRight size={16} color={TEXT_MUTED} />}
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: TEXT_PRIMARY,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {CATEGORY_LABELS[cat]} ({entries.length})
          </span>
        </div>
        {countSel > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: ACCENT_SILVER,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {countSel}
          </span>
        )}
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {entries.map((entry, i) => {
            const checked = selected.has(entry.code)
            return (
              <label
                key={entry.code}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  minHeight: 60,
                  padding: '10px 14px',
                  borderBottom: i < entries.length - 1 ? `1px solid ${BORDER}` : 'none',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleDoc(entry.code)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: ACCENT_SILVER,
                    cursor: 'pointer',
                    marginTop: 2,
                  }}
                  aria-label={entry.name_es}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>
                      {entry.name_es}
                    </span>
                    {entry.required && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#0B1220',
                          background: GOLD,
                          borderRadius: 999,
                          padding: '2px 8px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Requerido
                      </span>
                    )}
                  </div>
                  {entry.desc && (
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                      {entry.desc}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ selected, customsCount }: { selected: Set<string>; customsCount: number }) {
  const perCategory: Record<string, number> = {}
  for (const code of selected) {
    const entry = getDocumentTypeByCode(code)
    const cat = entry?.category ?? 'OTROS'
    perCategory[cat] = (perCategory[cat] ?? 0) + 1
  }
  const rows = Object.entries(perCategory)
  const total = selected.size + customsCount
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        Resumen ({total} documento{total === 1 ? '' : 's'})
      </div>
      {rows.length === 0 && customsCount === 0 ? (
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>Nada seleccionado aún.</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {rows.map(([cat, count]) => (
            <span
              key={cat}
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {CATEGORY_LABELS[cat as DocCategory]}: <strong style={{ color: TEXT_PRIMARY }}>{count}</strong>
            </span>
          ))}
          {customsCount > 0 && (
            <span style={{ fontSize: 11, color: ACCENT_SILVER, fontFamily: 'var(--font-mono)' }}>
              Otros: <strong>{customsCount}</strong>
            </span>
          )}
        </div>
      )}
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
  minHeight: 44,
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
