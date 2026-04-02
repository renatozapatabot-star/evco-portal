'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { GOLD } from '@/lib/design-system'
import { formatAbsoluteETA, fmtUSD } from '@/lib/format-utils'
import { getClientClaveCookie } from '@/lib/client-config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIER_CONFIG: Record<number, { label: string; time: string; color: string; bg: string; border: string }> = {
  1: { label: 'Alta confianza', time: '~2 min', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  2: { label: 'Confianza media', time: '~5 min', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  3: { label: 'Revisión completa', time: 'Sin límite', color: 'var(--danger-500)', bg: '#FEF2F2', border: '#FECACA' },
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
    const clientClave = getClientClaveCookie()
    let q = supabase.from('pedimento_drafts')
      .select('*')
      .eq('company_id', clientClave)
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
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy-900)', letterSpacing: '-0.02em', margin: 0 }}>Borradores</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 4 }}>{drafts.length} borrador{drafts.length !== 1 ? 'es' : ''} {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : 'totales'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--slate-50)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {(['pending', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: filter === f ? 'white' : 'transparent', color: filter === f ? 'var(--navy-900)' : 'var(--slate-400)',
            boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      ) : drafts.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <CheckCircle size={32} style={{ color: '#16A34A', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-700)' }}>Sin borradores pendientes</div>
          <div style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 4 }}>Todos los borradores han sido revisados</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drafts.map(d => {
            const tier = TIER_CONFIG[d.review_tier || 2]
            const confidence = d.overall_confidence || 0
            const valorUSD = d.contributions?.valor_total_usd || d.extracted_fields?.valor_usd || 0
            const trafico = d.trafico_id || d.id
            const supplier = d.extracted_fields?.supplier || d.extracted_fields?.proveedor || '—'
            const product = d.products?.[0]?.description || d.extracted_fields?.descripcion || '—'

            return (
              <div key={d.id} onClick={() => router.push(`/drafts/${d.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  background: 'var(--bg-card)', border: 'var(--b-default)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', borderLeft: `4px solid ${tier.color}`, minHeight: 60,
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--navy-900)' }}>{trafico}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                      Tier {d.review_tier || '?'} · {tier.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--slate-600)' }}>{supplier} · {product}</div>
                  <div style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {formatAbsoluteETA(d.created_at)} {valorUSD > 0 && `· ${fmtUSD(Number(valorUSD))} USD`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
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
            background: 'linear-gradient(135deg, #B8953F 0%, #D4B05C 50%, #8B6914 100%)',
            borderRadius: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, fontWeight: 900, color: '#1A1710',
            fontFamily: 'Georgia, serif',
            animation: 'scaleIn 0.6s cubic-bezier(0.2, 0.9, 0.4, 1.1)',
          }}>Z</div>
          <div style={{ color: '#E8E5DF', fontSize: 24, fontWeight: 800, marginTop: 24, letterSpacing: '-0.02em' }}>
            Patente 3596 honrada
          </div>
          <div style={{ color: '#9C9890', fontSize: 16, marginTop: 8 }}>
            Gracias, Tito.
          </div>
          <div style={{ fontSize: 32, marginTop: 16 }}>🦀</div>
        </div>
      )}
    </div>
  )
}
