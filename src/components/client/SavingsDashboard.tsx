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
          fontSize: 10, fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: accent,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: -4 }}>
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
        gap: 8, padding: '24px 0', color: '#64748b',
      }}>
        <BarChart3 size={24} color="#64748b" />
        <span style={{ fontSize: 13 }}>Sin datos de ahorro por categoría</span>
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
              <span style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 500 }}>
                {cat.category}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700,
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
        <Loader2 size={20} color="#00E5FF" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#94a3b8' }}>Cargando indicadores...</span>
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
          <AlertTriangle size={28} color="#EF4444" />
          <div style={{ fontSize: 14, color: '#EF4444', fontWeight: 600 }}>
            Error al cargar indicadores
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{errorMsg}</div>
          <button
            type="button"
            onClick={fetchData}
            style={{
              minHeight: 48,
              padding: '12px 24px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#E6EDF3',
              fontSize: 13,
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
          <TrendingUp size={18} color="#00E5FF" />
          <span style={{
            fontSize: 14, fontWeight: 700, color: '#00E5FF',
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
            color: '#64748b', padding: 8, lineHeight: 0,
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
            <TrendingUp size={32} color="#64748b" />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#E6EDF3' }}>
              Sin datos de ahorro disponibles
            </div>
            <div style={{ fontSize: 13, color: '#64748b', maxWidth: 360, lineHeight: 1.5 }}>
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
              icon={<Banknote size={16} color="#22C55E" />}
              label="Ahorro T-MEC YTD"
              value={fmtUSDCompact(data.tmec_savings_ytd)}
              accent="#22C55E"
              subtitle={`${new Date().getFullYear()}`}
            />
            <KPICard
              icon={<Package size={16} color="#00E5FF" />}
              label="Operaciones procesadas"
              value={operationCount.toLocaleString('es-MX')}
              accent="#E6EDF3"
            />
            <KPICard
              icon={<Clock size={16} color="#FBBF24" />}
              label="Tiempo promedio despacho"
              value={data.avg_clearance_days > 0 ? `${data.avg_clearance_days.toFixed(1)}d` : '—'}
              accent="#FBBF24"
              subtitle="días hábiles"
            />
            <KPICard
              icon={<Target size={16} color="#00E5FF" />}
              label="Precisión clasificación"
              value={data.classification_accuracy > 0 ? `${data.classification_accuracy.toFixed(1)}%` : '—'}
              accent={data.classification_accuracy >= 90 ? '#22C55E' : data.classification_accuracy >= 75 ? '#FBBF24' : '#EF4444'}
            />
          </div>

          {/* ── Savings breakdown ── */}
          {data.savings_by_category.length > 0 && (
            <div style={glassCard}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
              }}>
                <ShieldCheck size={16} color="#22C55E" />
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#22C55E',
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
