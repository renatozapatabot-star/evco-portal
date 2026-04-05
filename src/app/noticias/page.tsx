'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fmtDate } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface AlertRow {
  id: number
  title: string
  description: string | null
  source: string | null
  url: string | null
  relevance: string | null
  keywords: string[] | null
  published_at: string | null
  created_at: string
}

export default function NoticiasPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all')

  useEffect(() => {
    supabase
      .from('regulatory_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setAlerts((data || []) as AlertRow[]); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.relevance === filter)

  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>Noticias Regulatorias</h1>
      <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 24px' }}>
        Actualizaciones del DOF, SAT, y CBP que afectan sus operaciones
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'all' as const, label: 'Todas' },
          { key: 'high' as const, label: 'Alta relevancia' },
          { key: 'medium' as const, label: 'Media' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: filter === f.key ? 700 : 500,
            background: filter === f.key ? 'rgba(196,150,60,0.1)' : '#FFFFFF',
            border: `1px solid ${filter === f.key ? '#C4963C' : '#E8E5E0'}`,
            color: filter === f.key ? '#C4963C' : '#6B6B6B', cursor: 'pointer',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📰" title="Sin noticias regulatorias" description="Las actualizaciones del DOF y SAT aparecerán aquí" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(alert => (
            <div key={alert.id} className="card" style={{
              padding: '16px 20px',
              borderLeft: `4px solid ${alert.relevance === 'high' ? 'var(--danger-500)' : 'var(--warning-500)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{alert.title}</div>
                  {alert.description && (
                    <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5, marginBottom: 8 }}>
                      {alert.description.substring(0, 200)}{alert.description.length > 200 ? '...' : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#9B9B9B' }}>{fmtDate(alert.published_at || alert.created_at)}</span>
                    {alert.source && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#F5F4F0', color: '#6B6B6B' }}>{alert.source}</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: alert.relevance === 'high' ? '#FEF2F2' : '#FFFBEB', color: alert.relevance === 'high' ? 'var(--danger-500)' : 'var(--warning-500)' }}>
                      {alert.relevance === 'high' ? 'Alta' : 'Media'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {alert.url && (
                    <a href={alert.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#C4963C', fontWeight: 600, textDecoration: 'none' }}>
                      Ver fuente →
                    </a>
                  )}
                  <Link href={`/cruz?q=${encodeURIComponent('¿Cómo me afecta: ' + alert.title.substring(0, 40))}`} style={{ fontSize: 11, color: '#0D9488', fontWeight: 600, textDecoration: 'none' }}>
                    ¿Cómo me afecta?
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#9B9B9B' }}>
        Fuentes: Diario Oficial de la Federación · SAT · CBP
      </div>
    </div>
  )
}
