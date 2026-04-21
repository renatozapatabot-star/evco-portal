'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, Package, ShieldAlert } from 'lucide-react'
import { calculateCruzScore, extractScoreInput } from '@/lib/cruz-score'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateShort } from '@/lib/format-utils'

interface Alert {
  id: string
  severity: 'critica' | 'atención' | 'info'
  icon: 'alert' | 'clock' | 'package' | 'shield'
  title: string
  sub: string
  href: string
  time: string
  resolved: boolean
}

const ICONS = {
  alert: AlertTriangle,
  clock: Clock,
  package: Package,
  shield: ShieldAlert,
}

const SEV_STYLE = {
  critica: { bg: 'var(--danger-bg)', border: 'rgba(220,38,38,0.2)', dot: 'var(--danger-500)', label: 'Críticas' },
  atención: { bg: 'var(--warning-bg)', border: 'rgba(217,119,6,0.2)', dot: 'var(--warning-500, #D97706)', label: 'Atención' },
  info: { bg: 'var(--n-50)', border: 'var(--n-150)', dot: 'var(--gold-500)', label: 'Informativas' },
}

interface TraficoData { trafico: string; estatus?: string; pedimento?: string; fecha_llegada?: string; fecha_cruce?: string; descripcion_mercancia?: string; [key: string]: unknown }
interface EntradaData { cve_entrada: string; fecha_llegada_mercancia?: string; mercancia_danada?: boolean; tiene_faltantes?: boolean; [key: string]: unknown }

export default function AlertasPage() {
  const isMobile = useIsMobile()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pendientes' | 'resueltas'>('pendientes')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        // 15-day window
        const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0]

        const companyId = getCompanyIdCookie()
        const clientClave = getClientClaveCookie()
        const [trafRes, entRes] = await Promise.all([
          fetch(`/api/data?table=traficos&company_id=${companyId}&limit=500&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
          fetch(`/api/data?table=entradas&cve_cliente=${clientClave}&limit=200&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
        ])
        const traf = ((trafRes.data ?? []) as TraficoData[]).filter((t) =>
          t.fecha_llegada && t.fecha_llegada >= fifteenDaysAgo
        )
        const ent = ((entRes.data ?? []) as EntradaData[]).filter((e) =>
          e.fecha_llegada_mercancia && e.fecha_llegada_mercancia >= fifteenDaysAgo
        )
        const items: Alert[] = []

        // Score < 50 + En Proceso → critical (NO MVE alerts)
        traf.filter((t) => {
          if ((t.estatus || '').toLowerCase().includes('cruz')) return false
          return calculateCruzScore(extractScoreInput(t as unknown as Parameters<typeof extractScoreInput>[0])) < 50
        }).slice(0, 8).forEach((t) => {
          const score = calculateCruzScore(extractScoreInput(t as unknown as Parameters<typeof extractScoreInput>[0]))
          items.push({
            id: `score-${t.trafico}`, severity: 'critica', icon: 'shield',
            title: `Score ${score} — ${t.trafico}`,
            sub: 'Requiere atención inmediata',
            href: `/embarques/${encodeURIComponent(t.trafico)}`,
            time: t.fecha_llegada || '',
            resolved: false,
          })
        })

        // En Proceso > 48 hours → warning
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
        traf.filter((t) => {
          if ((t.estatus || '').toLowerCase().includes('cruz')) return false
          return t.fecha_llegada && t.fecha_llegada < twoDaysAgo
        }).slice(0, 6).forEach((t) => {
          const days = Math.floor((Date.now() - new Date(t.fecha_llegada!).getTime()) / 86400000)
          items.push({
            id: `slow-${t.trafico}`, severity: 'atención', icon: 'clock',
            title: `${days}d en proceso — ${t.trafico}`,
            sub: t.descripcion_mercancia?.slice(0, 50) || 'Sin descripción',
            href: `/embarques/${encodeURIComponent(t.trafico)}`,
            time: t.fecha_llegada || '',
            resolved: false,
          })
        })

        // Entradas with incidencias → warning
        ent.filter((e) => e.mercancia_danada || e.tiene_faltantes).slice(0, 5).forEach((e) => {
          items.push({
            id: `inc-${e.cve_entrada}`, severity: 'atención', icon: 'alert',
            title: `Incidencia — ${e.cve_entrada}`,
            sub: e.mercancia_danada ? 'Mercancía dañada' : 'Faltantes reportados',
            href: `/entradas/${e.cve_entrada}`,
            time: e.fecha_llegada_mercancia || '',
            resolved: false,
          })
        })

        // Crossed traficos in last 15 days → resolved
        traf.filter((t) => (t.estatus || '').toLowerCase().includes('cruz'))
          .slice(0, 10).forEach((t) => {
            items.push({
              id: `done-${t.trafico}`, severity: 'info', icon: 'package',
              title: `Cruzado — ${t.trafico}`,
              sub: t.descripcion_mercancia?.slice(0, 50) || 'Operación completada',
              href: `/embarques/${encodeURIComponent(t.trafico)}`,
              time: t.fecha_cruce || t.fecha_llegada || '',
              resolved: true,
            })
          })

        // Deduplicate
        const seen = new Set<string>()
        setAlerts(items.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true }))
      } catch (e) { console.error('[alertas] load failed:', (e as Error).message) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = alerts.filter(a => tab === 'pendientes' ? !a.resolved : a.resolved)

  const fmtTime = (d: string) => fmtDateShort(d)

  return (
    <div className="p-6">
      <h1 className="page-title">Alertas del Día</h1>
      <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: 'var(--n-400)' }}>
        Últimos 15 días · {filtered.length} {tab === 'pendientes' ? 'pendiente' : 'resuelta'}{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--n-50)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {(['pendientes', 'resueltas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t ? 'rgba(192,197,206,0.15)' : 'transparent',
            color: tab === t ? 'var(--n-900)' : 'var(--n-400)',
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {t === 'pendientes' ? 'Pendientes' : 'Resueltas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r-lg)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: 'var(--success)', marginBottom: 12 }} />
          <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--success)' }}>Todo en orden</div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--n-400)', marginTop: 4 }}>Últimos 15 días</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(a => {
            const sStyle = SEV_STYLE[a.severity]
            const Icon = ICONS[a.icon]
            return (
              <div key={a.id} onClick={() => router.push(a.href)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                  background: sStyle.bg, border: `1px solid ${sStyle.border}`, borderRadius: 'var(--r-lg)',
                  cursor: 'pointer', borderLeft: `3px solid ${sStyle.dot}`,
                  opacity: a.resolved ? 0.7 : 1,
                }}>
                <Icon size={16} style={{ color: sStyle.dot, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 4 : 0 }}>
                    <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--n-900)' }}>{a.title}</span>
                    <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--n-400)', flexShrink: 0, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtTime(a.time)}</span>
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--n-500)', marginTop: 2 }}>{a.sub}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
