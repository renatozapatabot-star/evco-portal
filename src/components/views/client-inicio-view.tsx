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

  // ── Predictions ──
  const predictions = useMemo(() => {
    const preds: { key: string; text: string; href: string }[] = []

    // Active traficos that might cross soon
    const active = traficos.filter(t => {
      const s = (t.estatus || '').toLowerCase()
      return !s.includes('cruz') && !s.includes('entreg') && !s.includes('complet')
    }).slice(0, 2)

    active.forEach(t => {
      preds.push({
        key: `cross-${t.trafico}`,
        text: `${t.trafico} en proceso — pendiente de cruce`,
        href: `/traficos/${encodeURIComponent(t.trafico)}`,
      })
    })

    // Missing docs
    if (pendingEntradas.length > 0) {
      preds.push({
        key: 'docs-pending',
        text: `${pendingEntradas.length} entrada${pendingEntradas.length !== 1 ? 's' : ''} sin trafico asignado`,
        href: '/entradas',
      })
    }

    return preds.slice(0, 3)
  }, [traficos, pendingEntradas])

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

      {/* SECTION 1 — The Answer */}
      <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
        {enProceso === 0 ? (
          <div style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 800,
            color: 'var(--success)',
            lineHeight: 1.2,
          }}>
            Todo en orden. 0 pendientes.
          </div>
        ) : (
          <Link href="/traficos" style={{ textDecoration: 'none' }}>
            <div style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: 800,
              color: 'var(--gold-dark)',
              lineHeight: 1.2,
            }}>
              {enProceso} asunto{enProceso !== 1 ? 's' : ''} necesita{enProceso !== 1 ? 'n' : ''} atención.
            </div>
          </Link>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
          {dateStr} &middot; {companyName || 'cliente'}
        </div>
      </div>

      {/* SECTION 2 — Yesterday's Results */}
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 16px',
        scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
      }}>
        {results.map(card => (
          <Link href={card.href} key={card.key} style={{ textDecoration: 'none' }}>
            <div style={{
              minWidth: 140, padding: '16px 18px', borderRadius: 14,
              background: 'var(--bg-card)', border: '1px solid #E8E5E0',
              scrollSnapAlign: 'start',
            }}>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: 'var(--font-mono)', color: card.color,
              }}>
                {card.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* SECTION 3 — Today's Predictions */}
      {predictions.length > 0 && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {predictions.map(pred => (
            <Link href={pred.href} key={pred.key} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 18px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid #E8E5E0',
                fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5,
              }}>
                {pred.text}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* SECTION 4 — Your Value */}
      {(tmecSavings.totalSavings > 0 || sinIncidencia > 0) && (
        <div style={{
          margin: '16px 20px 24px', padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(196,150,60,0.08) 0%, rgba(196,150,60,0.02) 100%)',
          border: '1px solid rgba(196,150,60,0.2)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12,
          }}>
            Su valor este trimestre
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{
                fontSize: 24, fontWeight: 800,
                fontFamily: 'var(--font-mono)', color: 'var(--gold-dark)',
              }}>
                {fmtUSDCompact(tmecSavings.totalSavings)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ahorro T-MEC</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 18, fontWeight: 700,
                fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
              }}>
                {sinIncidencia}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operaciones exitosas</div>
            </div>
          </div>
        </div>
      )}

      {/* Network effect badge */}
      {traficos.length > 0 && (
        <div style={{
          margin: '0 20px 16px', padding: '10px 16px', borderRadius: 10,
          background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontSize: 14 }}>🌐</span>
          <span>Red CRUZ: 47 participantes contribuyen datos para mejorar sus predicciones</span>
        </div>
      )}

      {/* Ver todo link */}
      <div style={{ textAlign: 'center', padding: '8px 20px 40px' }}>
        <Link href="/traficos" style={{
          fontSize: 14, fontWeight: 600, color: 'var(--gold-dark)', textDecoration: 'none',
        }}>
          Ver todos los traficos &rarr;
        </Link>
      </div>

      {/* Confetti on realtime Cruzado event */}
      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
