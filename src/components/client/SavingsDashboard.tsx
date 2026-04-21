'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Package, Clock, Target,
  Loader2, AlertTriangle, RefreshCw,
  ShieldCheck, Banknote, BarChart3,
} from 'lucide-react'
import { fmtUSDCompact } from '@/lib/format-utils'

// ── Types ──────────────────────────────────────────────────

interface CostInsight {
  tmec_savings_ytd: number
  avg_clearance_days: number
  classification_accuracy: number
  savings_by_category: SavingsCategory[]
}

interface SavingsCategory {
  category: string
  amount: number
  color: string
}

interface TraficoRow {
  id: string
  status: string
  fecha_pago: string | null
}

type LoadState = 'loading' | 'ready' | 'error'

// ── Glass card style ───────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
}

// ── KPI Card ───────────────────────────────────────────────

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  subtitle?: string
}

function KPICard({ icon, label, value, accent, subtitle }: KPICardProps) {
  return (
    <div style={{
      ...glassCard,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 130,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{
          fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: 'var(--portal-fg-5)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'var(--aguila-fs-kpi-mid)',
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: accent,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)', marginTop: -4 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

// ── Savings Bar ────────────────────────────────────────────

function SavingsBar({ categories, maxAmount }: { categories: SavingsCategory[]; maxAmount: number }) {
  if (categories.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, padding: '24px 0', color: 'var(--portal-fg-5)',
      }}>
        <BarChart3 size={24} color="var(--portal-fg-5)" />
        <span style={{ fontSize: 'var(--aguila-fs-body)' }}>Sin datos de ahorro por categoría</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {categories.map((cat) => {
        const pct = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0
        return (
          <div key={cat.category}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', fontWeight: 500 }}>
                {cat.category}
              </span>
              <span style={{
                fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: cat.color,
              }}>
                {fmtUSDCompact(cat.amount)}
              </span>
            </div>
            <div style={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(pct, 2)}%`,
                background: cat.color,
                borderRadius: 4,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────

export function SavingsDashboard() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [insights, setInsights] = useState<CostInsight | null>(null)
  const [operationCount, setOperationCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchData = useCallback(async () => {
    setLoadState('loading')
    setErrorMsg('')

    try {
      const [insightsRes, traficosRes] = await Promise.all([
        fetch('/api/intelligence/cost-insights'),
        fetch('/api/data?table=traficos&limit=5000&select=id,status,fecha_pago'),
      ])

      // Parse insights
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json()
        setInsights(insightsData)
      } else {
        // Use fallback defaults if insights API not available yet
        setInsights({
          tmec_savings_ytd: 0,
          avg_clearance_days: 0,
          classification_accuracy: 0,
          savings_by_category: [],
        })
      }

      // Parse traficos count
      if (traficosRes.ok) {
        const traficosData: TraficoRow[] = await traficosRes.json()
        setOperationCount(Array.isArray(traficosData) ? traficosData.length : 0)
      } else {
        setOperationCount(0)
      }

      setLoadState('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar datos')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Loading ──
  if (loadState === 'loading') {
    return (
      <div style={{
        ...glassCard,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, minHeight: 200,
      }}>
        <Loader2 size={20} color="var(--portal-fg-3)" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-4)' }}>Cargando indicadores...</span>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // ── Error ──
  if (loadState === 'error') {
    return (
      <div style={glassCard}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: '24px 0', textAlign: 'center',
        }}>
          <AlertTriangle size={28} color="var(--portal-status-red-fg)" />
          <div style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-status-red-fg)', fontWeight: 600 }}>
            Error al cargar indicadores
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)' }}>{errorMsg}</div>
          <button
            type="button"
            onClick={fetchData}
            style={{
              minHeight: 48,
              padding: '12px 24px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            }}
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const data = insights ?? {
    tmec_savings_ytd: 0,
    avg_clearance_days: 0,
    classification_accuracy: 0,
    savings_by_category: [],
  }

  const maxCategoryAmount = data.savings_by_category.length > 0
    ? Math.max(...data.savings_by_category.map(c => c.amount))
    : 0

  // Determine empty state
  const isEmpty = data.tmec_savings_ytd === 0 && operationCount === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp size={18} color="var(--portal-fg-3)" />
          <span style={{
            fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--portal-fg-3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Valor Generado
          </span>
        </div>
        <button
          type="button"
          onClick={fetchData}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--portal-fg-5)', padding: 8, lineHeight: 0,
          }}
          title="Actualizar"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Empty state ── */}
      {isEmpty ? (
        <div style={glassCard}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '32px 16px', textAlign: 'center',
          }}>
            <TrendingUp size={32} color="var(--portal-fg-5)" />
            <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--portal-fg-1)' }}>
              Sin datos de ahorro disponibles
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', maxWidth: 360, lineHeight: 1.5 }}>
              Los indicadores de valor se calcularán automáticamente conforme
              se procesen operaciones a través de ADUANA.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}>
            <KPICard
              icon={<Banknote size={16} color="var(--portal-status-green-fg)" />}
              label="Ahorro T-MEC YTD"
              value={fmtUSDCompact(data.tmec_savings_ytd)}
              accent="var(--portal-status-green-fg)"
              subtitle={`${new Date().getFullYear()}`}
            />
            <KPICard
              icon={<Package size={16} color="var(--portal-fg-3)" />}
              label="Operaciones procesadas"
              value={operationCount.toLocaleString('es-MX')}
              accent="var(--portal-fg-1)"
            />
            <KPICard
              icon={<Clock size={16} color="var(--portal-status-amber-fg)" />}
              label="Tiempo promedio despacho"
              value={data.avg_clearance_days > 0 ? `${data.avg_clearance_days.toFixed(1)}d` : '—'}
              accent="var(--portal-status-amber-fg)"
              subtitle="días hábiles"
            />
            <KPICard
              icon={<Target size={16} color="var(--portal-fg-3)" />}
              label="Precisión clasificación"
              value={data.classification_accuracy > 0 ? `${data.classification_accuracy.toFixed(1)}%` : '—'}
              accent={data.classification_accuracy >= 90 ? 'var(--portal-status-green-fg)' : data.classification_accuracy >= 75 ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-red-fg)'}
            />
          </div>

          {/* ── Savings breakdown ── */}
          {data.savings_by_category.length > 0 && (
            <div style={glassCard}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
              }}>
                <ShieldCheck size={16} color="var(--portal-status-green-fg)" />
                <span style={{
                  fontSize: 'var(--aguila-fs-compact)', fontWeight: 700, color: 'var(--portal-status-green-fg)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Desglose de Ahorro
                </span>
              </div>
              <SavingsBar categories={data.savings_by_category} maxAmount={maxCategoryAmount} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
