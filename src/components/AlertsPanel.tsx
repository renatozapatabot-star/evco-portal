'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Clock, RefreshCw, Shield, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { daysUntilMVE } from '@/lib/compliance-dates'

interface Alert { id: string; severity: 'red' | 'yellow' | 'blue' | 'green'; label: string; count: number; href: string }
const ICON_MAP = { red: AlertTriangle, yellow: Clock, blue: RefreshCw, green: CheckCircle }
const CLS_MAP = { red: 'a-red', yellow: 'a-amber', blue: 'a-blue', green: 'a-green' }

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [collapsed, setCollapsed] = useState(true)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const isDashboard = pathname === '/'

  useEffect(() => { if (isDashboard) setCollapsed(false) }, [isDashboard])

  useEffect(() => {
    async function load() {
      try {
        const companyId = getCompanyIdCookie()
        const clientClave = getClientClaveCookie()
        const [trafRes, entRes] = await Promise.all([
          fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
          fetch(`/api/data?table=entradas&cve_cliente=${clientClave}&limit=5000&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
        ])
        const traf = trafRes.data || []; const ent = entRes.data || []; const now = Date.now()
        const mveDays = daysUntilMVE()
        const a: Alert[] = []
        if (mveDays <= 30) a.push({ id: 'mve', severity: mveDays <= 7 ? 'red' : 'yellow', label: `MVE: ${mveDays} días restantes`, count: mveDays, href: '/mve' })
        const rojo = traf.filter((t: { semaforo?: number | null }) => Number(t.semaforo) === 2)
        if (rojo.length > 0) a.push({ id: 'rojo', severity: 'red', label: 'Semáforo Rojo', count: rojo.length, href: '/traficos' })
        const damaged = ent.filter((e: { mercancia_danada?: boolean | null; fecha_llegada_mercancia?: string | null }) => e.mercancia_danada && e.fecha_llegada_mercancia && (now - new Date(e.fecha_llegada_mercancia).getTime()) < 30 * 86400000)
        if (damaged.length > 0) a.push({ id: 'danos', severity: 'yellow', label: 'Mercancía con daños', count: damaged.length, href: '/entradas' })
        const overdue = traf.filter((t: { fecha_llegada?: string | null; estatus?: string | null }) => t.fecha_llegada && !(t.estatus || '').toLowerCase().includes('cruz') && (now - new Date(t.fecha_llegada).getTime()) > 7 * 86400000)
        if (overdue.length > 0) a.push({ id: 'overdue', severity: 'yellow', label: 'Overdue +7d', count: overdue.length, href: '/traficos' })
        a.sort((x, y) => (x.severity === 'red' ? 0 : 1) - (y.severity === 'red' ? 0 : 1))
        setAlerts(a)
      } catch {} setLoading(false)
    }
    load()
  }, [])

  if (loading || alerts.length === 0) return null
  const redCount = alerts.filter(a => a.severity === 'red').length

  return (
    <div className="alerts-strip">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: collapsed ? 0 : 8 }} onClick={() => setCollapsed(c => !c)}>
        <span style={{ fontSize: 13, color: 'var(--amber-700)' }}>
          ⚠ {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}{redCount > 0 && <span style={{ color: 'var(--status-red)', fontWeight: 600 }}> &middot; {redCount} crítica{redCount !== 1 ? 's' : ''}</span>}
        </span>
        {collapsed ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} />}
      </div>
      {!collapsed && alerts.map(a => {
        const Icon = ICON_MAP[a.severity]
        return (
          <Link key={a.id} href={a.href} style={{ textDecoration: 'none' }}>
            <div className={`alert-tag ${CLS_MAP[a.severity]}`}>
              <Icon size={14} /> {a.label} {a.severity !== 'green' && <span className="mono" style={{ fontWeight: 600 }}>{a.count}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500 }}>Ver &rarr;</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
