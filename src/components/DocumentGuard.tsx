'use client'
import { useEffect, useState } from 'react'

interface DocStatus { type: string; label: string; critical: boolean; present: boolean; patterns: string[] }
interface GuardData { ready: boolean; score: number; required: DocStatus[]; missing_critical: string[]; can_transmit: boolean; blockers: string[]; duplicates: number }

export function DocumentGuard({ traficoId }: { traficoId: string }) {
  const [data, setData] = useState<GuardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/doc-guard?trafico=${encodeURIComponent(traficoId)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [traficoId])

  if (loading) return (
    <div className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />
  )

  if (!data) return null

  const canTransmit = data.can_transmit

  return (
    <div style={{
      background: canTransmit ? 'var(--status-green-bg, rgba(34,197,94,0.06))' : 'var(--status-red-bg, rgba(239,68,68,0.06))',
      border: `1px solid ${canTransmit ? 'var(--status-green-border, rgba(34,197,94,0.2))' : 'var(--status-red-border, rgba(239,68,68,0.2))'}`,
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
        color: canTransmit ? 'var(--status-green, #22c55e)' : 'var(--status-red, #ef4444)',
        marginBottom: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{canTransmit ? 'Listo para transmitir' : 'No transmitir — documentos faltantes'}</span>
        <span style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, fontFamily: 'var(--font-data)' }}>{data.score}%</span>
      </div>

      {data.required.map(doc => (
        <div key={doc.type} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <span style={{
            fontSize: 'var(--aguila-fs-body)',
            color: doc.present ? 'var(--status-green, #22c55e)' :
                   doc.critical ? 'var(--status-red, #ef4444)' : 'var(--text-muted)'
          }}>
            {doc.present ? '\u2705' : doc.critical ? '\u274C' : '\u2B1C'}
          </span>
          <span style={{ flex: 1, fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)' }}>{doc.label}</span>
          {!doc.present && doc.critical && (
            <span style={{
              fontSize: 'var(--aguila-fs-label)', fontWeight: 600,
              color: 'var(--amber-600, #d97706)',
              background: 'rgba(217,119,6,0.1)',
              border: '1px solid rgba(217,119,6,0.2)',
              borderRadius: 4, padding: '2px 6px',
            }}>
              Pendiente
            </span>
          )}
        </div>
      ))}

      {data.duplicates > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(239,68,68,0.08)',
          borderRadius: 6, fontSize: 'var(--aguila-fs-compact)',
          color: 'var(--status-red, #ef4444)', fontWeight: 600,
        }}>
          {data.duplicates} posible(s) factura(s) duplicada(s) detectada(s)
        </div>
      )}

      {data.blockers.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>
          {data.blockers.join(' · ')}
        </div>
      )}
    </div>
  )
}
