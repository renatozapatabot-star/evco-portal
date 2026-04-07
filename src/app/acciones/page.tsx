'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, FileText, CheckCircle2, ChevronRight, Truck, Package } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { fmtId, fmtDate, formatAbsoluteETA } from '@/lib/format-utils'
import { daysUntilMVE } from '@/lib/compliance-dates'
import { useToast } from '@/components/Toast'

function getGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
}

export default function AccionesPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const { toast } = useToast()
  const [traficos, setTraficos] = useState<any[]>([])
  const [entradas, setEntradas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState<Set<string>>(new Set())
  const mveDays = daysUntilMVE()

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clientClave = getClientClaveCookie()
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=2000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=entradas&cve_cliente=${clientClave}&limit=500&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
    ]).then(([t, e]) => {
      setTraficos(t.data ?? [])
      setEntradas(e.data ?? [])
    }).catch((err: unknown) => { void 0 }).finally(() => setLoading(false))
  }, [])

  const actions = useMemo(() => {
    const now = Date.now()
    const urgent: any[] = []
    const today: any[] = []
    const week: any[] = []

    // MVE pending
    const mvePending = traficos.filter(t => (t.estatus || '').toLowerCase().includes('proceso') && !t.pedimento)
    if (mvePending.length > 0) {
      urgent.push({ id: 'mve', icon: AlertTriangle, color: 'var(--danger)', label: `${mvePending.length} tráficos sin folio MVE`, sub: `Deadline: ${mveDays}d restantes`, href: '/mve' })
    }

    // Overdue >7d
    const overdue = traficos.filter(t => {
      if (!t.fecha_llegada || (t.estatus ?? '').toLowerCase().includes('cruz')) return false
      return (now - new Date(t.fecha_llegada).getTime()) / 86400000 > 7
    })
    if (overdue.length > 0) {
      urgent.push({ id: 'overdue', icon: Clock, color: 'var(--warning)', label: `${overdue.length} tráficos vencidos +7d`, sub: 'Requieren seguimiento urgente', href: '/traficos' })
    }

    // Damaged entries
    const damaged = entradas.filter((e: any) => e.mercancia_danada || e.tiene_faltantes)
    if (damaged.length > 0) {
      urgent.push({ id: 'danos', icon: Package, color: 'var(--danger)', label: `${damaged.length} entradas con incidencia`, sub: 'Mercancía dañada o faltante', href: '/entradas' })
    }

    // Recent arrivals (today/yesterday)
    const recentArrivals = traficos.filter(t => {
      if (!t.fecha_llegada) return false
      const daysAgo = (now - new Date(t.fecha_llegada).getTime()) / 86400000
      return daysAgo <= 1 && !(t.estatus ?? '').toLowerCase().includes('cruz')
    })
    recentArrivals.slice(0, 5).forEach(t => {
      today.push({ id: `arr-${t.trafico}`, icon: Truck, color: 'var(--info)', label: fmtId(t.trafico), sub: `Llegada: ${formatAbsoluteETA(t.fecha_llegada)}`, href: `/traficos/${encodeURIComponent(t.trafico)}` })
    })

    // Missing pedimentos (this week)
    const noPedimento = traficos.filter(t => !(t.estatus ?? '').toLowerCase().includes('cruz') && !t.pedimento).slice(0, 5)
    noPedimento.forEach(t => {
      week.push({ id: `ped-${t.trafico}`, icon: FileText, color: 'var(--warning)', label: `${fmtId(t.trafico)} — sin pedimento`, sub: fmtDate(t.fecha_llegada), href: `/traficos/${encodeURIComponent(t.trafico)}` })
    })

    return { urgent, today, week }
  }, [traficos, entradas, mveDays])

  const markDone = (id: string) => {
    setDone(prev => new Set(prev).add(id))
    toast('Marcado como completado', 'success')
  }

  const total = actions.urgent.length + actions.today.length + actions.week.length
  const doneCount = done.size

  const todayStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Chicago' })

  return (
    <div className="acciones-page" style={{ padding: isMobile ? '16px 12px' : '24px 16px' }}>
      <div className="acc-header">
        <h1 className="acc-greeting">{getGreeting()}, Renato</h1>
        <div className="acc-date">{todayStr}</div>
      </div>

      {actions.urgent.length > 0 && (
        <div className="acc-urgency-banner">
          <span className="acc-urgency-dot" />
          {actions.urgent.length} acción{actions.urgent.length !== 1 ? 'es' : ''} urgente{actions.urgent.length !== 1 ? 's' : ''}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--r-lg)' }} />)}
        </div>
      )}

      {!loading && total === 0 && (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <div className="empty-icon" style={{ background: 'var(--success-bg)', border: '1px solid var(--success-b)' }}>
            <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
          </div>
          <p className="empty-title">Todo al día</p>
          <p className="empty-desc">No hay acciones pendientes. Buen trabajo.</p>
        </div>
      )}

      {!loading && actions.urgent.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-header">
            <span className="acc-section-dot" style={{ background: 'var(--danger)' }} />
            <span className="acc-section-title" style={{ color: 'var(--danger-t)' }}>Urgente</span>
          </div>
          {actions.urgent.filter(a => !done.has(a.id)).map(a => (
            <div key={a.id} className="acc-card" onClick={() => router.push(a.href)}>
              <span className="acc-card-icon"><a.icon size={18} style={{ color: a.color }} /></span>
              <div className="acc-card-text">
                <span className="acc-card-label">{a.label}</span>
                <span className="acc-card-sub">{a.sub}</span>
              </div>
              <div className="acc-card-actions">
                <button className="acc-check" onClick={e => { e.stopPropagation(); markDone(a.id) }}><CheckCircle2 size={16} /></button>
                <ChevronRight size={16} className="acc-card-arrow" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && actions.today.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-header">
            <span className="acc-section-dot" style={{ background: 'var(--info)' }} />
            <span className="acc-section-title" style={{ color: 'var(--info-t)' }}>Hoy</span>
          </div>
          {actions.today.filter(a => !done.has(a.id)).map(a => (
            <div key={a.id} className="acc-card" onClick={() => router.push(a.href)}>
              <span className="acc-card-icon"><a.icon size={18} style={{ color: a.color }} /></span>
              <div className="acc-card-text">
                <span className="acc-card-label">{a.label}</span>
                <span className="acc-card-sub">{a.sub}</span>
              </div>
              <div className="acc-card-actions">
                <button className="acc-check" onClick={e => { e.stopPropagation(); markDone(a.id) }}><CheckCircle2 size={16} /></button>
                <ChevronRight size={16} className="acc-card-arrow" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && actions.week.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-header">
            <span className="acc-section-dot" style={{ background: 'var(--warning)' }} />
            <span className="acc-section-title" style={{ color: 'var(--warning-t)' }}>Esta Semana</span>
          </div>
          {actions.week.filter(a => !done.has(a.id)).map(a => (
            <div key={a.id} className="acc-card" onClick={() => router.push(a.href)}>
              <span className="acc-card-icon"><a.icon size={18} style={{ color: a.color }} /></span>
              <div className="acc-card-text">
                <span className="acc-card-label">{a.label}</span>
                <span className="acc-card-sub">{a.sub}</span>
              </div>
              <div className="acc-card-actions">
                <button className="acc-check" onClick={e => { e.stopPropagation(); markDone(a.id) }}><CheckCircle2 size={16} /></button>
                <ChevronRight size={16} className="acc-card-arrow" />
              </div>
            </div>
          ))}
        </div>
      )}

      {doneCount > 0 && (
        <div className="acc-done-count">
          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
          {doneCount} completada{doneCount !== 1 ? 's' : ''} hoy
        </div>
      )}
    </div>
  )
}
