'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getCookieValue } from '@/lib/client-config'
import { FinTable } from '@/components/financiero/FinTable'
import { FinExchange } from '@/components/financiero/FinExchange'
import type { FacturaRow } from '@/components/financiero/FinTable'
import type { TipoCambio } from '@/components/financiero/FinExchange'

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

/* ── Types ── */
interface TraficoRow {
  trafico: string
  estatus?: string
  importe_total?: number | null
  regimen?: string | null
  fecha_cruce?: string | null
  company_id?: string | null
  clave_cliente?: string | null
  [k: string]: unknown
}

/* ═══════════════════════════════════════════════════════════
   FINANCIERO PAGE
   ═══════════════════════════════════════════════════════════ */
export default function FinancieroPage() {
  const isMobile = useIsMobile()
  const [role, setRole] = useState<string>('')
  const [companyClave, setCompanyClave] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')

  // Data
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [tc, setTc] = useState<TipoCambio | null>(null)
  const [loading, setLoading] = useState(true)
  const [facturasLoading, setFacturasLoading] = useState(true)

  // Company filter for broker
  const [companyFilter, setCompanyFilter] = useState<string>('')

  useEffect(() => {
    const r = getCookieValue('user_role') || 'client'
    const clave = getCookieValue('company_clave') || ''
    const cid = getCookieValue('company_id') || ''
    setRole(r)
    setCompanyClave(clave)
    setCompanyId(cid)
  }, [])

  // Fetch all data
  useEffect(() => {
    if (!role) return

    const isInternal = role === 'broker' || role === 'admin'
    const claveParam = isInternal ? '' : `&clave_cliente=${companyClave}`
    const companyParam = isInternal ? '' : `&company_id=${companyId}`

    // Fetch traficos, facturas, tipo de cambio in parallel
    Promise.all([
      fetch(`/api/data?table=traficos${companyParam}&limit=5000&order_by=importe_total&order_dir=desc`)
        .then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/data?table=aduanet_facturas${claveParam}&limit=5000&order_by=fecha_pago&order_dir=desc`)
        .then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/tipo-cambio')
        .then(r => r.json()).catch(() => ({ tc: 17.50, fecha: '', source: 'fallback' })),
    ]).then(([trafData, factData, tcData]) => {
      setTraficos(trafData.data ?? [])
      setFacturas(factData.data ?? [])
      setTc(tcData)
      setLoading(false)
      setFacturasLoading(false)
    })
  }, [role, companyClave, companyId])

  const isInternal = role === 'broker' || role === 'admin'

  // ── Unique companies for filter ──
  const companies = useMemo(() => {
    if (!isInternal) return []
    const set = new Set<string>()
    traficos.forEach(t => { if (t.clave_cliente) set.add(t.clave_cliente) })
    return Array.from(set).sort()
  }, [traficos, isInternal])

  // ── Filtered facturas count for subtitle ──
  const filteredCount = useMemo(() => {
    let f = facturas
    if (companyFilter) {
      f = f.filter(r => (r.clave_cliente || '').includes(companyFilter))
    }
    return f.length
  }, [facturas, companyFilter])

  return (
    <div style={{ background: D.bg, minHeight: '100vh', color: D.text, fontFamily: D.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Contabilidad</h1>
          <p style={{ color: D.textSec, fontSize: 13, margin: '4px 0 0' }}>
            {filteredCount} factura{filteredCount !== 1 ? 's' : ''}
          </p>

          {/* Company filter for broker/admin */}
          {isInternal && companies.length > 0 && (
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value) }}
              style={{
                background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r,
                color: D.text, padding: '8px 12px', fontSize: 14, fontFamily: D.sans, minHeight: 44, marginTop: 12,
              }}
            >
              <option value="">Todos los clientes</option>
              {companies.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          )}
        </div>

        {/* Facturas Table */}
        <FinTable
          facturas={facturas}
          facturasLoading={facturasLoading}
          isMobile={isMobile}
          companyFilter={companyFilter}
        />

        {/* Tipo de Cambio */}
        <FinExchange tc={tc} isMobile={isMobile} />
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
