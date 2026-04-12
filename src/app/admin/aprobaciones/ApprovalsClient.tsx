'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { fmtDateTime, fmtMXN, fmtUSD } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { PedimentoDetail } from './PedimentoDetail'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DraftRow {
  id: string
  trafico_id: string | null
  draft_data: Record<string, unknown>
  status: string
  company_id: string
  created_at: string
  company_name?: string
}

interface Props {
  initialDrafts: DraftRow[]
}

function confidenceBadge(tier: string, avg: number) {
  const color = tier === 'alta' ? '#22C55E' : tier === 'media' ? '#FBBF24' : '#EF4444'
  const label = tier === 'alta' ? 'Alta' : tier === 'media' ? 'Media' : 'Baja'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      background: `${color}18`, color,
      border: `1px solid ${color}33`,
      whiteSpace: 'nowrap',
    }}>
      {label} · {avg}%
    </span>
  )
}

export function ApprovalsClient({ initialDrafts }: Props) {
  const isMobile = useIsMobile()
  const [drafts, setDrafts] = useState<DraftRow[]>(initialDrafts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedDraft = drafts.find(d => d.id === selectedId) || null

  async function loadDrafts() {
    const { data } = await supabase
      .from('pedimento_drafts')
      .select('id, trafico_id, draft_data, status, company_id, created_at')
      .in('status', ['ready_for_approval', 'draft', 'pending'])
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setDrafts(data as DraftRow[])
      // If selected draft was approved/removed, deselect
      if (selectedId && !data.find(d => d.id === selectedId)) {
        setSelectedId(null)
      }
    }
  }

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadDrafts, 5000)
    return () => clearInterval(interval)
  }, [selectedId])

  function handleActionComplete() {
    loadDrafts()
    setSelectedId(null)
  }

  const glassCard = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  } as const

  // Mobile: show detail as full-screen overlay
  if (isMobile && selectedDraft) {
    return (
      <div>
        <button
          onClick={() => setSelectedId(null)}
          style={{
            background: 'none', border: 'none', color: '#C0C5CE',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            padding: '8px 0', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Volver a la cola
        </button>
        <PedimentoDetail draft={selectedDraft} onActionComplete={handleActionComplete} />
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: selectedDraft && !isMobile ? '400px 1fr' : '1fr',
      gap: 20, minHeight: 'calc(100vh - 200px)',
    }}>
      {/* Queue List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {drafts.length === 0 ? (
          <div style={{ ...glassCard, padding: '40px 20px' }}>
            <EmptyState
              icon="✅"
              title="Sin pedimentos pendientes"
              description="Todos los pedimentos han sido revisados"
            />
          </div>
        ) : (
          drafts.map(d => {
            const dd = d.draft_data || {}
            const extraction = (dd.extraction || {}) as Record<string, unknown>
            const contributions = (dd.contributions || dd.duties || {}) as Record<string, unknown>
            const meta = (dd.approval_metadata || {}) as Record<string, unknown>
            const valorUSD = (contributions.valor_aduana_usd || extraction.total_value || dd.valor_total_usd || 0) as number
            const tipoCambio = (contributions.tipo_cambio || dd.tipo_cambio || 0) as number
            const valorMXN = tipoCambio > 0 ? valorUSD * tipoCambio : 0
            const confTier = (meta.confidence_tier || dd.confianza || 'media') as string
            const confAvg = (meta.confidence_avg || 0) as number
            const lineCount = (meta.line_item_count || (dd.products as unknown[] || []).length) as number
            const isSelected = d.id === selectedId

            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                style={{
                  ...glassCard,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  borderLeft: isSelected ? '3px solid #eab308' : '3px solid transparent',
                  borderColor: isSelected ? undefined : 'rgba(255,255,255,0.08)',
                  transition: 'border-color 150ms',
                  minHeight: 60,
                }}
              >
                {/* Row 1: company + badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    {d.company_name || d.company_id}
                  </span>
                  {confidenceBadge(confTier, confAvg)}
                </div>

                {/* Row 2: tráfico ID */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800,
                  color: '#E6EDF3', marginBottom: 6,
                }}>
                  {d.trafico_id || '—'}
                </div>

                {/* Row 3: value + line count + timestamp */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 12, color: '#94a3b8', flexWrap: 'wrap',
                }}>
                  {valorUSD > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {fmtUSD(valorUSD)} USD
                    </span>
                  )}
                  {valorMXN > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                      {fmtMXN(valorMXN)}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <FileText size={11} /> {lineCount} líneas
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b',
                  }}>
                    <Clock size={11} /> {fmtDateTime(d.created_at)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Detail Panel (desktop only) */}
      {selectedDraft && !isMobile && (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          <PedimentoDetail draft={selectedDraft} onActionComplete={handleActionComplete} />
        </div>
      )}

      {/* Empty detail state */}
      {!selectedDraft && !isMobile && drafts.length > 0 && (
        <div style={{
          ...glassCard,
          padding: '60px 20px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <FileText size={32} color="#475569" />
          <span style={{ fontSize: 14, color: '#64748b' }}>
            Selecciona un pedimento para revisar
          </span>
        </div>
      )}
    </div>
  )
}
