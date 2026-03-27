'use client'

import { useState, useEffect, useCallback } from 'react'

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
  const [form, setForm] = useState({ valor_usd: '50000', tipo_cambio: '17.50', incoterm: 'EXW', flete_usd: '0', seguro_usd: '0', igi_rate: '5', regimen: 'A1', tmec: true })
  const [result, setResult] = useState<any>(null)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

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
    const dta = form.regimen === 'IN' ? 347.09 : valorAduanaMXN * 0.008
    const igiRate = form.tmec ? 0 : (parseFloat(form.igi_rate) || 0) / 100
    const igi = valorAduanaMXN * igiRate
    const iva = (valorAduanaMXN + igi + dta) * 0.16
    const prev = 347.09
    const total = dta + igi + iva + prev
    setResult({ valorUSD, tc, valorAduanaMXN, dta, igi, iva, prev, total, igiRate: igiRate * 100, tmecSavings: form.tmec ? valorAduanaMXN * ((parseFloat(form.igi_rate) || 0) / 100) : 0 })
  }, [form])

  useEffect(() => { const t = setTimeout(calculate, 300); return () => clearTimeout(t) }, [calculate])

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Cotización Aduanal</h1>
        <p className="pg-meta">Calculadora de contribuciones &middot; DTA + IGI + IVA &middot; Patente 3596</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 24 }}>
        {/* Form */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ color: 'var(--amber-700)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>Parametros del Embarque</div>

          <Field label="Valor de la Mercancia (USD)">
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
            <Field label="Regimen">
              <select value={form.regimen} onChange={e => set('regimen', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="A1">A1 — Definitiva</option><option value="IN">IN — IMMEX</option>
              </select>
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
        <div className="card" style={{ padding: 32, alignSelf: 'start', position: 'sticky', top: 32 }}>
          <div className="section-header" style={{ marginBottom: 24 }}>Contribuciones Estimadas</div>

          {!result ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 14 }}>Ingresa el valor de la mercancia para ver las contribuciones</div>
            </div>
          ) : (
            <>
              <Row label="Valor Aduana (MXN)" value={fmtMXN(result.valorAduanaMXN)} highlight />
              <Row label="DTA (8‰)" value={fmtMXN(result.dta)} />
              <Row label={`IGI (${result.igiRate.toFixed(1)}%)`} value={result.igi === 0 ? 'T-MEC $0' : fmtMXN(result.igi)} />
              <Row label="IVA (16%)" value={fmtMXN(result.iva)} />
              <Row label="PREV" value={fmtMXN(result.prev)} />
              <div style={{ height: 8 }} />
              <Row label="TOTAL CONTRIBUCIONES" value={fmtMXN(result.total)} bold highlight />

              {result.tmecSavings > 0 && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div style={{ color: 'var(--status-green)', fontSize: 14, fontWeight: 600 }}>Ahorro T-MEC: {fmtMXN(result.tmecSavings)}</div>
                </div>
              )}

              <button onClick={() => {
                const text = `COTIZACION ADUANAL\nValor: ${fmtUSD(result.valorUSD)} USD\nValor Aduana: ${fmtMXN(result.valorAduanaMXN)} MXN\nDTA: ${fmtMXN(result.dta)}\nIGI: ${result.igi === 0 ? 'T-MEC $0' : fmtMXN(result.igi)}\nIVA: ${fmtMXN(result.iva)}\nTOTAL: ${fmtMXN(result.total)}\n\nRenato Zapata III — Patente 3596`
                const blob = new Blob([text], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `evco_cotizacion_${new Date().toISOString().split('T')[0]}.txt`; a.click()
              }} style={{ width: '100%', height: 48, marginTop: 24, background: 'var(--amber-600)', border: 'none', borderRadius: 8, color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Generar Cotización
              </button>

              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
                Estimado sujeto a verificacion &middot; Renato Zapata III — Patente 3596
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
