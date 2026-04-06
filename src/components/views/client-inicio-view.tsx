'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { calculateTmecSavings } from '@/lib/tmec-savings'
import { computeStreak } from '@/lib/achievements'
import { playSound } from '@/lib/sounds'
import { Celebrate } from '@/components/celebrate'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { useSessionCache } from '@/hooks/use-session-cache'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  importe_total: number | null; pedimento: string | null
  descripcion_mercancia: string | null; fecha_cruce: string | null
  peso_bruto: number | null; company_id: string | null
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
    traficos.filter(t => {
      const s = (t.estatus || '').toLowerCase()
      return !s.includes('cruz') && !s.includes('entreg') && !s.includes('complet')
    }).length, [traficos])

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
    const stages = [
      { key: 'proceso', label: 'En Proceso', count: 0, color: 'var(--warning-500, #D97706)', href: '/traficos?estatus=En+Proceso' },
      { key: 'pagado', label: 'Pagado', count: 0, color: 'var(--info, #2563EB)', href: '/traficos?estatus=Pagado' },
      { key: 'cruzado', label: 'Cruzado', count: 0, color: 'var(--success)', href: '/traficos?estatus=Cruzado' },
    ]
    for (const t of traficos) {
      const s = (t.estatus || '').toLowerCase()
      if (s.includes('cruz')) stages[2].count++
      else if (s.includes('pagado')) stages[1].count++
      else stages[0].count++
    }
    return stages
  }, [traficos])

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

  return (
    <div className="page-shell" style={{ maxWidth: 960 }}>

      {/* Realtime toast */}
      {realtimeToast && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: 'var(--bg-card)', fontSize: 13, fontWeight: 600,
          marginBottom: 16, animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: '32px 20px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {dateStr}
        </div>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
          {attentionItems.length === 0 ? 'Todo en orden.' : `${attentionItems.length} pendiente${attentionItems.length !== 1 ? 's' : ''}.`}
        </h1>
      </div>

      {/* ── PIPELINE (TMS view) ── */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 8 }}>
        {pipeline.map(stage => (
          <Link key={stage.key} href={stage.href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{
              padding: '16px 12px', borderRadius: 12, textAlign: 'center',
              background: 'var(--bg-card)', border: `1px solid ${stage.count > 0 ? stage.color : 'var(--border)'}`,
              borderTop: `3px solid ${stage.count > 0 ? stage.color : 'var(--border)'}`,
              transition: 'border-color 150ms',
            }}>
              <div style={{
                fontSize: isMobile ? 24 : 32, fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: stage.count > 0 ? stage.color : 'var(--text-muted)',
              }}>
                {stage.count}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stage.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── ATTENTION ITEMS ── */}
      {attentionItems.length > 0 && (
        <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attentionItems.map(item => (
            <Link key={item.key} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: item.severity === 'red' ? 'rgba(220,38,38,0.04)' : 'rgba(217,119,6,0.04)',
                border: `1px solid ${item.severity === 'red' ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)'}`,
                fontSize: 13, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 12 }}>{item.severity === 'red' ? '🔴' : '🟡'}</span>
                {item.text}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── RECENT CROSSINGS ── */}
      {recentCrossings.length > 0 && (
        <div style={{ padding: '8px 20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Últimos cruces
          </div>
          {recentCrossings.slice(0, 4).map(t => (
            <Link key={t.trafico} href={`/traficos/${encodeURIComponent(t.trafico)}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{t.trafico}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {t.importe_total && <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{fmtUSDCompact(t.importe_total)}</span>}
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtDate(t.fecha_cruce)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── VALUE CARD ── */}
      {(tmecSavings.totalSavings > 0 || sinIncidencia > 0) && (
        <div style={{
          margin: '8px 20px 16px', padding: '20px 24px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(196,150,60,0.06) 0%, rgba(196,150,60,0.02) 100%)',
          border: '1px solid rgba(196,150,60,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold-dark)' }}>
                {fmtUSDCompact(tmecSavings.totalSavings)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ahorro T-MEC</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {fmtUSDCompact(valorTotal)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Importado YTD</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                {sinIncidencia}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exitosas</div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER LINK ── */}
      <div style={{ textAlign: 'center', padding: '8px 20px 40px' }}>
        <Link href="/traficos" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)', textDecoration: 'none' }}>
          Ver todas las operaciones →
        </Link>
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
