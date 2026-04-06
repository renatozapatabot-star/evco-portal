'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { fmtDate, fmtDateCompact, fmtUSDCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { calculateTmecSavings } from '@/lib/tmec-savings'
import { computeStreak } from '@/lib/achievements'
import { playSound } from '@/lib/sounds'
import { Celebrate } from '@/components/celebrate'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { useSessionCache } from '@/hooks/use-session-cache'
import { Truck, FolderOpen, DollarSign, MessageSquare, ChevronRight } from 'lucide-react'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  importe_total: number | null; pedimento: string | null
  descripcion_mercancia: string | null; fecha_cruce: string | null
  peso_bruto: number | null; company_id: string | null
  updated_at: string | null
  [k: string]: unknown
}

interface EntradaPending {
  id: number; cve_entrada: string; created_at?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
}

export default function ClientInicioView() {
  const isMobile = useIsMobile()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [pendingEntradas, setPendingEntradas] = useState<EntradaPending[]>([])
  const [streakDays, setStreakDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const { lastUpdate } = useRealtimeTrafico()
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null)
  const { getCached, setCache, endRefresh, startRefresh } = useSessionCache()

  // Show toast on realtime status change
  useEffect(() => {
    if (lastUpdate) {
      const isCrossed = lastUpdate.estatus.toLowerCase().includes('cruz')
      setRealtimeToast(isCrossed
        ? `${lastUpdate.trafico} acaba de cruzar. Todo en orden.`
        : `${lastUpdate.trafico}: ${lastUpdate.estatus}`)
      if (isCrossed) playSound('success')
      const t = setTimeout(() => setRealtimeToast(null), 5000)
      return () => clearTimeout(t)
    }
  }, [lastUpdate])

  function loadData() {
    const companyId = getCompanyIdCookie()
    const name = getClientNameCookie()
    setCompanyName(name || '')

    // Streak fetch (fire-and-forget, lightweight)
    if (companyId) {
      const streakParams = new URLSearchParams({
        table: 'entradas', limit: '50', company_id: companyId,
        order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      })
      fetch(`/api/data?${streakParams}`).then(r => r.json())
        .then(d => setStreakDays(computeStreak(d.data || []).days))
        .catch(() => {})
    }

    // Try session cache first
    const cached = getCached<{ traficos: TraficoRow[]; entradas: EntradaPending[] }>('dashboard')
    if (cached) {
      setTraficos(cached.traficos)
      setPendingEntradas(cached.entradas)
      setLoading(false)
      startRefresh()
    } else {
      setLoading(true)
    }
    setError(null)

    const trafParams = new URLSearchParams({
      table: 'traficos', limit: '5000', company_id: companyId || '',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
      order_by: 'fecha_llegada', order_dir: 'desc',
    })
    const entParams = new URLSearchParams({
      table: 'entradas', limit: '20', company_id: companyId || '',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
    })

    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch(`/api/data?${entParams}`).then(r => r.json()),
    ])
      .then(([trafData, entData]) => {
        const allT: TraficoRow[] = trafData.data ?? []
        const ents: EntradaPending[] = (entData.data ?? []).filter(
          (e: Record<string, unknown>) => !e.trafico
        ).slice(0, 20)

        setTraficos(allT)
        setPendingEntradas(ents)
        setCache('dashboard', { traficos: allT, entradas: ents })
      })
      .catch(() => setError('No se pudo cargar el dashboard. Reintentar.'))
      .finally(() => {
        setLoading(false); endRefresh()
        if (typeof window !== 'undefined') localStorage.setItem('cruz-last-visit', new Date().toISOString())
      })
  }

  useEffect(() => { loadData() }, [])

  // ── KPI calculations ──
  const enProceso = useMemo(() =>
    traficos.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length, [traficos])

  const cruzadoRecent = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    return traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') &&
      t.fecha_cruce && t.fecha_cruce >= cutoff
    ).length
  }, [traficos])

  const valorTotal = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`
    return traficos
      .filter(t => (t.fecha_llegada || '') >= yearStart)
      .reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  }, [traficos])

  const incidencias = useMemo(() => {
    return traficos.filter(t => {
      if (t.pedimento) return false
      const s = (t.estatus || '').toLowerCase()
      if (s.includes('cruz') || s.includes('complet')) return false
      if (!t.fecha_llegada) return false
      return (Date.now() - new Date(t.fecha_llegada).getTime()) > 7 * 86400000
    }).length
  }, [traficos])

  const sinIncidencia = useMemo(() => {
    if (traficos.length === 0) return 0
    const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
    return cruzados.length > 0 ? Math.round((cruzados.length / traficos.length) * 100) : 0
  }, [traficos])

  const tmecSavings = useMemo(() => calculateTmecSavings(traficos), [traficos])

  // ── Pipeline stages (TMS view) ──
  const pipeline = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const pagadoCount = traficos.filter(t => (t.estatus || '').toLowerCase().includes('pagado')).length
    const cruzadoWeek = traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && t.fecha_cruce >= weekAgo
    ).length

    return [
      { key: 'proceso', label: 'En Proceso', count: enProceso, color: 'var(--warning-500, #D97706)', href: '/traficos?estatus=En+Proceso' },
      { key: 'pagado', label: 'Pagado', count: pagadoCount, color: 'var(--info, #2563EB)', href: '/traficos?estatus=Pagado' },
      { key: 'cruzado', label: 'Cruzado (7d)', count: cruzadoWeek, color: 'var(--success)', href: '/traficos?estatus=Cruzado' },
    ]
  }, [traficos, enProceso])

  // ── Attention items (only things that need action) ──
  const attentionItems = useMemo(() => {
    const items: { key: string; text: string; href: string; severity: 'red' | 'amber' }[] = []

    // Tráficos without pedimento > 7 days
    if (incidencias > 0) {
      items.push({ key: 'no-ped', text: `${incidencias} sin pedimento > 7 días`, href: '/traficos', severity: 'red' })
    }

    // Pending entradas
    if (pendingEntradas.length > 0) {
      items.push({ key: 'entradas', text: `${pendingEntradas.length} entrada${pendingEntradas.length !== 1 ? 's' : ''} sin tráfico`, href: '/entradas', severity: 'amber' })
    }

    return items.slice(0, 3)
  }, [incidencias, pendingEntradas])

  // ── Recent crossings ──
  const recentCrossings = useMemo(() => {
    return traficos
      .filter(t => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce)
      .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
      .slice(0, 5)
  }, [traficos])

  // ── Recent activity (last 5 status changes) ──
  const recentActivity = useMemo(() => {
    return traficos
      .filter(t => t.updated_at)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 5)
  }, [traficos])

  // ── Date string (hydration-safe) ──
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    setDateStr(fmtDate(new Date()))
  }, [])

  // ── Results cards ──
  const results = useMemo(() => {
    const cards: { key: string; value: string; label: string; color: string; href: string }[] = [
      {
        key: 'cruzados',
        value: String(cruzadoRecent),
        label: 'cruzaron (7d)',
        color: 'var(--success)',
        href: '/traficos?estatus=Cruzado',
      },
      {
        key: 'importado',
        value: fmtUSDCompact(valorTotal),
        label: 'importado YTD',
        color: 'var(--gold-dark)',
        href: '/reportes',
      },
      {
        key: 'incidencias',
        value: String(incidencias),
        label: 'incidencias',
        color: incidencias === 0 ? 'var(--success)' : 'var(--danger-500)',
        href: '/traficos',
      },
    ]
    if (streakDays > 0) {
      cards.push({
        key: 'streak',
        value: `${streakDays}d`,
        label: 'racha sin incidencia',
        color: 'var(--gold-dark)',
        href: '/traficos',
      })
    }
    return cards
  }, [cruzadoRecent, valorTotal, incidencias, streakDays])

  // ── Error / Loading states ──
  if (error) {
    return (
      <div className="page-shell" style={{ maxWidth: 960 }}>
        <ErrorCard message={error} onRetry={loadData} />
      </div>
    )
  }

  if (loading) {
    return <DashboardSkeleton isMobile={isMobile} />
  }

  // Card subtitles — calm, one thing per section
  const opsSubtitle = enProceso === 0 ? 'Todo en orden' : `${enProceso} en proceso`
  const docsSubtitle = 'Todo al día'
  const contaSubtitle = '0 pendientes'

  const navCards = [
    { href: '/traficos', label: 'Operaciones', subtitle: opsSubtitle, Icon: Truck, color: enProceso > 0 ? 'var(--gold)' : 'var(--success)' },
    { href: '/documentos', label: 'Documentos', subtitle: docsSubtitle, Icon: FolderOpen, color: 'var(--success)' },
    { href: '/financiero', label: 'Contabilidad', subtitle: contaSubtitle, Icon: DollarSign, color: 'var(--success)' },
  ]

  return (
    <div className="page-shell" style={{ maxWidth: 700 }}>

      {/* Realtime toast */}
      {realtimeToast && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          marginBottom: 16, animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* ── DATE HEADER ── */}
      <div style={{ padding: isMobile ? '24px 20px 16px' : '32px 20px 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)' }}>
          {dateStr}
        </p>
      </div>

      {/* ── NAVIGATION CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 12,
        padding: '0 20px',
      }}>
        {navCards.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: isMobile ? '24px 28px' : '32px 28px',
              borderRadius: 16,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              transition: 'border-color 150ms, box-shadow 150ms',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: isMobile ? 'center' : 'flex-start',
              gap: isMobile ? 16 : 12,
              minHeight: isMobile ? 72 : 130,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,150,60,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <card.Icon size={32} strokeWidth={1.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 14, color: card.color, fontWeight: 600, marginTop: 4 }}>
                  {card.subtitle}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── CRUZ AI ── */}
      <div style={{ padding: '16px 20px 0' }}>
        <Link href="/cruz" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '20px 24px',
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--gold)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            cursor: 'pointer',
            transition: 'border-color 150ms, box-shadow 150ms',
            minHeight: 64,
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,150,60,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <MessageSquare size={24} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                CRUZ AI
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Consulta operaciones, clasifica, o calcula
              </div>
            </div>
            <ChevronRight size={20} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </Link>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Actividad reciente
        </div>
        {recentActivity.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
            Sin actividad reciente
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentActivity.map(t => {
              const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
              return (
                <Link
                  key={t.trafico}
                  href={`/traficos/${encodeURIComponent(t.trafico)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: isCruzado ? 'var(--success)' : 'var(--gold)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.trafico}: {t.estatus || 'En proceso'}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                    {t.updated_at ? fmtDateCompact(t.updated_at) : ''}
                  </span>
                </Link>
              )
            })}
            <Link
              href="/actividad"
              style={{ fontSize: 13, color: 'var(--gold-dark, #8B6914)', fontWeight: 600, padding: '8px 12px', textDecoration: 'none' }}
            >
              Ver toda la actividad &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', padding: '40px 20px 60px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Renato Zapata & Company · Patente 3596
        </div>
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
