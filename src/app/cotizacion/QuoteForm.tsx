'use client'

import { useState } from 'react'
import { GlassCard, SectionHeader, AguilaInput, AguilaSelect } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, ACCENT_SILVER_BRIGHT, SILVER_GRADIENT } from '@/lib/design-system'

interface Quote {
  valor_usd: number
  valor_aduana_usd: number
  valor_aduana_mxn: number
  tipo_cambio: number
  incoterm: string
  regimen: string
  fraccion: string | null
  pais_origen: string
  dta: { rate: number; amount_mxn: number }
  igi: { rate: number; amount_mxn: number; tmec: boolean }
  iva: { rate: number; base_mxn: number; amount_mxn: number }
  prev: number
  total_contribuciones_mxn: number
  tmec_eligible: boolean
  tmec_savings_mxn: number
  disclaimer: string
}

const INCOTERMS = ['EXW', 'FOB', 'FCA', 'CPT', 'CIP', 'DAP', 'DDP', 'CFR', 'CIF'] as const
const REGIMENES = ['A1', 'IN', 'ITE', 'ITR', 'IMD'] as const

function fmtMXN(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Line({ label, amount, currency, note, emphasis }: {
  label: string
  amount: number
  currency: 'MXN' | 'USD'
  note?: string
  emphasis?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div>
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: emphasis ? TEXT_PRIMARY : TEXT_SECONDARY, fontWeight: emphasis ? 600 : 400 }}>{label}</div>
        {note && <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 2, letterSpacing: 0.4 }}>{note}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: emphasis ? 18 : 14,
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? TEXT_PRIMARY : TEXT_SECONDARY,
        }}>
          {currency === 'MXN' ? fmtMXN(amount) : fmtUSD(amount)}
        </span>
        <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginLeft: 6, letterSpacing: 0.6 }}>{currency}</span>
      </div>
    </div>
  )
}

