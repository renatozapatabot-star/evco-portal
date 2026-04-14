'use client'

/**
 * AGUILA · V1.5 F7 — Clientes dormidos client UI.
 *
 * Silver glass table with threshold input (7–60, default 14). Every row can
 * open a modal with the generated Spanish follow-up message + copy button.
 * No gold, no cyan — es-MX + mono on numerics.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'
import type { DormantClienteRecord } from '@/lib/dormant/detect'

const MONO = 'var(--font-mono)'

function formatMoney(amount: number | null, currency: 'MXN' | 'USD' | null): string {
  if (amount == null) return '—'
  const c = currency ?? 'MXN'
  return `${new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: 0,
  }).format(amount)}${c === 'MXN' ? ' MXN' : ' USD'}`
}

interface ModalState {
  cliente: DormantClienteRecord
  subject: string
  message: string
}

export function ClientesDormidosClient({
  initial,
  initialThreshold,
}: {
  initial: DormantClienteRecord[]
  initialThreshold: number
}) {
  const [rows, setRows] = useState<DormantClienteRecord[]>(initial)
  const [threshold, setThreshold] = useState<number>(initialThreshold)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchRows = useCallback(async (t: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clientes/dormidos?threshold=${t}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.error) throw new Error(json?.error?.message ?? 'Error cargando lista')
      setRows((json.data?.dormant ?? []) as DormantClienteRecord[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando lista')
    } finally {
      setLoading(false)
    }
  }, [])

  const onThresholdChange = (raw: number) => {
    const clamped = Math.min(60, Math.max(7, Math.floor(Number.isFinite(raw) ? raw : 14)))
    setThreshold(clamped)
  }

  const onGenerate = async (cliente: DormantClienteRecord) => {
    setBusyId(cliente.clienteId)
    setError(null)
    try {
      const res = await fetch('/api/clientes/dormidos/mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: cliente.clienteId, thresholdDays: threshold }),
      })
      const json = await res.json()
      if (!res.ok || json?.error) throw new Error(json?.error?.message ?? 'Error generando mensaje')
      setModal({ cliente, subject: json.data.subject, message: json.data.message })
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generando mensaje')
    } finally {
      setBusyId(null)
    }
  }

  const onCopy = async () => {
    if (!modal) return
    try {
      await navigator.clipboard.writeText(modal.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  // Close modal on Escape.
  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Threshold control */}
      <div
        style={{
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER_HAIRLINE}`,
          borderRadius: 20,
          padding: 20,
          boxShadow: GLASS_SHADOW,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 13, color: TEXT_SECONDARY, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Umbral (días sin movimiento)</span>
          <input
            type="number"
            min={7}
            max={60}
            value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: '10px 12px',
              color: TEXT_PRIMARY,
              fontFamily: MONO,
              fontSize: 14,
              width: 120,
              minHeight: 44,
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => fetchRows(threshold)}
          disabled={loading}
          style={{
            minHeight: 44,
            minWidth: 160,
            padding: '0 20px',
            background: 'rgba(192,197,206,0.12)',
            border: `1px solid ${ACCENT_SILVER_DIM}`,
            borderRadius: 12,
            color: ACCENT_SILVER_BRIGHT,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 14,
          }}
        >
          {loading ? 'Cargando…' : 'Aplicar umbral'}
        </button>
        <span style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: MONO }}>
          {rows.length} de 50 máx · rango 7–60 días
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.32)',
            borderRadius: 12,
            padding: 12,
            color: '#FCA5A5',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Table / empty */}
      <div
        style={{
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER_HAIRLINE}`,
          borderRadius: 20,
          boxShadow: GLASS_SHADOW,
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              aria-hidden
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: BG_DEEP,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              A
            </div>
            <div style={{ fontSize: 16, color: TEXT_PRIMARY, fontWeight: 600 }}>
              Todos los clientes activos. Volar alto.
            </div>
            <div style={{ fontSize: 13, color: TEXT_MUTED }}>
              Ningún cliente supera el umbral de {threshold} días.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}` }}>Cliente</th>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}` }}>RFC</th>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, textAlign: 'right' }}>Días</th>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}` }}>Última actividad</th>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, textAlign: 'right' }}>Última factura</th>
                  <th style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}` }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.clienteId} style={{ color: TEXT_PRIMARY }}>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}` }}>{r.clienteName}</td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, fontFamily: MONO, color: TEXT_SECONDARY }}>
                      {r.rfc ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, fontFamily: MONO, textAlign: 'right' }}>
                      {r.diasSinMovimiento}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, fontFamily: MONO, color: TEXT_SECONDARY }}>
                      {r.lastActivityAt ? fmtDate(r.lastActivityAt) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, fontFamily: MONO, textAlign: 'right' }}>
                      {formatMoney(r.lastInvoiceAmount, r.lastInvoiceCurrency)}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER_HAIRLINE}`, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onGenerate(r)}
                        disabled={busyId === r.clienteId}
                        style={{
                          minHeight: 44,
                          padding: '0 16px',
                          background: 'rgba(192,197,206,0.12)',
                          border: `1px solid ${ACCENT_SILVER_DIM}`,
                          borderRadius: 10,
                          color: ACCENT_SILVER,
                          fontWeight: 600,
                          cursor: busyId === r.clienteId ? 'wait' : 'pointer',
                          fontSize: 13,
                        }}
                      >
                        {busyId === r.clienteId ? 'Generando…' : 'Generar mensaje'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mensaje de seguimiento"
          onClick={() => setModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,7,11,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255,255,255,0.045)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${BORDER_HAIRLINE}`,
              borderRadius: 20,
              boxShadow: GLASS_SHADOW,
              maxWidth: 720,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Asunto
                </div>
                <div style={{ fontSize: 15, color: TEXT_PRIMARY, fontWeight: 600, marginTop: 4 }}>
                  {modal.subject}
                </div>
                <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 6, fontFamily: MONO }}>
                  {modal.cliente.clienteName} · {modal.cliente.diasSinMovimiento} días
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Cerrar"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  background: 'transparent',
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  borderRadius: 10,
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BORDER_HAIRLINE}`,
                borderRadius: 12,
                padding: 16,
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 14,
                color: TEXT_PRIMARY,
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {modal.message}
            </pre>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setModal(null)}
                style={{
                  minHeight: 44,
                  padding: '0 18px',
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onCopy}
                style={{
                  minHeight: 44,
                  padding: '0 18px',
                  background: 'rgba(192,197,206,0.18)',
                  border: `1px solid ${ACCENT_SILVER}`,
                  borderRadius: 10,
                  color: ACCENT_SILVER_BRIGHT,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {copied ? 'Copiado ✓' : 'Copiar al portapapeles'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
