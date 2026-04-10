'use client'

import { useState } from 'react'
import { getClientNameCookie, getClientRfcCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'

const T = { bg: 'var(--bg-main)', surface: 'var(--card-bg)', border: 'var(--border)', surfaceAlt: '#F5F3EF', text: 'var(--text-primary)', textSub: 'var(--text-secondary)', textMuted: '#999999', navy: 'var(--gold-dark)', gold: 'var(--gold-dark)', goldBg: '#FFF8EB', goldBorder: '#E8C84A', green: 'var(--success)', greenBg: '#EAF3DE', shadow: '0 1px 3px rgba(0,0,0,0.07)' }

const EXAMPLES = [
  'Pellets de polipropileno virgen, densidad 0.905 g/cm³, grado inyección, color natural',
  'Componentes de plástico ABS moldeados por inyección para uso automotriz',
  'Placas de policarbonato transparente, espesor 6mm, para uso industrial',
  'Resina de polietileno de alta densidad (HDPE) en forma granular',
]

export function OCAView() {
  const isMobile = useIsMobile()
  const [product, setProduct] = useState('')
  const [material, setMaterial] = useState('')
  const [uso, setUso] = useState('')
  const [paisOrigen, setPaisOrigen] = useState('US')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  async function generateOCA() {
    if (!product.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1] || ''
      const res = await fetch('/api/oca', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ product, material, uso, pais_origen: paisOrigen }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: unknown) { setError(((e instanceof Error) ? e.message : String(e)) || 'Error al generar la opinión') }
    setLoading(false)
  }

  function downloadOpinion() {
    if (!result) return
    const num = String(result.opinion_number || 'OCA')
    const content = [
      `OPINIÓN DE CLASIFICACIÓN ARANCELARIA`,
      `No. ${num}`,
      ``,
      `Fecha: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      `Cliente: ${getClientNameCookie()}`,
      `RFC: ${getClientRfcCookie()}`,
      ``,
      `I. PRODUCTO`,
      product,
      material ? `Material: ${material}` : '',
      uso ? `Uso: ${uso}` : '',
      `País de origen: ${paisOrigen}`,
      ``,
      `II. CLASIFICACIÓN`,
      `Fracción Arancelaria: ${result.fraccion}`,
      `Descripción TIGIE: ${result.descripcion_tigie || result.descripcion || ''}`,
      `Arancel General: ${result.arancel_general || result.arancel || ''}`,
      `T-MEC/USMCA: ${result.arancel_tmec || result.tmec || ''}`,
      `Confianza: ${typeof result.confianza === 'number' ? Math.round(Number(result.confianza) * 100) + '%' : '—'}`,
      ``,
      `III. ANÁLISIS`,
      String(result.analisis || ''),
      ``,
      `IV. FUNDAMENTO LEGAL`,
      String(result.fundamento_legal || result.fundamento || ''),
      Array.isArray(result.reglas_interpretacion) ? `\nReglas: ${(result.reglas_interpretacion as string[]).join('; ')}` : '',
      result.tmec_regla_origen ? `\nRegla de origen T-MEC: ${result.tmec_regla_origen}` : '',
      ``,
      `─`.repeat(60),
      `Renato Zapata III — Director General`,
      `Renato Zapata & Company · Patente 3596 · Aduana 240`,
      ``,
      `AVISO: Esta opinión es un análisis preliminar y no constituye`,
      `una resolución definitiva del Servicio de Administración Tributaria.`,
    ].filter(Boolean).join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${num}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>OCA — Opinión de Clasificación Arancelaria</h2>
        <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>Generador automático · Patente 3596 · Firmado por Renato Zapata III</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: (result && !isMobile) ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 20, marginBottom: 16 }}>
            <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Datos del Producto</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Descripción del Producto *</label>
              <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Describe el producto con detalle..." rows={4} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', background: T.bg, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Material / Composición</label>
              <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="Ej: Polipropileno 100%, ABS..." style={{ width: '100%', height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', background: T.bg, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Uso / Aplicación</label>
              <input value={uso} onChange={e => setUso(e.target.value)} placeholder="Ej: Industrial, automotriz, empaque..." style={{ width: '100%', height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', background: T.bg, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>País de Origen</label>
              <select value={paisOrigen} onChange={e => setPaisOrigen(e.target.value)} style={{ width: '100%', height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', background: T.bg, boxSizing: 'border-box', cursor: 'pointer' }}>
                <option value="US">🇺🇸 Estados Unidos</option>
                <option value="CA">🇨🇦 Canadá</option>
                <option value="CN">🇨🇳 China</option>
                <option value="DE">🇩🇪 Alemania</option>
                <option value="JP">🇯🇵 Japón</option>
                <option value="KR">🇰🇷 Corea del Sur</option>
                <option value="XX">Otro</option>
              </select>
            </div>
            <button onClick={generateOCA} disabled={loading || !product.trim()} style={{ width: '100%', height: 42, background: loading || !product.trim() ? '#CBD5E1' : T.navy, border: 'none', borderRadius: 8, color: 'rgba(9,9,11,0.75)', fontSize: 14, fontWeight: 700, cursor: loading || !product.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>{loading ? '⏳ Analizando TIGIE...' : '⚖️ Generar Opinión OCA'}</button>
            {error && <div style={{ marginTop: 12, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', color: 'var(--danger-text)', fontSize: 12 }}>{error}</div>}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 16 }}>
            <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Ejemplos rápidos</div>
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => setProduct(ex)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer', color: T.textSub, fontSize: 11, fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceAlt }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                {ex.substring(0, 70)}...
              </button>
            ))}
          </div>
        </div>
        {result && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 20, borderTop: `3px solid ${T.gold}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div><div style={{ color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{String(result.opinion_number || '')}</div><div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 2 }}>Opinión de Clasificación</div></div>
              <button onClick={downloadOpinion} style={{ background: T.navy, border: 'none', borderRadius: 7, padding: '7px 14px', color: 'rgba(9,9,11,0.75)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⬇️ Descargar</button>
            </div>
            <div style={{ background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Fracción Arancelaria</div>
              <div style={{ color: T.gold, fontSize: 28, fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-jetbrains-mono)' }}>{String(result.fraccion || '')}</div>
              <div style={{ color: T.textSub, fontSize: 12, marginTop: 4 }}>{String(result.descripcion_tigie || result.descripcion || '')}</div>
              {typeof result.confianza === 'number' && (
                <div style={{ fontSize: 11, color: Number(result.confianza) >= 0.8 ? T.green : T.textMuted, marginTop: 4, fontWeight: 600 }}>
                  Confianza: {Math.round(Number(result.confianza) * 100)}%
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Arancel General', value: String(result.arancel_general || result.arancel || '—') },
                { label: 'T-MEC / USMCA', value: String(result.arancel_tmec || result.tmec || '—'), green: true },
              ].map(r => (
                <div key={r.label} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ color: r.green ? T.green : T.text, fontSize: 15, fontWeight: 700 }}>{r.value}</div>
                </div>
              ))}
            </div>
            {typeof result.tmec_regla_origen === 'string' && result.tmec_regla_origen && (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: T.greenBg, borderRadius: 8, fontSize: 11, color: T.green }}>
                <b>Regla de origen T-MEC:</b> {String(result.tmec_regla_origen)}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Análisis</div>
              <div style={{ color: T.textSub, fontSize: 12, lineHeight: 1.7, background: T.surfaceAlt, borderRadius: 8, padding: 12 }}>{String(result.analisis || '')}</div>
            </div>
            {Array.isArray(result.reglas_interpretacion) && result.reglas_interpretacion.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Reglas de Interpretación</div>
                {(result.reglas_interpretacion as string[]).map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: T.textSub, marginBottom: 3 }}>• {r}</div>
                ))}
              </div>
            )}
            <div style={{ paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Fundamento Legal</div>
              <div style={{ color: T.textSub, fontSize: 11, lineHeight: 1.6 }}>{String(result.fundamento_legal || result.fundamento || '')}</div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`, textAlign: 'right' }}>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>Renato Zapata III</div>
              <div style={{ color: T.textMuted, fontSize: 10 }}>Director General · Patente 3596</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
