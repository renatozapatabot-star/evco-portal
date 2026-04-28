'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Calculator } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { createClient } from '@supabase/supabase-js'
import { GlassCard } from '@/components/aguila'
import { BG_ELEVATED } from '@/lib/design-system'
import { FraccionInput } from '@/components/ui/FraccionInput'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const T = {
  silver: 'var(--accent-silver, #C0C5CE)',
  text: 'var(--text-primary, #E6EDF3)',
  textSec: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  border: 'rgba(192,197,206,0.2)',
  amber: 'var(--portal-status-amber-fg)',
  amberBg: 'var(--portal-status-amber-bg)',
  green: 'var(--portal-status-green-fg)',
  greenBg: 'var(--portal-status-green-bg)',
  mono: 'var(--font-mono)',
}

// T-MEC eligible régimenes — mirrors src/app/api/cost-savings/route.ts
const TMEC_REGIMES = new Set(['ITE', 'ITR', 'IMD'])

// Régimen options — union of DTA rates set (A1/IN/IT) and T-MEC set (ITE/ITR/IMD)
const REGIMEN_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'A1', label: 'A1 — Definitiva de importación' },
  { code: 'IN', label: 'IN — Importación definitiva con franquicia' },
  { code: 'IT', label: 'IT — Importación temporal' },
  { code: 'ITE', label: 'ITE — Importación temporal IMMEX (T-MEC)' },
  { code: 'ITR', label: 'ITR — Importación temporal retorno (T-MEC)' },
  { code: 'IMD', label: 'IMD — Importación definitiva T-MEC' },
]

// Fallback IGI rate when fracción has no tariff_rates entry — matches
// src/lib/customs/estimate-igi-iva.ts fallback behaviour (5%).
const FALLBACK_IGI_RATE = 0.05 // test-value

interface TraficoOption {
  trafico: string
  descripcion_mercancia: string | null
  proveedores: string | null
  importe_total: number | null
  peso_bruto: number | null
  regimen: string | null
  // fraccion_arancelaria was a phantom on traficos (M16 sweep). Fracción
  // lives on partidas→productos (3-hop). For the simulator's prefill,
  // operator types fracción manually — keeping the form light.
}

interface CalcResult {
  valorUsd: number
  fraccion: string
  regimen: string
  tc: number
  valorAduanaMxn: number
  dtaMxn: number
  igiRate: number
  igiRateKnown: boolean  // true when fracción hit tariff_rates; false → fallback
  igiMxn: number
  ivaMxn: number
  totalMxn: number
  totalUsd: number
  tmecSavingsMxn: number | null  // null when not T-MEC régimen
}

