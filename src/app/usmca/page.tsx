'use client'

import { useEffect, useState, useMemo } from 'react'
import { getCookieValue } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { USMCAKPIs } from '@/components/usmca/USMCAKPIs'
import { USMCATable } from '@/components/usmca/USMCATable'
import { USMCACerts } from '@/components/usmca/USMCACerts'
import type { TraficoRow } from '@/components/usmca/USMCATable'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  bg: 'var(--bg-main)',
  card: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  sans: 'var(--font-sans)',
  r: 8,
} as const

/* ═══════════════════════════════════════════════════════════
   USMCA / T-MEC INTELLIGENCE PAGE
   ═══════════════════════════════════════════════════════════ */
export default function USMCAPage() {
  const [role, setRole] = useState('')
  const [companyId, setCompanyId] = useState('')

  const isMobile = useIsMobile()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)

  // Company filter for broker
  const [companyFilter, setCompanyFilter] = useState('')

  useEffect(() => {
    const r = getCookieValue('user_role') || 'client'
    const cid = getCookieValue('company_id') || ''
    setRole(r)
    setCompanyId(cid)
  }, [])

  useEffect(() => {
    if (!role) return
    const isInternal = role === 'broker' || role === 'admin'
    const companyParam = isInternal ? '' : `&company_id=${companyId}`

    fetch(`/api/data?table=traficos${companyParam}&limit=5000&order_by=importe_total&order_dir=desc`)
      .then(r => r.json())
      .then(d => { setTraficos(d.data ?? []); setLoading(false) })
      .catch(() => { setTraficos([]); setLoading(false) })
  }, [role, companyId])

  const isInternal = role === 'broker' || role === 'admin'

  // ── All IMD traficos (T-MEC applied) ──
  const imdTraficos = useMemo(() => {
    let rows = traficos.filter(t => (t.regimen || '').toUpperCase().includes('IMD'))
    if (companyFilter) {
      rows = rows.filter(t =>
        (t.clave_cliente || '').includes(companyFilter)
      )
    }
    return rows
  }, [traficos, companyFilter])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const imdThisMonth = imdTraficos.filter(t => {
      const d = t.fecha_cruce || t.fecha_llegada
      if (!d) return false
      return new Date(d) >= monthStart
    })
    const savingsMonth = imdThisMonth.reduce((s, r) => s + (Number(r.importe_total) || 0) * 0.08, 0)
    const countApplied = imdTraficos.length

    return { savingsMonth, countApplied }
  }, [imdTraficos])

  // ── Unique companies for filter ──
  const companies = useMemo(() => {
    if (!isInternal) return []
    const set = new Set<string>()
    traficos.forEach(t => { if (t.clave_cliente) set.add(t.clave_cliente) })
    return Array.from(set).sort()
  }, [traficos, isInternal])

  return (
    <div style={{ background: D.bg, minHeight: '100vh', color: D.text, fontFamily: D.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
              T-MEC / USMCA Intelligence
            </h1>
            <p style={{ color: D.textSec, fontSize: 14, margin: '4px 0 0' }}>
              Ahorros y trazabilidad de tratado · Patente 3596
            </p>
          </div>

          {isInternal && companies.length > 0 && (
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value) }}
              style={{
                background: D.card,
                border: `1px solid ${D.cardBorder}`,
                borderRadius: D.r,
                color: D.text,
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: D.sans,
                minHeight: 60,
              }}
            >
              <option value="">Todos los clientes</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* KPI Cards */}
        <USMCAKPIs
          loading={loading}
          savingsMonth={kpis.savingsMonth}
          countApplied={kpis.countApplied}
          isMobile={isMobile}
        />

        {/* T-MEC Table */}
        <USMCATable imdTraficos={imdTraficos} loading={loading} />

        {/* Certificate Status */}
        <USMCACerts isMobile={isMobile} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
