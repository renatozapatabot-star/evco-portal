'use client'

import { useEffect, useState } from 'react'
import { GOLD } from '@/lib/design-system'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'

/* ── Types ── */
interface BenchmarkRow {
  company_id: string
  metric_name: string
  metric_value: number
  fleet_average?: number
  fleet_median?: number
  top_quartile?: number
  bottom_quartile?: number
  sample_size?: number
  period?: string
}

interface MetricConfig {
  key: string
  label: string
  unit: string
  lowerIsBetter: boolean
  max: number
}

const METRICS: MetricConfig[] = [
  { key: 'avg_crossing_time_hours', label: 'Tiempo de Cruce',       unit: 'hrs',  lowerIsBetter: true,  max: 80 },
  { key: 'doc_completeness_pct',    label: 'Completitud Docs',      unit: '%',    lowerIsBetter: false, max: 100 },
  { key: 'compliance_score',        label: 'Score Cumplimiento',    unit: 'pts',  lowerIsBetter: false, max: 100 },
  { key: 'active_traficos',         label: 'Embarques Activos',      unit: '',     lowerIsBetter: false, max: 200 },
]

const GRAY   = '#555'
const BG     = '#1a1a2e'
const CARD   = '#16213e'
const TEXT   = '#e0e0e0'
const MUTED  = '#888'
const GREEN  = '#4ade80'
const RED    = '#f87171'

/* ── Insight Generator ── */
function generateInsights(client: Record<string, BenchmarkRow>, fleet: Record<string, BenchmarkRow>): string[] {
  const tips: string[] = []

  const crossing   = client['avg_crossing_time_hours']
  const fleetCross = fleet['avg_crossing_time_hours']
  if (crossing && fleetCross?.fleet_average) {
    const diff = ((fleetCross.fleet_average - crossing.metric_value) / fleetCross.fleet_average * 100).toFixed(0)
    if (Number(diff) > 0) {
      tips.push(`Tu tiempo de cruce es ${diff}% más rápido que el promedio de la flota`)
    } else {
      tips.push(`Tu tiempo de cruce es ${Math.abs(Number(diff))}% más lento — optimizar podría agilizar entregas`)
    }
  }

  const docs      = client['doc_completeness_pct']
  const fleetDocs = fleet['doc_completeness_pct']
  if (docs && fleetDocs?.top_quartile && docs.metric_value < fleetDocs.top_quartile) {
    tips.push('Subir completitud de documentos al top 25% reduciría demoras en aduana')
  }

  const compliance      = client['compliance_score']
  const fleetCompliance = fleet['compliance_score']
  if (compliance && fleetCompliance?.fleet_average) {
    if (compliance.metric_value > fleetCompliance.fleet_average) {
      tips.push('Tu score de cumplimiento supera el promedio — excelente posición regulatoria')
    } else {
      tips.push('Mejorar cumplimiento T-MEC podría ahorrarte ~$380K MXN/año en aranceles')
    }
  }

  if (tips.length === 0) {
    tips.push('Datos insuficientes para generar recomendaciones — se actualizará pronto')
  }

  return tips
}

