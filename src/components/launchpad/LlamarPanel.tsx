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
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
          {detail.supplier_name || 'Proveedor desconocido'}
        </h3>
        {detail.contact_name && (
          <p style={{ margin: 0, fontSize: 14, color: '#6B6B6B' }}>
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
            color: '#1A1A1A',
            fontSize: 18,
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
            color: '#9B9B9B',
            fontSize: 14,
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
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9B9B9B', marginBottom: 8, textTransform: 'uppercase' }}>
          Guión
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#1A1A1A', fontStyle: 'italic', lineHeight: 1.5 }}>
          &ldquo;{detail.script}&rdquo;
        </p>
      </div>

      {/* Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9B9B9B' }}>
        <span>Documento: {detail.doc_label}</span>
        <span>
          Solicitado: <span className="font-mono">{fmtDate(detail.solicitado_at)}</span>
        </span>
      </div>

      {/* Embarque ID */}
      {detail.trafico_id && (
        <div style={{ fontSize: 13, color: '#9B9B9B' }}>
          Embarque: <span className="font-mono" style={{ color: '#1A1A1A' }}>{detail.trafico_id}</span>
        </div>
      )}

      {/* Complete button */}
      <button
        onClick={() => onComplete('call_done')}
        disabled={loading}
        style={{
          minHeight: 60,
          borderRadius: 12,
          background: '#E8EAED',
          color: '#FFFFFF',
          border: 'none',
          fontSize: 16,
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
