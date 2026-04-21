'use client'

/**
 * CRUZ · V1.5 F2 — QuickBooks export client UI.
 *
 * Silver glass form + recent exports table. No blue/cyan/gold. Mono on amounts
 * and timestamps. es-MX copy.
 */

import { useState } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  SILVER_GRADIENT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { AguilaInput, AguilaSelect, GlassCard } from '@/components/aguila'

interface ExportRow {
  id: string
  entity: string
  format: string
  status: string
  date_from: string | null
  date_to: string | null
  file_bytes: number | null
  row_count: number | null
  error: string | null
  created_at: string
  completed_at: string | null
}

const ENTITY_LABELS: Record<string, string> = {
  invoices: 'Facturas',
  bills: 'Cuentas por pagar',
  customers: 'Clientes',
  vendors: 'Proveedores',
  all: 'Todo',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  running: 'Generando',
  ready: 'Lista',
  failed: 'Falló',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function statusColor(status: string): string {
  if (status === 'ready') return 'var(--portal-status-green-fg)'
  if (status === 'failed') return 'var(--portal-status-red-fg)'
  if (status === 'running') return ACCENT_SILVER_BRIGHT
  return ACCENT_SILVER_DIM
}

export function QuickBooksExportClient({ recent }: { recent: ExportRow[] }) {
  const [entity, setEntity] = useState<string>('invoices')
  const [format, setFormat] = useState<string>('IIF')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rows, setRows] = useState<ExportRow[]>(recent)

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/quickbooks/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity,
          format,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      })
      const body = await res.json()
      if (body.error) {
        setMessage(`Error: ${body.error.message}`)
      } else {
        setMessage('Exportación en curso. Recarga la lista en unos segundos.')
        // Optimistic prepend — the page will show the real row on next load.
        const now = new Date().toISOString()
        setRows(prev => [{
          id: body.data?.id ?? 'pending',
          entity,
          format,
          status: body.data?.status ?? 'running',
          date_from: dateFrom || null,
          date_to: dateTo || null,
          file_bytes: body.data?.file_bytes ?? null,
          row_count: body.data?.row_count ?? null,
          error: body.data?.error ?? null,
          created_at: now,
          completed_at: body.data?.status === 'ready' ? now : null,
        }, ...prev].slice(0, 20))
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'falla de red'}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(id: string) {
    try {
      const res = await fetch(`/api/quickbooks/export/${id}`)
      const body = await res.json()
      if (body.data?.downloadUrl) {
        window.open(body.data.downloadUrl, '_blank')
      } else {
        setMessage('La descarga no está lista todavía.')
      }
    } catch {
      setMessage('No se pudo obtener la descarga.')
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${BORDER_HAIRLINE}`,
    borderRadius: 12,
    color: TEXT_PRIMARY,
    padding: '10px 12px',
    fontFamily: 'var(--font-geist-sans)',
    fontSize: 'var(--aguila-fs-section)',
    minHeight: 44,
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--aguila-fs-meta)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: TEXT_MUTED,
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto', color: TEXT_PRIMARY }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0,
        }}>
          Exportar a QuickBooks
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_SECONDARY, marginTop: 6, marginBottom: 0 }}>
          Genera un archivo <code style={{ fontFamily: 'var(--font-jetbrains-mono)', color: ACCENT_SILVER_BRIGHT }}>.IIF</code> para importar en QuickBooks Desktop.
        </p>
      </header>

      <GlassCard
        tier="hero"
        padding="12px 16px"
        ariaLabel="Nota informativa"
        style={{
          marginBottom: 20,
          color: TEXT_SECONDARY,
          fontSize: 'var(--aguila-fs-body)',
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Fase 1: importación manual. API directa pendiente certificación Intuit.
      </GlassCard>

      {/* Form card */}
      <GlassCard tier="hero" padding={24} style={{ marginBottom: 24 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}>
          <AguilaSelect
            id="entity"
            label="Entidad"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            options={[
              { value: 'invoices', label: 'Facturas' },
              { value: 'bills', label: 'Cuentas por pagar' },
              { value: 'customers', label: 'Clientes' },
              { value: 'vendors', label: 'Proveedores' },
              { value: 'all', label: 'Todo' },
            ]}
          />
          <AguilaSelect
            id="format"
            label="Formato"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            options={[
              { value: 'IIF', label: 'IIF (QuickBooks Desktop)' },
              { value: 'CSV', label: 'CSV' },
            ]}
          />
          <AguilaInput
            id="dateFrom"
            label="Desde"
            type="date"
            mono
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <AguilaInput
            id="dateTo"
            label="Hasta"
            type="date"
            mono
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: SILVER_GRADIENT,
            color: 'var(--portal-ink-0)',
            border: 'none',
            borderRadius: 12,
            padding: '14px 24px',
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            minHeight: 60,
            minWidth: 200,
          }}
        >
          {submitting ? 'Generando…' : 'Generar exportación'}
        </button>

        {message && (
          <p style={{ marginTop: 16, fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY }}>{message}</p>
        )}
      </GlassCard>

      {/* Recent exports */}
      <GlassCard tier="hero" padding={24}>
        <h2 style={{
          fontSize: 'var(--aguila-fs-body-lg)',
          fontWeight: 700,
          margin: '0 0 16px 0',
          color: TEXT_PRIMARY,
        }}>
          Exportaciones recientes
        </h2>

        {rows.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: TEXT_MUTED,
            fontSize: 'var(--aguila-fs-section)',
          }}>
            <div style={{ marginBottom: 8, color: ACCENT_SILVER_DIM }}>Sin exportaciones todavía</div>
            <div style={{ fontSize: 'var(--aguila-fs-body)' }}>Genera la primera con el formulario de arriba.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Rango</th>
                  <th style={thStyle}>Entidad</th>
                  <th style={thStyle}>Formato</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Tamaño</th>
                  <th style={thStyle}>Filas</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${BORDER_HAIRLINE}` }}>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains-mono)', color: TEXT_SECONDARY }}>
                      {r.date_from || '—'} → {r.date_to || '—'}
                    </td>
                    <td style={tdStyle}>{ENTITY_LABELS[r.entity] ?? r.entity}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains-mono)' }}>{r.format}</td>
                    <td style={{ ...tdStyle, color: statusColor(r.status), fontWeight: 600 }}>
                      {STATUS_LABELS[r.status] ?? r.status}
                      {r.error === 'bucket_missing' && (
                        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2 }}>
                          Bucket sin provisionar
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains-mono)' }}>{formatBytes(r.file_bytes)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains-mono)' }}>{r.row_count ?? '—'}</td>
                    <td style={tdStyle}>
                      {r.status === 'ready' ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(r.id)}
                          style={{
                            background: 'transparent',
                            color: ACCENT_SILVER_BRIGHT,
                            border: `1px solid ${ACCENT_SILVER}`,
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 'var(--aguila-fs-compact)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: 44,
                          }}
                        >
                          Descargar
                        </button>
                      ) : (
                        <span style={{ color: TEXT_MUTED }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 'var(--aguila-fs-meta)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: TEXT_MUTED,
}

const tdStyle: React.CSSProperties = {
  padding: '12px',
  color: TEXT_PRIMARY,
  verticalAlign: 'top',
}
