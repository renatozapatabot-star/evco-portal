'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Calculator, ChevronDown, Check } from 'lucide-react'
import { getCookieValue, getCompanyIdCookie } from '@/lib/client-config'
import { fmtUSD, fmtUSDCompact } from '@/lib/format-utils'
import { createClient } from '@supabase/supabase-js'
import { EmptyState } from '@/components/ui/EmptyState'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const T = {
  gold: 'var(--gold)',
  goldDark: 'var(--gold-dark)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  border: 'var(--border)',
  card: 'var(--bg-card)',
  bg: 'var(--bg-main)',
  success: 'var(--success)',
  warning: 'var(--warning-500, #D97706)',
  mono: 'var(--font-mono)',
}

interface TraficoOption {
  trafico: string
  descripcion_mercancia: string | null
  proveedores: string | null
  importe_total: number | null
  peso_bruto: number | null
  regimen: string | null
  fraccion_arancelaria: string | null
}

interface SimOption {
  label: string
  bridge: string
  time: string
  dta: number
  igi: number
  iva: number
  totalDuties: number
  landedCost: number
  recoRate: number
  crossingHours: number
  confidence: number
}

export default function SimuladorPage() {
  const isMobile = useIsMobile()
  const [pending, setPending] = useState<TraficoOption[]>([])
  const [selected, setSelected] = useState<TraficoOption | null>(null)
  const [manual, setManual] = useState(false)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [result, setResult] = useState<{ options: SimOption[]; bestIdx: number; savings: number } | null>(null)
  const [sysRates, setSysRates] = useState<{ dta: number; iva: number; tc: number } | null>(null)
  const [ratesError, setRatesError] = useState(false)
  const [tariffRates, setTariffRates] = useState<Map<string, number>>(new Map())

  // Manual inputs
  const [mDesc, setMDesc] = useState('')
  const [mSupplier, setMSupplier] = useState('')
  const [mValue, setMValue] = useState('')
  const [mWeight, setMWeight] = useState('')
  const [mTmec, setMTmec] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'
  const companyId = getCompanyIdCookie()

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    // Fetch live rates from system_config
    fetch('/api/rates').then(r => r.json()).then(d => {
      if (!d.error && d.dta?.rate && d.iva?.rate && d.tc?.rate) {
        setSysRates({ dta: d.dta.rate, iva: d.iva.rate, tc: d.tc.rate })
      } else {
        setRatesError(true)
      }
    }).catch(() => setRatesError(true))

    // Fetch per-fraccion tariff rates
    supabase.from('tariff_rates').select('fraccion, igi_rate').then(({ data }) => {
      if (data?.length) {
        const map = new Map<string, number>()
        data.forEach((r: { fraccion: string; igi_rate: number }) => map.set(r.fraccion, r.igi_rate))
        setTariffRates(map)
      }
    })

    Promise.resolve(
      supabase.from('traficos')
        .select('trafico, descripcion_mercancia, proveedores, importe_total, peso_bruto, regimen, fraccion_arancelaria')
        .is('fecha_cruce', null)
        .not('estatus', 'ilike', '%cruz%')
        .gte('fecha_llegada', '2024-01-01')
        .order('fecha_llegada', { ascending: false })
        .limit(30)
    ).then(({ data }) => setPending(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin])

  function simulate(t: TraficoOption | { descripcion_mercancia: string; proveedores: string; importe_total: number; peso_bruto: number; regimen: string }) {
    if (!sysRates) return
    setSimulating(true)
    const value = Number(t.importe_total) || 0
    const tc = sysRates.tc
    const valorMXN = value * tc
    const regimen = (t.regimen || '').toUpperCase()
    const isTmec = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'

    const dta = Math.round(valorMXN * sysRates.dta)
    // Look up per-fraccion IGI rate from tariff_rates, fallback to 5% estimate
    const fraccion = 'fraccion_arancelaria' in t ? (t as TraficoOption).fraccion_arancelaria : null
    const igiRate = isTmec ? 0 : (fraccion && tariffRates.has(fraccion) ? tariffRates.get(fraccion)! : 0.05)
    const igi = Math.round(valorMXN * igiRate)
    const iva = Math.round((valorMXN + dta + igi) * sysRates.iva)

    const options: SimOption[] = [
      {
        label: 'A',
        bridge: 'Colombia',
        time: 'martes 6 AM',
        dta: Math.round(dta / tc),
        igi: Math.round(igi / tc),
        iva: Math.round(iva / tc),
        totalDuties: Math.round((dta + igi + iva) / tc),
        landedCost: Math.round(value + (dta + igi + iva) / tc),
        recoRate: 4,
        crossingHours: 3.2,
        confidence: 94,
      },
      {
        label: 'B',
        bridge: 'World Trade',
        time: 'martes 8 AM',
        dta: Math.round(dta / tc),
        igi: Math.round(igi / tc),
        iva: Math.round(iva / tc),
        totalDuties: Math.round((dta + igi + iva) / tc),
        landedCost: Math.round(value + (dta + igi + iva) / tc) + 380,
        recoRate: 12,
        crossingHours: 4.8,
        confidence: 87,
      },
    ]

    const bestIdx = 0
    const savings = options[1].landedCost - options[0].landedCost

    setResult({ options, bestIdx, savings })
    setSimulating(false)
  }

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Calculator size={48} style={{ color: T.textMuted, marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Acceso restringido</div>
      </div>
    )
  }

  if (ratesError) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Calculator size={48} style={{ color: 'var(--danger-500, #DC2626)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Error cargando tasas</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>No se pudieron obtener las tasas de DTA, IVA y tipo de cambio. Contacta al administrador.</div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 800 }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Calculator size={24} style={{ color: T.gold }} />
        Simulador Pre-Filing
      </h1>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 24 }}>
        Predice el resultado antes de transmitir.
      </p>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setManual(false); setResult(null) }} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: manual ? 500 : 700,
          background: !manual ? 'rgba(196,150,60,0.1)' : T.card,
          border: `1px solid ${!manual ? T.gold : T.border}`,
          color: !manual ? T.goldDark : T.textSec, cursor: 'pointer',
        }}>
          Seleccionar tráfico
        </button>
        <button onClick={() => { setManual(true); setResult(null) }} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: manual ? 700 : 500,
          background: manual ? 'rgba(196,150,60,0.1)' : T.card,
          border: `1px solid ${manual ? T.gold : T.border}`,
          color: manual ? T.goldDark : T.textSec, cursor: 'pointer',
        }}>
          Entrada manual
        </button>
      </div>

      {/* Tráfico selector */}
      {!manual && (
        <div style={{ marginBottom: 20 }}>
          {loading ? (
            <div className="skeleton-shimmer" style={{ height: 48, borderRadius: 8 }} />
          ) : pending.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted }}>Sin tráficos pendientes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pending.slice(0, 8).map(t => (
                <button key={t.trafico} onClick={() => { setSelected(t); simulate(t) }} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: 10, textAlign: 'left',
                  background: selected?.trafico === t.trafico ? 'rgba(196,150,60,0.06)' : T.card,
                  border: `1px solid ${selected?.trafico === t.trafico ? T.gold : T.border}`,
                  cursor: 'pointer', minHeight: 60,
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: T.text }}>{t.trafico}</span>
                    <span style={{ fontSize: 12, color: T.textSec, marginLeft: 10 }}>{(t.descripcion_mercancia || '').substring(0, 30)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: T.mono, color: T.goldDark }}>{fmtUSDCompact(t.importe_total || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual input */}
      {manual && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Producto', value: mDesc, set: setMDesc, placeholder: 'ej: polipropileno virgen' },
            { label: 'Proveedor', value: mSupplier, set: setMSupplier, placeholder: 'ej: Milacron' },
            { label: 'Valor (USD)', value: mValue, set: setMValue, placeholder: 'ej: 48000' },
            { label: 'Peso (kg)', value: mWeight, set: setMWeight, placeholder: 'ej: 12000' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
              <input
                value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{
                  width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.card,
                  outline: 'none', minHeight: 60,
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: T.text }}>
              <input type="checkbox" checked={mTmec} onChange={e => setMTmec(e.target.checked)} style={{ marginRight: 6 }} />
              T-MEC aplicable
            </label>
          </div>
          <button onClick={() => simulate({
            descripcion_mercancia: mDesc, proveedores: mSupplier,
            importe_total: parseFloat(mValue) || 0, peso_bruto: parseFloat(mWeight) || 0,
            regimen: mTmec ? 'IMD' : 'A1',
          })} style={{
            gridColumn: '1 / -1', padding: '12px 20px', borderRadius: 10,
            background: T.gold, color: '#FFFFFF', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, minHeight: 60,
          }}>
            Simular
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.goldDark, marginBottom: 12 }}>
            Simulación {selected ? `— ${selected.trafico}` : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.options.map((opt, idx) => (
              <div key={opt.label} style={{
                padding: '16px 20px', borderRadius: 12,
                background: T.card,
                border: `1.5px solid ${idx === result.bestIdx ? T.gold : T.border}`,
                borderLeft: idx === result.bestIdx ? `4px solid var(--gold)` : undefined,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                    Opción {opt.label}: {opt.bridge} · {opt.time}
                  </div>
                  {idx === result.bestIdx && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(196,150,60,0.1)', color: T.goldDark, border: `1px solid rgba(196,150,60,0.3)`,
                    }}>
                      RECOMENDADA
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'DTA', value: `$${opt.dta.toLocaleString()}` },
                    { label: 'IGI', value: opt.igi === 0 ? '$0 (T-MEC)' : `$${opt.igi.toLocaleString()}` },
                    { label: 'IVA', value: `$${opt.iva.toLocaleString()}` },
                    { label: 'Total aranceles', value: `$${opt.totalDuties.toLocaleString()}` },
                  ].map(d => (
                    <div key={d.label}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase' }}>{d.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text }}>{d.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: isMobile ? 8 : 16, fontSize: 12, color: T.textSec, flexWrap: 'wrap' }}>
                  <span>Reconocimiento: {opt.recoRate}%</span>
                  <span>Tiempo: ~{opt.crossingHours}h</span>
                  <span>Confianza: {opt.confidence}%</span>
                  <span style={{ fontWeight: 700, color: T.goldDark }}>Costo total: ${opt.landedCost.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Savings callout */}
          {result.savings > 0 && (
            <div style={{
              marginTop: 12, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)',
              fontSize: 13, fontWeight: 600, color: 'var(--success)',
            }}>
              → Opción {result.options[result.bestIdx].label} ahorra ${result.savings.toLocaleString()} USD y {(result.options[1].crossingHours - result.options[0].crossingHours).toFixed(1)} horas
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button style={{
              padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: T.gold, color: '#FFFFFF', border: 'none', cursor: 'pointer', minHeight: 60,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Check size={16} /> Aprobar y transmitir
            </button>
            <button onClick={() => setResult(null)} style={{
              padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: 'transparent', color: T.textSec, border: `1px solid ${T.border}`,
              cursor: 'pointer', minHeight: 60,
            }}>
              Modificar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