/* ── Bar Component ── */
function MetricBar({ config, clientRow, fleetRow }: {
  config: MetricConfig
  clientRow?: BenchmarkRow
  fleetRow?: BenchmarkRow
}) {
  const clientVal  = clientRow?.metric_value ?? 0
  const fleetAvg   = fleetRow?.fleet_average ?? fleetRow?.metric_value ?? 0
  const topQ       = fleetRow?.top_quartile ?? 0

  const effectiveMax = Math.max(config.max, clientVal, fleetAvg, topQ) * 1.1

  const barWidth = (v: number) => `${Math.min((v / effectiveMax) * 100, 100)}%`
  const topQLeft = topQ > 0 ? `${Math.min((topQ / effectiveMax) * 100, 100)}%` : null

  // Determine if client is above or below fleet
  const delta = clientVal - fleetAvg
  const isGood = config.lowerIsBetter ? delta < 0 : delta > 0
  const deltaColor = isGood ? GREEN : (Math.abs(delta) < 0.01 ? MUTED : RED)
  const deltaSign  = delta > 0 ? '+' : ''
  const deltaText  = fleetAvg > 0
    ? `${deltaSign}${((delta / fleetAvg) * 100).toFixed(0)}% vs flota`
    : ''

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>{config.label}</span>
        <span style={{ color: deltaColor, fontSize: 12, fontWeight: 600 }}>{deltaText}</span>
      </div>

      {/* Client bar */}
      <div style={{ position: 'relative', height: 18, background: '#0d1117', borderRadius: 4, marginBottom: 3, overflow: 'visible' }}>
        <div style={{
          height: '100%',
          width: barWidth(clientVal),
          background: `linear-gradient(90deg, ${GOLD}cc, ${GOLD})`,
          borderRadius: 4,
          transition: 'width 0.8s ease',
        }} />
        <span style={{
          position: 'absolute', right: 6, top: 1,
          fontSize: 11, color: TEXT, fontWeight: 600,
        }}>
          {clientVal.toFixed(config.unit === '%' ? 1 : 0)} {config.unit}
        </span>

        {/* Top quartile marker */}
        {topQLeft && (
          <div style={{
            position: 'absolute',
            left: topQLeft,
            top: -2,
            height: 22,
            width: 0,
            borderLeft: `2px dashed ${MUTED}`,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', top: -14, left: -8,
              fontSize: 9, color: MUTED, whiteSpace: 'nowrap',
            }}>Top 25%</span>
          </div>
        )}
      </div>

      {/* Fleet bar */}
      <div style={{ position: 'relative', height: 10, background: '#0d1117', borderRadius: 3 }}>
        <div style={{
          height: '100%',
          width: barWidth(fleetAvg),
          background: GRAY,
          borderRadius: 3,
          transition: 'width 0.8s ease',
        }} />
        <span style={{
          position: 'absolute', right: 6, top: -1,
          fontSize: 9, color: MUTED,
        }}>
          Flota: {fleetAvg.toFixed(config.unit === '%' ? 1 : 0)}
        </span>
      </div>
    </div>
  )
}

/* ── Main Widget ── */
export default function ComparativeWidget() {
  const [clientData, setClientData]   = useState<BenchmarkRow[]>([])
  const [fleetData, setFleetData] = useState<BenchmarkRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const companyId = getCompanyIdCookie()
        const [clientRes, fleetRes] = await Promise.all([
          fetch(`/api/data?table=client_benchmarks&company_id=${companyId}`),
          fetch('/api/data?table=client_benchmarks&company_id=fleet'),
        ])
        const client  = await clientRes.json()
        const fleet = await fleetRes.json()
        setClientData(Array.isArray(client) ? client : client.data || [])
        setFleetData(Array.isArray(fleet) ? fleet : fleet.data || [])
      } catch (e) {
        console.error('ComparativeWidget fetch error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Index by metric_name
  const clientByMetric:  Record<string, BenchmarkRow> = {}
  const fleetByMetric: Record<string, BenchmarkRow> = {}
  clientData.forEach(r  => { clientByMetric[r.metric_name] = r })
  fleetData.forEach(r => { fleetByMetric[r.metric_name] = r })

  const insights = generateInsights(clientByMetric, fleetByMetric)

  return (
    <div style={{
      background: CARD,
      borderRadius: 12,
      padding: '20px 24px',
      border: `1px solid ${GOLD}33`,
      minWidth: 320,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>&#x1F4CA;</span>
        <div>
          <h3 style={{ margin: 0, color: GOLD, fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
            ¿CÓMO TE COMPARAS?
          </h3>
          <span style={{ fontSize: 11, color: MUTED }}>{getClientNameCookie().split(' ')[0]} vs. Portafolio Completo</span>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 24, color: MUTED, fontSize: 13 }}>
          Cargando benchmarks...
        </div>
      )}

      {/* Metric bars */}
      {!loading && METRICS.map(m => (
        <MetricBar
          key={m.key}
          config={m}
          clientRow={clientByMetric[m.key]}
          fleetRow={fleetByMetric[m.key]}
        />
      ))}

      {/* Insights */}
      {!loading && insights.length > 0 && (
        <div style={{
          marginTop: 14,
          padding: '10px 12px',
          background: `${GOLD}11`,
          borderRadius: 8,
          borderLeft: `3px solid ${GOLD}`,
        }}>
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 600, marginBottom: 6 }}>
            INSIGHTS
          </div>
          {insights.map((tip, i) => (
            <div key={i} style={{
              fontSize: 12,
              color: TEXT,
              marginBottom: i < insights.length - 1 ? 6 : 0,
              lineHeight: 1.4,
            }}>
              &#x2022; {tip}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 14,
        fontSize: 10, color: MUTED,
      }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: GOLD, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />{getClientNameCookie().split(' ')[0]}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: GRAY, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Flota</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 0, borderTop: `2px dashed ${MUTED}`, marginRight: 4, verticalAlign: 'middle' }} />Top 25%</span>
      </div>
    </div>
  )
}