function fmtMxn(n: number): string {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function SimuladorPage() {
  const isMobile = useIsMobile()
  const [pending, setPending] = useState<TraficoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sysRates, setSysRates] = useState<{ dta_amount: number; iva: number; tc: number; tcDate: string; tcSource: string } | null>(null)
  const [ratesError, setRatesError] = useState(false)
  const [tariffRates, setTariffRates] = useState<Map<string, number>>(new Map())

  const [valorUsd, setValorUsd] = useState('')
  const [fraccion, setFraccion] = useState('')
  const [regimen, setRegimen] = useState('A1')

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }

    fetch('/api/rates').then(r => r.json()).then(d => {
      if (!d.error && d.iva?.rate && d.tc?.rate) {
        setSysRates({
          dta_amount: d.dta?.amount || 462,
          iva: d.iva.rate,
          tc: d.tc.rate,
          tcDate: d.tc.date || '',
          tcSource: d.tc.source || 'system_config',
        })
      } else {
        setRatesError(true)
      }
    }).catch(() => setRatesError(true))

    supabase.from('tariff_rates').select('fraccion, igi_rate').then(({ data }) => {
      if (data?.length) {
        const map = new Map<string, number>()
        data.forEach((r: { fraccion: string; igi_rate: number }) => map.set(r.fraccion, Number(r.igi_rate) || 0))
        setTariffRates(map)
      }
    })

    Promise.resolve(
      supabase.from('traficos')
        .select('trafico, descripcion_mercancia, proveedores, importe_total, peso_bruto, regimen')
        .is('fecha_cruce', null)
        .not('estatus', 'ilike', '%cruz%')
        .gte('fecha_llegada', '2024-01-01')
        .order('fecha_llegada', { ascending: false })
        .limit(30)
    ).then(({ data }) => setPending(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin])

  // Reactive calculation — no button needed, recomputes on every input change.
  const result: CalcResult | null = useMemo(() => {
    if (!sysRates) return null
    const v = parseFloat(valorUsd)
    if (!Number.isFinite(v) || v <= 0) return null

    const tc = sysRates.tc
    const valorAduanaMxn = v * tc
    const dtaMxn = sysRates.dta_amount
    const isTmec = TMEC_REGIMES.has(regimen)

    // Fracción must match XXXX.XX.XX before we attempt tariff lookup.
    const fraccionValid = /^\d{4}\.\d{2}\.\d{2}$/.test(fraccion)
    const tariffHit = fraccionValid && tariffRates.has(fraccion)
    const igiRateGeneral = tariffHit ? tariffRates.get(fraccion)! : FALLBACK_IGI_RATE
    const igiRate = isTmec ? 0 : igiRateGeneral
    const igiMxn = valorAduanaMxn * igiRate

    const ivaMxn = sysRates.iva * (valorAduanaMxn + dtaMxn + igiMxn)

    const totalMxn = valorAduanaMxn + dtaMxn + igiMxn + ivaMxn

    // T-MEC savings = IGI that would apply at general rate minus IGI at T-MEC.
    const tmecSavingsMxn = isTmec ? valorAduanaMxn * igiRateGeneral : null

    return {
      valorUsd: v,
      fraccion: fraccionValid ? fraccion : '',
      regimen,
      tc,
      valorAduanaMxn,
      dtaMxn,
      igiRate,
      igiRateKnown: tariffHit,
      igiMxn,
      ivaMxn,
      totalMxn,
      totalUsd: totalMxn / tc,
      tmecSavingsMxn,
    }
  }, [sysRates, valorUsd, fraccion, regimen, tariffRates])

  function hydrateFromTrafico(t: TraficoOption) {
    if (t.importe_total != null) setValorUsd(String(t.importe_total))
    // fracción is entered manually (no phantom traficos.fraccion_arancelaria
    // after M16 sweep — real home is partidas→productos).
    const code = (t.regimen || '').toUpperCase().trim()
    if (code && REGIMEN_OPTIONS.some(r => r.code === code)) setRegimen(code)
  }

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Calculator size={48} style={{ color: T.textMuted, marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: T.text, fontWeight: 600 }}>Acceso restringido</div>
      </div>
    )
  }

  if (ratesError) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Calculator size={48} style={{ color: 'var(--portal-status-red-fg)', marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--aguila-fs-section, 14px)', color: T.text, fontWeight: 700 }}>Error cargando tasas</div>
        <div style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: T.textMuted, marginTop: 8, maxWidth: 420, marginInline: 'auto' }}>
          No se pudieron obtener las tasas de DTA, IVA y tipo de cambio desde system_config. Contacta al administrador — el pipeline no calcula con tasas expiradas.
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 960 }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Calculator size={24} style={{ color: T.silver }} />
        Calculadora de aranceles
      </h1>
      <p style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: T.textMuted, marginBottom: 24 }}>
        Estima valor en aduana, DTA, IGI e IVA antes de transmitir. Todas las cifras son estimadas — las tasas finales aplican al presentar el pedimento.
      </p>

      {/* Pending embarques — optional prefill */}
      {!loading && pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--aguila-fs-label, 11px)', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Pre-cargar de embarque pendiente
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pending.slice(0, 6).map(t => (
              <button
                key={t.trafico}
                onClick={() => hydrateFromTrafico(t)}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${T.border}`,
                  color: T.text, cursor: 'pointer',
                  fontSize: 'var(--aguila-fs-meta, 11px)', fontFamily: T.mono,
                  minHeight: 40,
                }}
                title={t.descripcion_mercancia || ''}
              >
                {t.trafico}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Inputs */}
        <GlassCard>
          <div style={{ fontSize: 'var(--aguila-fs-label, 11px)', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Entradas
          </div>

          {/* Valor comercial */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textSec, marginBottom: 6, fontWeight: 600 }}>
              <span>Valor comercial</span>
              <span style={{ fontFamily: T.mono, color: T.silver }}>USD</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={valorUsd}
              onChange={e => setValorUsd(e.target.value)}
              placeholder="48000"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: BG_ELEVATED,
                border: `1.5px solid ${T.border}`,
                color: T.text, fontFamily: T.mono,
                fontSize: 'var(--aguila-fs-section, 14px)', fontWeight: 700,
                outline: 'none', minHeight: 60,
              }}
            />
          </div>

          {/* Fracción arancelaria */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textSec, marginBottom: 6, fontWeight: 600 }}>
              <span>Fracción arancelaria</span>
              <span style={{ fontFamily: T.mono, color: T.silver }}>TIGIE</span>
            </label>
            <FraccionInput value={fraccion} onChange={setFraccion} placeholder="3907.40.01" />
            {fraccion && /^\d{4}\.\d{2}\.\d{2}$/.test(fraccion) && (
              <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: tariffRates.has(fraccion) ? T.green : T.amber, marginTop: 4 }}>
                {tariffRates.has(fraccion)
                  ? `IGI general: ${(tariffRates.get(fraccion)! * 100).toFixed(2)}%`
                  : `Sin tarifa registrada — se estima ${(FALLBACK_IGI_RATE * 100).toFixed(0)}%`}
              </div>
            )}
          </div>

          {/* Régimen */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textSec, marginBottom: 6, fontWeight: 600 }}>
              Régimen
            </label>
            <select
              value={regimen}
              onChange={e => setRegimen(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: BG_ELEVATED,
                border: `1.5px solid ${T.border}`,
                color: T.text, fontFamily: 'var(--font-geist-sans, inherit)',
                fontSize: 'var(--aguila-fs-body, 13px)', fontWeight: 600,
                outline: 'none', minHeight: 60, cursor: 'pointer',
              }}
            >
              {REGIMEN_OPTIONS.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
            {TMEC_REGIMES.has(regimen) && (
              <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: T.green, marginTop: 4 }}>
                T-MEC aplicable → IGI al 0%.
              </div>
            )}
          </div>

          {/* Tipo de cambio — read-only */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textSec, marginBottom: 6, fontWeight: 600 }}>
              <span>Tipo de cambio</span>
              <span style={{ fontFamily: T.mono, color: T.silver }}>MXN / USD</span>
            </label>
            <div style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${T.border}`,
              color: T.text, fontFamily: T.mono,
              fontSize: 'var(--aguila-fs-section, 14px)', fontWeight: 700,
              minHeight: 60, display: 'flex', alignItems: 'center',
            }}>
              {sysRates ? sysRates.tc.toFixed(4) : '—'}
            </div>
            {sysRates?.tcDate && (
              <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textMuted, marginTop: 4 }}>
                {sysRates.tcSource || 'Banxico'} · {sysRates.tcDate}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Outputs */}
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--aguila-fs-label, 11px)', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Resultados
            </div>
            <span style={{
              fontSize: 'var(--aguila-fs-meta, 11px)', fontWeight: 800,
              padding: '2px 8px', borderRadius: 9999,
              background: T.amberBg, color: T.amber,
              border: `1px solid ${T.amber}`,
              letterSpacing: '0.06em',
            }}>
              ESTIMADO
            </span>
          </div>

          {!result ? (
            <div style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: T.textMuted, padding: '40px 0', textAlign: 'center' }}>
              Introduce valor y fracción para calcular.
            </div>
          ) : (
            <>
              {/* KPI grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <ResultLine label="Valor en aduana" currency="MXN" value={fmtMxn(result.valorAduanaMxn)} />
                <ResultLine label="DTA" currency="MXN" value={fmtMxn(result.dtaMxn)} />
                <ResultLine
                  label="IGI"
                  currency="MXN"
                  value={fmtMxn(result.igiMxn)}
                  note={TMEC_REGIMES.has(result.regimen) ? 'T-MEC 0%' : !result.igiRateKnown ? 'Tarifa estimada' : undefined}
                />
                <ResultLine label="IVA" currency="MXN" value={fmtMxn(result.ivaMxn)} />
              </div>

              {/* T-MEC savings pill */}
              {result.tmecSavingsMxn != null && result.tmecSavingsMxn > 0 && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: T.greenBg,
                  border: `1px solid var(--portal-status-green-ring)`,
                  marginBottom: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                }}>
                  <span style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: T.green, fontWeight: 700 }}>
                    Ahorro T-MEC (Estimado)
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 'var(--aguila-fs-kpi-compact, 18px)', fontWeight: 800, color: T.green }}>
                    <span style={{ fontSize: 'var(--aguila-fs-meta, 11px)', marginRight: 4, opacity: 0.7 }}>MXN</span>
                    {fmtMxn(result.tmecSavingsMxn)}
                  </span>
                </div>
              )}

              {/* Total estimado */}
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid rgba(192,197,206,0.25)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--aguila-fs-label, 11px)', color: T.silver, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Total estimado
                  </span>
                  <span style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textMuted, fontFamily: T.mono }}>MXN</span>
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 'var(--aguila-fs-kpi-hero, 28px)', fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
                  {fmtMxn(result.totalMxn)}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textMuted, marginTop: 6, fontFamily: T.mono }}>
                  ≈ USD {fmtUsd(result.totalUsd)} · tc {result.tc.toFixed(4)}
                </div>
              </div>

              <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: T.textMuted, marginTop: 12, lineHeight: 1.5 }}>
                Base IVA = valor en aduana + DTA + IGI. No incluye honorarios de agencia. Tasas desde system_config ·
                {sysRates?.tcDate ? ` ${sysRates.tcDate}` : ''}
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

function ResultLine({ label, currency, value, note }: { label: string; currency: 'MXN' | 'USD'; value: string; note?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--aguila-fs-label, 10px)', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-kpi-compact, 18px)', fontWeight: 700, color: 'var(--text-primary, #E6EDF3)' }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta, 10px)', marginRight: 4, opacity: 0.6, fontWeight: 600 }}>{currency}</span>
        {value}
      </div>
      {note && (
        <div style={{ fontSize: 'var(--aguila-fs-meta, 10px)', color: 'var(--portal-status-amber-fg)', marginTop: 2 }}>{note}</div>
      )}
    </div>
  )
}
