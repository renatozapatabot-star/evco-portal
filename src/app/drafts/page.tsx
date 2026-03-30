'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { GOLD } from '@/lib/design-system'
import { formatAbsoluteETA, fmtUSD } from '@/lib/format-utils'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIER_CONFIG: Record<number, { label: string; time: string; color: string; bg: string; border: string }> = {
  1: { label: 'Alta confianza', time: '~2 min', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  2: { label: 'Confianza media', time: '~5 min', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  3: { label: 'Revisión completa', time: 'Sin límite', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

export default function DraftsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      let q = supabase.from('pedimento_drafts')
        .select('*')
        .eq('company_id', CLIENT_CLAVE)
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter === 'pending') q = q.in('status', ['draft', 'pending'])
      else if (filter === 'approved') q = q.eq('status', 'approved')

      const { data } = await q
      setDrafts(data || [])
      setLoading(false)
    }
    load()
  }, [filter])

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--n-900)', letterSpacing: '-0.02em', margin: 0 }}>Borradores</h1>
          <p style={{ fontSize: 13, color: 'var(--n-400)', marginTop: 4 }}>{drafts.length} borrador{drafts.length !== 1 ? 'es' : ''} {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : 'totales'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--n-50)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {(['pending', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: filter === f ? 'white' : 'transparent', color: filter === f ? 'var(--n-900)' : 'var(--n-400)',
            boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r-md)' }} />)}
        </div>
      ) : drafts.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <CheckCircle size={32} style={{ color: '#16A34A', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)' }}>Sin borradores pendientes</div>
          <div style={{ fontSize: 13, color: 'var(--n-400)', marginTop: 4 }}>Todos los borradores han sido revisados</div>
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
                  background: 'var(--bg-card)', border: 'var(--b-default)', borderRadius: 'var(--r-md)',
                  cursor: 'pointer', borderLeft: `4px solid ${tier.color}`, minHeight: 60,
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontWeight: 800, fontSize: 15, color: 'var(--n-900)' }}>{trafico}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                      Tier {d.review_tier || '?'} · {tier.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--n-600)' }}>{supplier} · {product}</div>
                  <div style={{ fontSize: 12, color: 'var(--n-400)', marginTop: 2, fontFamily: 'var(--font-data)' }}>
                    {formatAbsoluteETA(d.created_at)} {valorUSD > 0 && `· ${fmtUSD(Number(valorUSD))} USD`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-data)', color: tier.color }}>{confidence}%</div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)' }}>confianza</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
