'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { GOLD } from '@/lib/design-system'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatAbsoluteETA, fmtUSD } from '@/lib/format-utils'
import { getCompanyIdCookie } from '@/lib/client-config'
import { createClient } from '@supabase/supabase-js'
import { EmptyState } from '@/components/ui/EmptyState'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIER_CONFIG: Record<number, { label: string; time: string; color: string; bg: string; border: string }> = {
  1: { label: 'Alta confianza', time: '~2 min', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
  2: { label: 'Confianza media', time: '~5 min', color: 'var(--warning)', bg: 'rgba(192,197,206,0.08)', border: 'rgba(192,197,206,0.2)' },
  3: { label: 'Revisión completa', time: 'Sin límite', color: 'var(--danger-500)', bg: 'rgba(239,68,68,0.1)', border: '#FECACA' },
}

// Resolve approved_pending → approved after 5-second cancellation window
function resolveStatus(draft: { status: string; updated_at: string }): string {
  if (draft.status === 'approved_pending') {
    const elapsed = Date.now() - new Date(draft.updated_at).getTime()
    if (elapsed > 5000) return 'approved'
  }
  return draft.status
}

export default function DraftsPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase returns dynamic draft_data shapes
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBlessing, setShowBlessing] = useState<string | null>(null)
  const previousStatuses = useState<Map<string, string>>(new Map())[0]

  // Auto-dismiss blessing after 3 seconds
  useEffect(() => {
    if (showBlessing) {
      const timer = setTimeout(() => setShowBlessing(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [showBlessing])

  // Load drafts function (reusable for polling)
  const loadDrafts = async () => {
    const companyId = getCompanyIdCookie()
    let q = supabase.from('pedimento_drafts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter === 'pending') q = q.in('status', ['draft', 'pending', 'approved_pending'])
    else if (filter === 'approved') q = q.in('status', ['approved', 'approved_pending', 'approved_corrected'])

    const { data } = await q
    const freshDrafts = data || []

    // Detect blessing transition: draft/pending → approved/approved_pending(expired)/approved_corrected
    for (const d of freshDrafts) {
      const prev = previousStatuses.get(d.id)
      const resolved = resolveStatus(d)
      if (prev && (prev === 'draft' || prev === 'pending') &&
          (resolved === 'approved' || resolved === 'approved_corrected')) {
        setShowBlessing(d.id)
      }
      previousStatuses.set(d.id, resolved)
    }

    setDrafts(freshDrafts)
    setLoading(false)
  }

  // Initial load + filter change
  useEffect(() => {
    setLoading(true)
    loadDrafts()
  }, [filter])

  // Poll every 3 seconds for real-time status changes
  useEffect(() => {
    const interval = setInterval(loadDrafts, 3000)
    return () => clearInterval(interval)
  }, [filter])

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy-900)', letterSpacing: '-0.02em', margin: 0 }}>Ghost Pedimentos</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 4 }}>{drafts.length} borrador{drafts.length !== 1 ? 'es' : ''} {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : 'totales'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--slate-50)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {(['pending', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '10px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 60,
            background: filter === f ? 'rgba(192,197,206,0.15)' : 'transparent', color: filter === f ? '#E6EDF3' : 'var(--slate-400)',
            boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState icon="✅" title="Sin borradores pendientes" description="Todos los borradores han sido revisados" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drafts.map(d => {
            const dd = d.draft_data || {}
            const tierNum = dd.confidence?.tier || d.review_tier || 2
            const tier = TIER_CONFIG[tierNum]
            const confidence = dd.confidence?.score || d.overall_confidence || 0
            const valorUSD = dd.contributions?.valor_aduana_usd || dd.extraction?.total_value || d.contributions?.valor_total_usd || 0
            const trafico = d.trafico_id || d.id?.substring(0, 8)
            const supplier = dd.extraction?.supplier_name || dd.supplier || d.extracted_fields?.supplier || '—'
            const product = dd.extraction?.products?.[0]?.description || dd.extraction?.descripcion || '—'
            const fraccion = dd.classifications?.[0]?.fraccion || null
            const isTMEC = dd.contributions?.igi?.tmec === true
            const confianza = dd.confianza || (tierNum === 1 ? 'alta' : tierNum === 2 ? 'media' : 'baja')
            const flagsCount = dd.flags?.length || 0

            return (
              <div key={d.id} onClick={() => router.push(`/drafts/${d.id}`)}
                style={{
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 8 : 16,
                  padding: '16px 20px',
                  background: 'var(--bg-card)', border: 'var(--b-default)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', borderLeft: `4px solid ${tier.color}`, minHeight: 60,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--navy-900)' }}>{trafico}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                      {confianza === 'alta' ? '✅ Alta' : confianza === 'media' ? '⚠️ Media' : '🔴 Baja'}
                    </span>
                    {isTMEC && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#F0FDFA', color: '#0D9488', border: '1px solid #99F6E4' }}>
                        T-MEC
                      </span>
                    )}
                    {flagsCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                        🚩 {flagsCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--slate-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supplier} · {product}</div>
                  <div style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2, fontFamily: 'var(--font-mono)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{formatAbsoluteETA(d.created_at)}</span>
                    {valorUSD > 0 && <span>{fmtUSD(Number(valorUSD))} USD</span>}
                    {fraccion && <span>{fraccion}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', color: tier.color }}>{confidence}%</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>confianza</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Blessing animation — triggers when Tito approves via Telegram */}
      {showBlessing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,13,12,0.95)',
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{
            width: 120, height: 120,
            background: 'linear-gradient(135deg, #eab308 0%, #D4B05C 50%, #8B6914 100%)',
            borderRadius: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, fontWeight: 900, color: 'var(--text-primary)',
            fontFamily: 'Georgia, serif',
            animation: 'scaleIn 0.6s cubic-bezier(0.2, 0.9, 0.4, 1.1)',
          }}>Z</div>
          <div style={{ color: '#E8E5DF', fontSize: 24, fontWeight: 800, marginTop: 24, letterSpacing: '-0.02em' }}>
            Patente 3596 honrada
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 8 }}>
            Gracias, Tito.
          </div>
          <div style={{ fontSize: 32, marginTop: 16 }}>🦀</div>
        </div>
      )}
    </div>
  )
}
