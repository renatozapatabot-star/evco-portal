'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCompanyIdCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { Send, CheckCircle } from 'lucide-react'

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtMXN = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: 'var(--amber-700)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, border: '1px solid var(--border-primary)', borderRadius: 8,
  padding: '0 16px', fontSize: 16, color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'var(--font-sans)', background: 'var(--bg-elevated)', boxSizing: 'border-box',
  transition: 'border-color 150ms',
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ color: 'var(--amber-700)', fontSize: 14 }}>{label}</span>
      <span className="mono" style={{ color: highlight ? 'var(--amber-600)' : 'var(--text-primary)', fontSize: bold ? 20 : 14, fontWeight: bold ? 600 : 500 }}>{value}</span>
    </div>
  )
}

export function CotizacionView() {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ valor_usd: '50000', tipo_cambio: '17.50', incoterm: 'EXW', flete_usd: '0', seguro_usd: '0', igi_rate: '5', regimen: 'A1', tmec: true, fraccion: '', pais_origen: 'US', peso_kg: '', bultos: '' })
  const [result, setResult] = useState<{ valorUSD: number; tc: number; valorAduanaMXN: number; dta: number; igi: number; iva: number; prev: number; total: number; igiRate: number; tmecSavings: number } | null>(null)
  const [rates, setRates] = useState<{ dta_amount: number; iva: number; tc: number } | null>(null)
  const [requestSending, setRequestSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/rates').then(r => r.json()).then(d => {
      if (!d.error && d.iva?.rate && d.tc?.rate) {
        setRates({ dta_amount: d.dta?.amount || 462, iva: d.iva.rate, tc: d.tc.rate })
      }
    }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [])

  const calculate = useCallback(() => {
    const valorUSD = parseFloat(form.valor_usd) || 0
    if (valorUSD === 0) { setResult(null); return }
    const tc = parseFloat(form.tipo_cambio) || 17.50
    const fleteUSD = parseFloat(form.flete_usd) || 0
    const seguroUSD = parseFloat(form.seguro_usd) || 0
    let valorAduanaUSD = valorUSD
    if (['EXW', 'FOB', 'FCA'].includes(form.incoterm)) valorAduanaUSD = valorUSD + fleteUSD + seguroUSD
    else if (['CFR', 'CPT'].includes(form.incoterm)) valorAduanaUSD = valorUSD + seguroUSD
    const valorAduanaMXN = valorAduanaUSD * tc
    const dtaAmount = rates?.dta_amount ?? null
    const ivaRate = rates?.iva ?? null
    if (dtaAmount === null || ivaRate === null) { setResult(null); return }
    const dta = dtaAmount
    const igiRate = form.tmec ? 0 : (parseFloat(form.igi_rate) || 0) / 100
    const igi = valorAduanaMXN * igiRate
    const iva = (valorAduanaMXN + igi + dta) * ivaRate
    const prev = 347.09
    const total = dta + igi + iva + prev
    setResult({ valorUSD, tc, valorAduanaMXN, dta, igi, iva, prev, total, igiRate: igiRate * 100, tmecSavings: form.tmec ? valorAduanaMXN * ((parseFloat(form.igi_rate) || 0) / 100) : 0 })
  }, [form])

  useEffect(() => { const t = setTimeout(calculate, 300); return () => clearTimeout(t) }, [calculate])

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Cotización Aduanal</h1>
        <p className="pg-meta">Calculadora de contribuciones &middot; DTA + IGI + IVA &middot; Patente 3596</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '55% 45%', gap: 24 }}>
        {/* Form */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ color: 'var(--amber-700)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>Parámetros del Embarque</div>

          <Field label="Valor de la Mercancía (USD)">
            <input type="number" value={form.valor_usd} onChange={e => set('valor_usd', e.target.value)} placeholder="50000.00" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
          </Field>
          <Field label="Tipo de Cambio (MXN/USD)">
            <input type="number" value={form.tipo_cambio} onChange={e => set('tipo_cambio', e.target.value)} placeholder="17.50" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Flete (USD)">
              <input type="number" value={form.flete_usd} onChange={e => set('flete_usd', e.target.value)} placeholder="0.00" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
            <Field label="Seguro (USD)">
              <input type="number" value={form.seguro_usd} onChange={e => set('seguro_usd', e.target.value)} placeholder="0.00" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Incoterms">
              <select value={form.incoterm} onChange={e => set('incoterm', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {['EXW','FOB','FCA','CPT','CIP','DAP','DDP','CFR','CIF'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Régimen">
              <select value={form.regimen} onChange={e => set('regimen', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="A1">A1 — Definitiva</option><option value="IN">IN — IMMEX</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Fracción Arancelaria">
              <input type="text" value={form.fraccion} onChange={e => set('fraccion', e.target.value)} placeholder="3901.20.01" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
            <Field label="País de Origen">
              <select value={form.pais_origen} onChange={e => { set('pais_origen', e.target.value); if (['US','CA','MX'].includes(e.target.value)) set('tmec', true) }} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="US">🇺🇸 Estados Unidos</option>
                <option value="CA">🇨🇦 Canadá</option>
                <option value="MX">🇲🇽 México</option>
                <option value="CN">🇨🇳 China</option>
                <option value="DE">🇩🇪 Alemania</option>
                <option value="JP">🇯🇵 Japón</option>
                <option value="KR">🇰🇷 Corea del Sur</option>
                <option value="TW">🇹🇼 Taiwán</option>
                <option value="XX">Otro</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Peso (kg)">
              <input type="number" value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} placeholder="0" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
            <Field label="Bultos">
              <input type="number" value={form.bultos} onChange={e => set('bultos', e.target.value)} placeholder="0" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Tasa IGI (%)">
              <input type="number" value={form.igi_rate} onChange={e => set('igi_rate', e.target.value)} placeholder="0" disabled={form.tmec}
                style={{ ...inputStyle, opacity: form.tmec ? 0.5 : 1 }}
                onFocus={e => e.target.style.borderColor = 'var(--amber-600)'} onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.tmec} onChange={e => set('tmec', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--amber-600)' }} />
                <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: form.tmec ? 600 : 400 }}>T-MEC / USMCA</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Results */}
        <div className="card" style={{ padding: isMobile ? 20 : 32, alignSelf: 'start', position: isMobile ? 'static' : 'sticky', top: 32 }}>
          <div className="section-header" style={{ marginBottom: 24 }}>Contribuciones Estimadas</div>

          {!result ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 14 }}>{!rates ? 'Tasas no disponibles — no se puede calcular' : 'Ingresa el valor de la mercancia para ver las contribuciones'}</div>
            </div>
          ) : (
            <>
              <Row label="Valor Aduana (MXN)" value={fmtMXN(result.valorAduanaMXN)} highlight />
              <Row label="DTA (fijo)" value={fmtMXN(result.dta)} />
              <Row label={`IGI (${result.igiRate.toFixed(1)}%)`} value={result.igi === 0 ? 'T-MEC $0' : fmtMXN(result.igi)} />
              <Row label="IVA (16%)" value={fmtMXN(result.iva)} />
              <Row label="PREV" value={fmtMXN(result.prev)} />
              <div style={{ height: 8 }} />
              <Row label="TOTAL CONTRIBUCIONES" value={fmtMXN(result.total)} bold highlight />

              {result.tmecSavings > 0 && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--green-bg, rgba(22,163,74,0.08))', border: '1px solid var(--green-border, rgba(22,163,74,0.2))', borderRadius: 'var(--r-md, 8px)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green, #16A34A)', marginBottom: 6 }}>
                    T-MEC / USMCA Aplicable
                  </div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green, #16A34A)' }}>
                    {fmtMXN(result.tmecSavings)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    ahorro vs arancel general {result.igiRate.toFixed(1)}%
                  </div>
                </div>
              )}

              <button onClick={() => {
                const text = `COTIZACIÓN ADUANAL\nValor: ${fmtUSD(result.valorUSD)} USD\nValor Aduana: ${fmtMXN(result.valorAduanaMXN)} MXN\nDTA: ${fmtMXN(result.dta)}\nIGI: ${result.igi === 0 ? 'T-MEC $0' : fmtMXN(result.igi)}\nIVA: ${fmtMXN(result.iva)}\nTOTAL: ${fmtMXN(result.total)}\n\nRenato Zapata III — Patente 3596`
                const blob = new Blob([text], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${getCompanyIdCookie()}_cotizacion_${new Date().toISOString().split('T')[0]}.txt`; a.click()
              }} style={{ width: '100%', height: 48, marginTop: 24, background: 'var(--amber-600)', border: 'none', borderRadius: 8, color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Generar Cotización
              </button>

              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
                Estimado sujeto a verificación &middot; Renato Zapata III — Patente 3596
              </div>
            </>
          )}
        </div>
      </div>

      {/* Formal quote request */}
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Solicitar cotización formal
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Envíe los datos del embarque y recibirá una cotización oficial por parte de Renato Zapata &amp; Company.
        </p>

        {requestSent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: 'rgba(22,163,74,0.06)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.2)' }}>
            <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              Solicitud enviada — le responderemos en breve
            </span>
          </div>
        ) : (
          <button
            onClick={async () => {
              setRequestSending(true)
              try {
                const res = await fetch('/api/client-requests', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'quote',
                    product_description: form.fraccion ? `Fracción ${form.fraccion}` : 'Mercancía general',
                    fraccion: form.fraccion || null,
                    origin_country: form.pais_origen || 'US',
                    estimated_value_usd: parseFloat(form.valor_usd) || null,
                    incoterm: form.incoterm,
                    notes: result ? `Estimado calculado: $${result.total.toFixed(2)} MXN total (DTA: $${result.dta.toFixed(2)}, IGI: $${result.igi.toFixed(2)}, IVA: $${result.iva.toFixed(2)})` : null,
                  }),
                })
                if (res.ok) setRequestSent(true)
              } catch (e) { console.error('[cotizacion] request submit:', (e as Error).message) }
              setRequestSending(false)
            }}
            disabled={requestSending}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '12px 24px', borderRadius: 8,
              background: 'var(--gold)', border: 'none', color: 'var(--bg-card)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Send size={16} /> {requestSending ? 'Enviando...' : 'Solicitar cotización formal'}
          </button>
        )}
      </div>
    </div>
  )
}
