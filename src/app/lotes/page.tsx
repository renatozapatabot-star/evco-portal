'use client'

import { useState, useEffect } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Batch {
  id: string
  title: string
  description: string
  count: number
  estimated_minutes: number
  action: string
  traficos: string[]
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchBatches(): Promise<{ batches: Batch[]; total_traficos: number }> {
  const res = await fetch('/api/lotes')
  if (!res.ok) return { batches: [], total_traficos: 0 }
  const json = await res.json()
  return json.data || { batches: [], total_traficos: 0 }
}

// ---------------------------------------------------------------------------
// Action icons
// ---------------------------------------------------------------------------

const ACTION_ICONS: Record<string, string> = {
  aprobar: '✅',
  solicitar: '📄',
  revisar: '📋',
  clasificar: '🏷️',
}

const ACTION_LABELS: Record<string, string> = {
  aprobar: 'Aprobar en bloque',
  solicitar: 'Solicitar docs en bloque',
  revisar: 'Revisar expedientes',
  clasificar: 'Clasificar en bloque',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LotesPage() {
  const [data, setData] = useState<{ batches: Batch[]; total_traficos: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchBatches().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  const handleProcess = async (batch: Batch) => {
    setProcessing(batch.id)
    // Navigate to appropriate page or trigger batch action
    if (batch.action === 'clasificar') {
      window.location.href = '/clasificar'
    } else if (batch.action === 'solicitar') {
      // Could trigger batch solicitation — for now navigate to expedientes
      window.location.href = '/documentos'
    } else if (batch.action === 'aprobar') {
      window.location.href = '/drafts'
    } else {
      window.location.href = '/traficos'
    }
    setProcessing(null)
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: 120, opacity: 0.5 }} />
          ))}
        </div>
      </div>
    )
  }

  const batches = data?.batches || []
  const totalTraficos = data?.total_traficos || 0
  const totalTime = batches.reduce((s, b) => s + b.estimated_minutes, 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>
          Lotes
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6B6B6B' }}>
          {totalTraficos} tráficos activos agrupados para procesamiento rápido
        </p>
      </div>

      {/* Summary bar */}
      {batches.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            padding: '12px 16px',
            background: '#FAFAF8',
            borderRadius: 12,
            border: '1px solid #E8E5E0',
            marginBottom: 24,
          }}
        >
          <div>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>
              {batches.length}
            </span>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9B9B9B' }}>lotes</p>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>
              {totalTraficos}
            </span>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9B9B9B' }}>tráficos</p>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
              ~{totalTime} min
            </span>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9B9B9B' }}>tiempo estimado</p>
          </div>
        </div>
      )}

      {/* Batch cards */}
      {batches.length === 0 ? (
        <EmptyState
          icon="&#128230;"
          title="Sin lotes disponibles"
          description="No hay suficientes tráficos activos para agrupar. Los lotes aparecen cuando hay 2+ operaciones similares."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {batches.map(batch => (
            <div
              key={batch.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{ACTION_ICONS[batch.action] || '📦'}</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
                    {batch.title}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6B6B6B' }}>
                    {batch.description}
                  </p>
                  <p className="font-mono" style={{ margin: '6px 0 0', fontSize: 13, color: '#9B9B9B' }}>
                    ~{batch.estimated_minutes} min estimados
                  </p>
                </div>
              </div>

              {/* Tráfico chips (show first 5) */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {batch.traficos.slice(0, 5).map(t => (
                  <span
                    key={t}
                    className="font-mono"
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      background: '#FAFAF8',
                      border: '1px solid #E8E5E0',
                      color: '#6B6B6B',
                    }}
                  >
                    {t}
                  </span>
                ))}
                {batch.traficos.length > 5 && (
                  <span style={{ padding: '2px 8px', fontSize: 12, color: '#9B9B9B' }}>
                    +{batch.traficos.length - 5} más
                  </span>
                )}
              </div>

              {/* Process button */}
              <button
                onClick={() => handleProcess(batch)}
                disabled={processing === batch.id}
                style={{
                  minHeight: 48,
                  borderRadius: 12,
                  background: 'var(--gold)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: processing === batch.id ? 'wait' : 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#B8933B' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--gold)' }}
              >
                {ACTION_LABELS[batch.action] || 'Procesar lote'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
