'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getCookieValue } from '@/lib/client-config'
import { FinTable } from '@/components/financiero/FinTable'
import { FinExchange } from '@/components/financiero/FinExchange'
import type { FacturaRow } from '@/components/financiero/FinTable'
import type { TipoCambio } from '@/components/financiero/FinExchange'
import { DollarSign, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

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

  // ── Filtered facturas ──
  const filteredFacturas = useMemo(() => {
    if (!companyFilter) return facturas
    return facturas.filter(r => (r.clave_cliente || '').includes(companyFilter))
  }, [facturas, companyFilter])

  const filteredCount = filteredFacturas.length

  // ── Financial summary ──
  const summary = useMemo(() => {
    const now = new Date()
    const totalUSD = traficos.reduce((s, t) => s + (t.importe_total || 0), 0)
    const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
    const cruzadoUSD = cruzados.reduce((s, t) => s + (t.importe_total || 0), 0)
    const enProceso = traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
    const enProcesoUSD = enProceso.reduce((s, t) => s + (t.importe_total || 0), 0)

    // Aging buckets (based on fecha_pago)
    const buckets = { current: 0, d30: 0, d60: 0, d90plus: 0 }
    for (const f of filteredFacturas) {
      const fechaPago = f.fecha_pago
      if (!fechaPago) { buckets.d90plus += (f.valor_usd || 0); continue }
      const payDate = new Date(fechaPago)
      const daysSince = Math.floor((now.getTime() - payDate.getTime()) / 86400000)
      const val = f.valor_usd || 0
      if (daysSince <= 0) buckets.current += val
      else if (daysSince <= 30) buckets.d30 += val
      else if (daysSince <= 60) buckets.d60 += val
      else buckets.d90plus += val
    }

    // Monthly totals for last 6 months
    const monthly: { month: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: 'America/Chicago' })
      const total = traficos
        .filter(t => (t.fecha_cruce || '').startsWith(prefix))
        .reduce((s, t) => s + (t.importe_total || 0), 0)
      monthly.push({ month: label, amount: total })
    }

    return { totalUSD, cruzadoUSD, enProcesoUSD, buckets, monthly, cruzadoCount: cruzados.length, enProcesoCount: enProceso.length }
  }, [traficos, filteredFacturas])

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

        {/* Summary Cards */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <DollarSign size={16} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: D.textSec, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total importado</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: D.text }}>
                ${(summary.totalUSD / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: 11, color: D.textSec, marginTop: 4 }}>
                {summary.cruzadoCount} cruzados · {summary.enProcesoCount} en proceso
              </div>
            </div>

            <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: D.textSec, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cruzados</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: D.text }}>
                ${(summary.cruzadoUSD / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: 11, color: D.textSec, marginTop: 4 }}>USD · {summary.cruzadoCount} operaciones</div>
            </div>

            <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Clock size={16} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: D.textSec, textTransform: 'uppercase', letterSpacing: '0.07em' }}>En proceso</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: D.text }}>
                ${(summary.enProcesoUSD / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: 11, color: D.textSec, marginTop: 4 }}>USD · {summary.enProcesoCount} tráficos</div>
            </div>
          </div>
        )}

        {/* Aging Analysis */}
        {!loading && isInternal && (
          <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: D.text }}>Antigüedad de cartera</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Corriente', value: summary.buckets.current, color: 'var(--success)' },
                { label: '1-30 días', value: summary.buckets.d30, color: 'var(--gold)' },
                { label: '31-60 días', value: summary.buckets.d60, color: 'var(--warning)' },
                { label: '60+ días', value: summary.buckets.d90plus, color: 'var(--danger-500)' },
              ].map(b => (
                <div key={b.label} style={{
                  padding: 12, borderRadius: 8, background: 'var(--bg-main)',
                  border: `1px solid ${D.cardBorder}`,
                }}>
                  <div style={{ fontSize: 11, color: D.textSec, marginBottom: 4 }}>{b.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: b.color }}>
                    ${(b.value / 1000).toFixed(0)}K
                  </div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: b.color,
                      width: `${Math.min(100, (b.value / Math.max(summary.totalUSD, 1)) * 100 * 4)}%`,
                      transition: 'width 300ms',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Trend */}
        {!loading && (
          <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: D.r, padding: 20, marginBottom: 24 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: D.text, display: 'block', marginBottom: 16 }}>
              Tendencia mensual (6 meses)
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {summary.monthly.map(m => {
                const maxAmt = Math.max(...summary.monthly.map(x => x.amount), 1)
                const pct = (m.amount / maxAmt) * 100
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: D.textSec }}>
                      ${(m.amount / 1000000).toFixed(1)}M
                    </span>
                    <div style={{
                      width: '100%', maxWidth: 48, height: `${Math.max(pct, 4)}%`,
                      background: 'var(--gold)', borderRadius: '4px 4px 0 0',
                      transition: 'height 300ms',
                    }} />
                    <span style={{ fontSize: 10, color: D.textSec }}>{m.month}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
