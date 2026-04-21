'use client'

import { fmtDate } from '@/lib/format-utils'
import type { LlamarDetail } from '@/lib/launchpad-actions'

interface Props {
  detail: LlamarDetail
  onComplete: (actionType: string) => void
  loading: boolean
}

export function LlamarPanel({ detail, onComplete, loading }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Supplier info */}
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-ink-2)' }}>
          {detail.supplier_name || 'Proveedor desconocido'}
        </h3>
        {detail.contact_name && (
          <p style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-5)' }}>
            {detail.contact_name}
          </p>
        )}
      </div>

      {/* Phone tap-to-call */}
      {detail.supplier_phone ? (
        <a
          href={`tel:${detail.supplier_phone}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 60,
            borderRadius: 12,
            border: '2px solid #eab308',
            background: 'rgba(192,197,206,0.08)',
            color: 'var(--portal-ink-2)',
            fontSize: 'var(--aguila-fs-kpi-small)',
            fontWeight: 700,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 22 }}>&#128222;</span>
          <span className="font-mono">{detail.supplier_phone}</span>
        </a>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 60,
            borderRadius: 12,
            border: '1px solid #E8E5E0',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--portal-fg-4)',
            fontSize: 'var(--aguila-fs-section)',
          }}
        >
          Sin teléfono registrado
        </div>
      )}

      {/* Call script */}
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 16,
          border: '1px solid #E8E5E0',
        }}
      >
        <div style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: 'var(--portal-fg-4)', marginBottom: 8, textTransform: 'uppercase' }}>
          Guión
        </div>
        <p style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-ink-2)', fontStyle: 'italic', lineHeight: 1.5 }}>
          &ldquo;{detail.script}&rdquo;
        </p>
      </div>

      {/* Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
        <span>Documento: {detail.doc_label}</span>
        <span>
          Solicitado: <span className="font-mono">{fmtDate(detail.solicitado_at)}</span>
        </span>
      </div>

      {/* Embarque ID */}
      {detail.trafico_id && (
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
          Embarque: <span className="font-mono" style={{ color: 'var(--portal-ink-2)' }}>{detail.trafico_id}</span>
        </div>
      )}

      {/* Complete button */}
      <button
        onClick={() => onComplete('call_done')}
        disabled={loading}
        style={{
          minHeight: 60,
          borderRadius: 12,
          background: 'var(--portal-fg-1)',
          color: 'var(--portal-fg-1)',
          border: 'none',
          fontSize: 'var(--aguila-fs-body-lg)',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          marginTop: 8,
        }}
      >
        &#10003; Llamada hecha
      </button>
    </div>
  )
}
