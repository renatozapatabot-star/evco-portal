'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { Search, Download, ArrowUpDown } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSDCompact } from '@/lib/format-utils'
import { downloadCSV } from '@/lib/export-utils'
import { SupplierKPIs } from '@/components/proveedores/SupplierKPIs'
import { SupplierTable } from '@/components/proveedores/SupplierTable'
import type { SupplierAgg } from '@/components/proveedores/SupplierDetail'

const T = {
  bg: 'var(--bg-main)',
  surface: 'var(--bg-card)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
} as const

interface TraficoRow {
  trafico: string
  proveedores?: string | null
  pais_procedencia?: string | null
  importe_total?: number | null
  fecha_llegada?: string | null
  estatus?: string | null
  descripcion_mercancia?: string | null
  company_id?: string | null
  pedimento?: string | null
  regimen?: string | null
  fecha_cruce?: string | null
  [k: string]: unknown
}

export default function ProveedoresPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '')
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'value' | 'traficos' | 'name'>('value')

  const [userRole, setUserRole] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
  }, [])

  const isInternal = userRole === 'broker' || userRole === 'admin'

  // Fetch supplier name lookup from globalpc_proveedores
  useEffect(() => {
    const cid = getCookieValue('company_id') || ''
    fetch(`/api/data?table=globalpc_proveedores&limit=5000${cid ? '&company_id=' + cid : ''}`)
      .then(r => r.json())
      .then(d => {
        const provs = (d.data ?? []) as { cve_proveedor?: string; nombre?: string }[]
        const lookup = new Map<string, string>()
        provs.forEach(p => {
          if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre.trim())
        })
        setSupplierLookup(lookup)
      })
      .catch(() => { /* best-effort */ })
  }, [])

  // Fetch traficos with proveedores field
  useEffect(() => {
    if (!companyId && !isInternal) return
    const params = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
    })
    if (!isInternal && companyId) {
      params.set('company_id', companyId)
    }

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => {
        const arr = (d.data ?? d) as TraficoRow[]
        setRows(Array.isArray(arr) ? arr : [])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [companyId, clientClave, isInternal])

  // Extract unique client IDs for broker filter
  const clientIds = useMemo(() => {
    if (!isInternal) return []
    const ids = new Set<string>()
    rows.forEach(r => { if (r.company_id) ids.add(r.company_id) })
    return Array.from(ids).sort()
  }, [rows, isInternal])

  // Aggregate suppliers from traficos
  const suppliers = useMemo(() => {
    const map = new Map<string, SupplierAgg>()
    const filteredRows = clientFilter === 'all' ? rows : rows.filter(r => r.company_id === clientFilter)

    for (const r of filteredRows) {
      const prov = r.proveedores
      if (!prov || (typeof prov === 'string' && !prov.trim())) continue

      let names: string[] = []
      if (typeof prov === 'string') {
        try {
          const parsed = JSON.parse(prov)
          if (Array.isArray(parsed)) names = parsed.map(String)
          else names = prov.split(',').map(s => s.trim()).filter(Boolean)
        } catch {
          names = prov.split(',').map(s => s.trim()).filter(Boolean)
        }
      }

      for (const raw of names) {
        const rawTrimmed = raw.trim()
        const resolved = supplierLookup.get(rawTrimmed) || rawTrimmed.replace(/^PRV_/, 'Proveedor ')
        const name = resolved
        if (!name) continue
        const key = name.toLowerCase()
        const existing = map.get(key)
        const val = Number(r.importe_total) || 0

        if (existing) {
          existing.traficoCount++
          existing.totalValue += val
          existing.traficos.push(r)
          if (r.fecha_llegada && (!existing.lastDate || r.fecha_llegada > existing.lastDate)) {
            existing.lastDate = r.fecha_llegada
          }
          if (!existing.country && r.pais_procedencia) {
            existing.country = r.pais_procedencia
          }
        } else {
          map.set(key, {
            name,
            country: r.pais_procedencia ?? null,
            traficoCount: 1,
            totalValue: val,
            lastDate: r.fecha_llegada ?? null,
            avgValue: 0,
            traficos: [r],
            docCompliance: 0,
            avgDeliveryDays: 0,
            tmecRate: 0,
            riskLevel: 'watch',
            firstDate: r.fecha_llegada ?? null,
          })
        }
      }
    }

    // Compute enhanced metrics
    const arr = Array.from(map.values())
    arr.forEach(s => {
      s.avgValue = s.traficoCount > 0 ? s.totalValue / s.traficoCount : 0
      const withPed = s.traficos.filter(t => !!t.pedimento).length
      s.docCompliance = s.traficoCount > 0 ? Math.round((withPed / s.traficoCount) * 100) : 0
      const withBoth = s.traficos.filter(t => t.fecha_llegada && (t as Record<string, unknown>).fecha_cruce)
      if (withBoth.length > 0) {
        const totalDays = withBoth.reduce((sum, t) => {
          // Use America/Chicago timezone for date comparison per CRUZ domain rules
          const cruceStr = String((t as Record<string, unknown>).fecha_cruce)
          const llegadaStr = String(t.fecha_llegada)
          const cruceDate = new Date(cruceStr + (cruceStr.includes('T') ? '' : 'T12:00:00-06:00'))
          const llegadaDate = new Date(llegadaStr + (llegadaStr.includes('T') ? '' : 'T12:00:00-06:00'))
          const d = (cruceDate.getTime() - llegadaDate.getTime()) / 86400000
          return sum + Math.max(0, d)
        }, 0)
        s.avgDeliveryDays = Math.round((totalDays / withBoth.length) * 10) / 10
      } else {
        s.avgDeliveryDays = 0
      }
      const tmec = s.traficos.filter(t => {
        const reg = ((t as Record<string, unknown>).regimen as string || '').toUpperCase()
        return reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
      }).length
      s.tmecRate = s.traficoCount > 0 ? Math.round((tmec / s.traficoCount) * 100) : 0
      const dates = s.traficos.map(t => t.fecha_llegada).filter(Boolean).sort()
      s.firstDate = dates.length > 0 ? dates[0]! : null
      if (s.traficoCount < 5) s.riskLevel = 'watch'
      else if (s.docCompliance < 80) s.riskLevel = 'high'
      else if (s.avgDeliveryDays > 10) s.riskLevel = 'medium'
      else s.riskLevel = 'low'
    })
    arr.sort((a, b) => b.totalValue - a.totalValue)
    return arr
  }, [rows, clientFilter, supplierLookup])

  // Filter by search + sort
  const filtered = useMemo(() => {
    let result = suppliers
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.country ?? '').toLowerCase().includes(q)
      )
    }
    const sorted = [...result]
    if (sortBy === 'value') sorted.sort((a, b) => b.totalValue - a.totalValue)
    else if (sortBy === 'traficos') sorted.sort((a, b) => b.traficoCount - a.traficoCount)
    else if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return sorted
  }, [suppliers, search, sortBy])

  const totalValue = useMemo(() => suppliers.reduce((s, r) => s + r.totalValue, 0), [suppliers])
  const totalTraficoCount = useMemo(() => new Set(suppliers.flatMap(s => s.traficos.map(t => t.trafico))).size, [suppliers])

  return (
    <div style={{ minHeight: '100vh', background: T.bg, margin: -36, padding: 36 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>
            Proveedores
          </h1>
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
            {suppliers.length} proveedores &middot; {fmtUSDCompact(totalValue)} valor total
          </p>
        </div>
      </div>

      {/* KPI strip */}
      {!loading && suppliers.length > 0 && (
        <SupplierKPIs
          supplierCount={suppliers.length}
          traficoCount={totalTraficoCount}
          totalValue={totalValue}
          isMobile={isMobile}
        />
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: '0 12px', height: 60, flex: 1, maxWidth: 360, minWidth: 180,
        }}>
          <Search size={14} style={{ color: T.textMuted }} />
          <input
            placeholder="Buscar proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar proveedores"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: T.text, fontSize: 13, fontFamily: 'var(--font-geist-sans)',
            }}
          />
        </div>

        {isInternal && clientIds.length > 1 && (
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '0 12px', height: 60, color: T.text, fontSize: 13,
              fontFamily: 'var(--font-geist-sans)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">Todos los clientes</option>
            {clientIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => {
            const csvData = filtered.map(s => ({
              Proveedor: s.name,
              'País': s.country ?? '',
              'Embarques': s.traficoCount,
              'Valor USD': s.totalValue.toFixed(2),
              'T-MEC %': s.tmecRate,
              'Entrega Promedio': s.avgDeliveryDays,
            }))
            downloadCSV(csvData, 'proveedores')
          }}
          disabled={filtered.length === 0}
          style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '0 16px', height: 60, color: T.textSecondary, fontSize: 13,
            fontFamily: 'var(--font-geist-sans)', cursor: filtered.length > 0 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: filtered.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={14} />
          CSV
        </button>
      </div>

      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { key: 'value' as const, label: 'Valor' },
          { key: 'traficos' as const, label: 'Embarques' },
          { key: 'name' as const, label: 'Nombre' },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              background: sortBy === opt.key ? 'var(--gold, #E8EAED)' : T.surface,
              color: sortBy === opt.key ? '#FFFFFF' : T.textSecondary,
              border: `1px solid ${sortBy === opt.key ? 'var(--gold, #E8EAED)' : T.border}`,
              borderRadius: 8, padding: '0 14px', height: 36,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            <ArrowUpDown size={12} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <SupplierTable
        filtered={filtered}
        expandedSupplier={expandedSupplier}
        onToggleExpand={setExpandedSupplier}
        isMobile={isMobile}
        search={search}
        loading={loading}
      />
    </div>
  )
}
