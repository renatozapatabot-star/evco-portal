'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface SupplierScore {
  name: string
  avgDays: number
  compliance: number
  operations: number
  tmec: boolean
}

export function ProveedoresView() {
  const companyId = getCookieValue('company_id') ?? ''
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([])

  useEffect(() => {
    async function load() {
      // Fetch supplier network and traficos in parallel
      const [networkRes, traficosRes] = await Promise.all([
        supabase
          .from('supplier_network')
          .select('supplier_name, reliability_score, tmec_eligible, total_operations'),
        supabase
          .from('traficos')
          .select('proveedor, fecha_llegada, fecha_cruce')
          .eq('company_id', companyId)
          .not('fecha_llegada', 'is', null)
          .not('fecha_cruce', 'is', null)
          .limit(2000),
      ])

      const networkData = networkRes.data ?? []
      const traficosData = traficosRes.data ?? []

      // Compute avg crossing days per supplier from traficos
      const daysMap = new Map<string, number[]>()
      for (const t of traficosData) {
        const key = (t.proveedor || '').toLowerCase().trim()
        if (!key) continue
        const arrival = new Date(t.fecha_llegada)
        const cross = new Date(t.fecha_cruce)
        const diffDays = Math.max(0, (cross.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
        if (!daysMap.has(key)) daysMap.set(key, [])
        daysMap.get(key)!.push(diffDays)
      }

      // Build scored list from supplier_network
      const scored: SupplierScore[] = networkData
        .filter(s => s.supplier_name && s.reliability_score != null)
        .map(s => {
          const key = (s.supplier_name || '').toLowerCase().trim()
          const daysList = daysMap.get(key)
          const avgDays = daysList && daysList.length > 0
            ? Math.round((daysList.reduce((a, b) => a + b, 0) / daysList.length) * 10) / 10
            : 0
          return {
            name: s.supplier_name,
            avgDays,
            compliance: Math.round(s.reliability_score),
            operations: s.total_operations || 0,
            tmec: !!s.tmec_eligible,
          }
        })
        .sort((a, b) => b.compliance - a.compliance || a.avgDays - b.avgDays)

      setSuppliers(scored)
      setLoading(false)
    }

    load()
  }, [companyId])

  const top3 = useMemo(() => suppliers.slice(0, 3), [suppliers])
  const ranked = useMemo(() => suppliers, [suppliers])

  if (loading) {
    return (
      <div className="page-shell">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">Cargando scoreboard...</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 56, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div className="page-shell">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Proveedores</h1>
        </div>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Sin proveedores registrados
          </div>
          <div style={{ fontSize: 13 }}>
            Ejecuta la sincronizacion de supplier_network para ver el scoreboard.
          </div>
        </div>
      </div>
    )
  }

  const rowBg = (compliance: number) =>
    compliance >= 95 ? 'rgba(22,163,74,0.04)'
      : compliance >= 80 ? 'rgba(212,149,42,0.04)'
      : 'rgba(220,38,38,0.04)'

  const rowBorder = (compliance: number) =>
    compliance >= 95 ? 'rgba(22,163,74,0.1)'
      : compliance >= 80 ? 'rgba(212,149,42,0.1)'
      : 'rgba(220,38,38,0.1)'

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Proveedores</h1>
        <p className="page-subtitle">{suppliers.length} proveedores rankeados por confiabilidad</p>
      </div>

      {/* Podium — Top 3 */}
      {top3.length >= 1 && (
        <div style={{ padding: isMobile ? '20px 12px' : '24px 20px', textAlign: 'center' }}>
          {/* #1 */}
          <div style={{
            padding: '20px 24px', borderRadius: 16, marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(196,150,60,0.1) 0%, rgba(196,150,60,0.02) 100%)',
            border: '2px solid rgba(196,150,60,0.3)',
          }}>
            <div style={{ fontSize: 28 }}>🥇</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {top3[0].name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {top3[0].avgDays > 0 ? `Docs en ${top3[0].avgDays} dias` : 'Sin datos de cruce'} · {top3[0].compliance}% completos
            </div>
          </div>

          {/* #2 and #3 side by side */}
          {top3.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: top3.length >= 3 ? '1fr 1fr' : '1fr', gap: 12 }}>
              {top3.slice(1, 3).map((s, i) => (
                <div key={s.name} style={{
                  padding: 16, borderRadius: 14,
                  background: 'var(--bg-card)', border: '1px solid var(--border-card)',
                }}>
                  <div style={{ fontSize: 20 }}>{i === 0 ? '🥈' : '🥉'}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {s.avgDays > 0 ? `${s.avgDays} dias` : '—'} · {s.compliance}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ranked List */}
      <div style={{ padding: isMobile ? '0 12px' : '0 20px' }}>
        {ranked.map((supplier, i) => (
          <div key={supplier.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 10, marginBottom: 6,
            background: rowBg(supplier.compliance),
            border: `1px solid ${rowBorder(supplier.compliance)}`,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)', width: 32, flexShrink: 0,
            }}>
              #{i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {supplier.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {supplier.avgDays > 0 ? `${supplier.avgDays} dias` : '—'} · {supplier.operations} ops · {supplier.compliance}%
              </div>
            </div>
            {supplier.tmec && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 9999,
                background: 'rgba(22,163,74,0.1)', color: 'var(--success)', flexShrink: 0,
              }}>
                T-MEC
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
