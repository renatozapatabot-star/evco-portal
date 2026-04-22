'use client'

// V2 Doc Intelligence · Phase 3 — Document Inbox client surface.
//
// Unified view of the unassigned invoice queue with the AI's
// suggested doc_type rendered inline. Two bulk actions:
//   · Aceptar tipo — confirm the suggestion at high confidence; a
//                    document_classifications row is written with
//                    model='user_confirmed' and the invoice stays
//                    unassigned (so the user can still route it).
//   · Archivar     — soft-discard; status → archived.
//
// es-MX, JetBrains Mono on invoice numbers + amounts, 60px touch
// targets, empty state with icon + message + action. No compliance
// anxiety: posible duplicado rendered silver, never red.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BORDER_SILVER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from '@/lib/design-system'
import { GlassCard } from '@/components/aguila'
import type { SmartDocType } from '@/lib/docs/classify'

const MONO = 'var(--font-jetbrains-mono), JetBrains Mono, monospace'
const SANS = 'var(--font-geist-sans), Inter, system-ui, sans-serif'

interface Props {
  companyId: string
  role: string
}

interface InboxRow {
  id: string
  invoice_number: string | null
  supplier_name: string | null
  supplier_rfc: string | null
  amount: number | null
  currency: string | null
  received_at: string | null
  file_url: string | null
  status: string
  suggested_type: string | null
  suggested_confidence: number | null
  suggested_source: string | null
  classification_id: string | null
  has_potential_duplicate: boolean
}

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: 'Factura',
  factura: 'Factura',
  packing_list: 'Lista de empaque',
  bol: 'BL / AWB',
  bl: 'BL',
  awb: 'AWB',
  certificate_of_origin: 'Certificado de origen',
  certificado_origen: 'Certificado de origen',
  carta_porte: 'Carta porte',
  pedimento: 'Pedimento',
  rfc: 'RFC / Constancia',
  rfc_constancia: 'RFC / Constancia',
  nom: 'NOM',
  other: 'Otro',
}

function labelForType(t: string | null): string {
  if (!t) return 'Sin clasificar'
  return DOC_TYPE_LABEL[t] ?? t
}

function fmtAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return '—'
  const s = amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${s} ${currency}` : s
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtConfidence(c: number | null): string {
  if (c == null) return ''
  return `${Math.round(c * 100)}%`
}

export function BandejaDocumentosClient(_props: Props) {
  const [rows, setRows] = useState<InboxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/inbox?limit=100', { cache: 'no-store' })
      const j = await r.json()
      if (j?.data?.rows) setRows(j.data.rows as InboxRow[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(rows.map((r) => r.id)))
  }, [rows])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const runAction = useCallback(
    async (action: 'accept_type' | 'archive', smartType?: SmartDocType) => {
      const ids = Array.from(selected)
      if (ids.length === 0) return
      setBusy(true)
      try {
        const r = await fetch('/api/inbox/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action, smartType }),
        })
        const j = await r.json()
        if (j?.error) {
          setToast(`Error: ${j.error.message}`)
          return
        }
        const summary =
          action === 'archive'
            ? `${j.data.archived} archivada${j.data.archived === 1 ? '' : 's'}`
            : `${j.data.accepted} tipo${j.data.accepted === 1 ? '' : 's'} confirmado${j.data.accepted === 1 ? '' : 's'}`
        setToast(summary)
        setSelected(new Set())
        void load()
      } finally {
        setBusy(false)
      }
    },
    [selected, load],
  )

  useEffect(() => {
    if (!toast) return
    const h = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(h)
  }, [toast])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 600, color: ACCENT_SILVER_BRIGHT, letterSpacing: '-0.01em', margin: 0 }}>
            Bandeja de documentos
          </h1>
          <p style={{ color: ACCENT_SILVER_DIM, fontSize: 'var(--aguila-fs-section)', margin: '4px 0 0', fontWeight: 500 }}>
            Facturas pendientes de clasificar o asignar · sugerencia del asistente inline
          </p>
        </div>
        <Link
          href="/banco-facturas"
          style={{
            color: ACCENT_SILVER,
            fontSize: 'var(--aguila-fs-body)',
            textDecoration: 'none',
            border: `1px solid ${BORDER_SILVER}`,
            padding: '10px 16px',
            borderRadius: 12,
            minHeight: 44,
          }}
        >
          Ir al banco completo →
        </Link>
      </div>

      <GlassCard tier="hero" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${BORDER_SILVER}`,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={selected.size === rows.length && rows.length > 0 ? clearSelection : selectAll}
              disabled={rows.length === 0}
              style={{
                background: 'transparent',
                color: ACCENT_SILVER,
                border: `1px solid ${BORDER_SILVER}`,
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 'var(--aguila-fs-compact)',
                cursor: rows.length === 0 ? 'default' : 'pointer',
                minHeight: 44,
                minWidth: 44,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {selected.size === rows.length && rows.length > 0 ? 'Limpiar' : 'Seleccionar todo'}
            </button>
            <span style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-compact)' }}>
              {selected.size > 0 ? `${selected.size} de ${rows.length} seleccionadas` : `${rows.length} documentos`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={selected.size === 0 || busy}
              onClick={() => runAction('accept_type', 'factura')}
              style={bulkBtn(selected.size > 0 && !busy)}
            >
              Aceptar como factura
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || busy}
              onClick={() => runAction('archive')}
              style={bulkBtn(selected.size > 0 && !busy)}
            >
              Archivar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-body)' }}>
            Cargando bandeja…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 12, color: ACCENT_SILVER_DIM }}>✓</div>
            <div style={{ color: ACCENT_SILVER_BRIGHT, fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 500, marginBottom: 4 }}>
              Bandeja vacía
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)', marginBottom: 20 }}>
              No hay documentos pendientes de clasificar. Sube facturas nuevas desde el banco.
            </div>
            <Link
              href="/banco-facturas"
              style={{
                display: 'inline-block',
                color: ACCENT_SILVER_BRIGHT,
                background: 'transparent',
                border: `1px solid ${BORDER_SILVER}`,
                padding: '12px 20px',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: 'var(--aguila-fs-body)',
                minHeight: 44,
              }}
            >
              Subir facturas →
            </Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-meta)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', width: 44 }}></th>
                <th style={{ padding: '12px 16px' }}>Folio</th>
                <th style={{ padding: '12px 16px' }}>Proveedor</th>
                <th style={{ padding: '12px 16px' }}>Monto</th>
                <th style={{ padding: '12px 16px' }}>Recibido</th>
                <th style={{ padding: '12px 16px' }}>Sugerencia</th>
                <th style={{ padding: '12px 16px' }}>Señales</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderTop: `1px solid ${BORDER_SILVER}`,
                    color: TEXT_PRIMARY,
                    background: selected.has(r.id) ? 'rgba(192,197,206,0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: ACCENT_SILVER }}
                      aria-label={`Seleccionar ${r.invoice_number ?? r.id}`}
                    />
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                    {r.invoice_number ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: TEXT_SECONDARY }}>
                    {r.supplier_name ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtAmount(r.amount, r.currency)}
                  </td>
                  <td style={{ padding: '14px 16px', color: TEXT_MUTED, fontFamily: MONO, fontSize: 'var(--aguila-fs-compact)' }}>
                    {fmtDate(r.received_at)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 9999,
                        background: 'rgba(192,197,206,0.08)',
                        border: `1px solid ${BORDER_SILVER}`,
                        color: ACCENT_SILVER_BRIGHT,
                        fontSize: 'var(--aguila-fs-meta)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {labelForType(r.suggested_type)}
                      {r.suggested_confidence != null && (
                        <span style={{ color: ACCENT_SILVER_DIM, fontFamily: MONO }}>
                          · {fmtConfidence(r.suggested_confidence)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-compact)' }}>
                    {r.has_potential_duplicate ? 'Posible duplicado' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'rgba(0,0,0,0.85)',
            color: ACCENT_SILVER_BRIGHT,
            border: `1px solid ${BORDER_SILVER}`,
            padding: '12px 20px',
            borderRadius: 10,
            fontSize: 'var(--aguila-fs-body)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function bulkBtn(enabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    color: enabled ? ACCENT_SILVER_BRIGHT : ACCENT_SILVER_DIM,
    border: `1px solid ${BORDER_SILVER}`,
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-compact)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    minHeight: 44,
    minWidth: 44,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    opacity: enabled ? 1 : 0.6,
  }
}