export function QuoteForm() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const body = {
      valor_usd: Number(fd.get('valor_usd')),
      fraccion: String(fd.get('fraccion') ?? '').trim() || undefined,
      pais_origen: String(fd.get('pais_origen') ?? 'US').trim(),
      peso_kg: fd.get('peso_kg') ? Number(fd.get('peso_kg')) : undefined,
      bultos: fd.get('bultos') ? Number(fd.get('bultos')) : undefined,
      incoterm: String(fd.get('incoterm') ?? 'EXW'),
      flete_usd: Number(fd.get('flete_usd') ?? 0),
      seguro_usd: Number(fd.get('seguro_usd') ?? 0),
      regimen: String(fd.get('regimen') ?? 'A1'),
      igi_rate_pct: Number(fd.get('igi_rate_pct') ?? 5),
      tmec: fd.get('tmec') === 'on',
    }

    try {
      const res = await fetch('/api/rate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { quote?: Quote; error?: string }
      if (!res.ok || !json.quote) {
        setErr(json.error ?? 'No se pudo calcular la cotización')
        return
      }
      setQuote(json.quote)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'grid', gap: 20,
      gridTemplateColumns: quote ? 'minmax(320px, 1fr) minmax(320px, 1fr)' : '1fr',
      maxWidth: quote ? 1100 : 720,
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <GlassCard>
          <SectionHeader title="Operación" />
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <AguilaInput
                id="valor_usd"
                name="valor_usd"
                label="Valor factura (USD)"
                type="number"
                step="0.01"
                min="0"
                required
                mono
                defaultValue="50000"
              />
              <AguilaInput
                id="fraccion"
                name="fraccion"
                label="Fracción"
                placeholder="3901.20.01"
                pattern="\d{4}\.\d{2}\.\d{2}"
                mono
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <AguilaInput
                id="pais_origen"
                name="pais_origen"
                label="Origen"
                defaultValue="US"
                maxLength={3}
                mono
              />
              <AguilaSelect
                id="incoterm"
                name="incoterm"
                label="Incoterm"
                defaultValue="EXW"
                options={INCOTERMS.map((i) => ({ value: i, label: i }))}
              />
              <AguilaSelect
                id="regimen"
                name="regimen"
                label="Régimen"
                defaultValue="A1"
                options={REGIMENES.map((r) => ({ value: r, label: r }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <AguilaInput
                id="flete_usd"
                name="flete_usd"
                label="Flete (USD)"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                mono
              />
              <AguilaInput
                id="seguro_usd"
                name="seguro_usd"
                label="Seguro (USD)"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                mono
              />
              <AguilaInput
                id="igi_rate_pct"
                name="igi_rate_pct"
                label="IGI (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue="5"
                mono
              />
            </div>

            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', minHeight: 48,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, cursor: 'pointer',
              fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY,
            }}>
              <input type="checkbox" name="tmec" defaultChecked style={{ width: 18, height: 18, accentColor: ACCENT_SILVER_BRIGHT }} />
              Certificado T-MEC / USMCA (IGI 0%)
            </label>
          </div>
        </GlassCard>

        {err && (
          <GlassCard>
            <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{err}</p>
          </GlassCard>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: 60, padding: '0 28px',
              background: SILVER_GRADIENT, color: 'var(--portal-ink-0)',
              border: 'none', borderRadius: 10,
              fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Calculando…' : 'Calcular cotización'}
          </button>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
            Tipo de cambio + DTA + IVA desde system_config
          </span>
        </div>
      </form>

      {quote && (
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <GlassCard>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 12, paddingBottom: 12,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div>
                <div style={{
                  fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: TEXT_MUTED,
                }}>Total contribuciones</div>
                <div style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 'var(--aguila-fs-kpi-compact)', fontWeight: 800, color: TEXT_PRIMARY,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 4,
                }}>{fmtMXN(quote.total_contribuciones_mxn)}</div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2, letterSpacing: 0.6 }}>
                  MXN · tipo de cambio {quote.tipo_cambio.toFixed(4)}
                </div>
              </div>
              {quote.tmec_eligible && quote.tmec_savings_mxn > 0 && (
                <div style={{
                  textAlign: 'right',
                  background: 'var(--portal-status-green-bg)',
                  border: '1px solid var(--portal-status-green-ring)',
                  borderRadius: 10,
                  padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--portal-status-green-fg)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                    Ahorro T-MEC
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--portal-status-green-fg)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtMXN(quote.tmec_savings_mxn)}
                  </div>
                </div>
              )}
            </div>

            <Line label="Valor factura" amount={quote.valor_usd} currency="USD" />
            <Line label="Valor en aduana" amount={quote.valor_aduana_mxn} currency="MXN"
                  note={`${quote.incoterm} · ${fmtUSD(quote.valor_aduana_usd)} USD`} />
            <Line label="DTA" amount={quote.dta.amount_mxn} currency="MXN"
                  note={quote.dta.rate > 0 ? `${(quote.dta.rate * 100).toFixed(3)}% ad valorem` : 'Cuota fija'} />
            <Line label="IGI" amount={quote.igi.amount_mxn} currency="MXN"
                  note={quote.igi.tmec ? 'T-MEC · 0%' : `${(quote.igi.rate * 100).toFixed(2)}% del valor aduana`} />
            <Line label="IVA" amount={quote.iva.amount_mxn} currency="MXN"
                  note={`${(quote.iva.rate * 100).toFixed(0)}% sobre ${fmtMXN(quote.iva.base_mxn)} (valor + DTA + IGI)`} />
            <Line label="Prevalidación" amount={quote.prev} currency="MXN" />

            <div style={{ marginTop: 8 }}>
              <Line label="Total contribuciones" amount={quote.total_contribuciones_mxn} currency="MXN" emphasis />
            </div>
          </GlassCard>

          <GlassCard>
            <p style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
              {quote.disclaimer}
            </p>
            <p style={{ fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER, margin: '8px 0 0', letterSpacing: 0.4 }}>
              Base IVA = valor aduana + DTA + IGI (nunca factura × 0.16 plano)
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
