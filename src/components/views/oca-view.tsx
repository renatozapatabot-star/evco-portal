'use client'

import { useState } from 'react'
import { getClientNameCookie, getClientRfcCookie } from '@/lib/client-config'

const T = { bg: '#FAFAF8', surface: 'var(--card-bg)', border: '#E8E6E0', surfaceAlt: '#F5F3EF', text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999', navy: '#BA7517', gold: '#BA7517', goldBg: '#FFF8EB', goldBorder: '#E8C84A', green: '#16A34A', greenBg: '#EAF3DE', shadow: '0 1px 3px rgba(0,0,0,0.07)' }

const EXAMPLES = [
  'Pellets de polipropileno virgen, densidad 0.905 g/cm³, grado inyección, color natural',
  'Componentes de plástico ABS moldeados por inyección para uso automotriz',
  'Placas de policarbonato transparente, espesor 6mm, para uso industrial',
  'Resina de polietileno de alta densidad (HDPE) en forma granular',
]

export function OCAView() {
  const [product, setProduct] = useState('')
  const [material, setMaterial] = useState('')
  const [uso, setUso] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [opinionNum] = useState(() => `OCA-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`)

  async function generateOCA() {
    if (!product.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/oca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product, material, uso, opinionNum }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Error al generar la opinión') }
    setLoading(false)
  }

  function downloadOpinion() {
    if (!result) return
    const content = [`OPINIÓN DE CLASIFICACIÓN ARANCELARIA`, `No. ${opinionNum}`, ``, `Fecha: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`, `Cliente: ${getClientNameCookie()}`, `RFC: ${getClientRfcCookie()}`, ``, `I. PRODUCTO`, product, material ? `Material: ${material}` : '', uso ? `Uso: ${uso}` : '', ``, `II. CLASIFICACIÓN`, `Fracción Arancelaria: ${result.fraccion}`, `Descripción TIGIE: ${result.descripcion}`, `Arancel General: ${result.arancel}`, `T-MEC/USMCA: ${result.tmec}`, ``, `III. ANÁLISIS`, result.analisis, ``, `IV. FUNDAMENTO LEGAL`, result.fundamento, ``, `─`.repeat(60), `Renato Zapata III — Director General`, `Renato Zapata & Company · Patente 3596`].filter(Boolean).join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${opinionNum}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>OCA — Opinión de Clasificación Arancelaria</h2>
        <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>Generador automático · Patente 3596 · Firmado por Renato Zapata III</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20 }}>
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
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Uso / Aplicación</label>
              <input value={uso} onChange={e => setUso(e.target.value)} placeholder="Ej: Industrial, automotriz, empaque..." style={{ width: '100%', height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', background: T.bg, boxSizing: 'border-box' }} />
            </div>
            <button onClick={generateOCA} disabled={loading || !product.trim()} style={{ width: '100%', height: 42, background: loading || !product.trim() ? '#CBD5E1' : T.navy, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading || !product.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>{loading ? '⏳ Analizando TIGIE...' : '⚖️ Generar Opinión OCA'}</button>
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
              <div><div style={{ color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{opinionNum}</div><div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 2 }}>Opinión de Clasificación</div></div>
              <button onClick={downloadOpinion} style={{ background: T.navy, border: 'none', borderRadius: 7, padding: '7px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⬇️ Descargar</button>
            </div>
            <div style={{ background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Fracción Arancelaria</div>
              <div style={{ color: T.gold, fontSize: 28, fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-jetbrains-mono)' }}>{result.fraccion}</div>
              <div style={{ color: T.textSub, fontSize: 12, marginTop: 4 }}>{result.descripcion}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[{ label: 'Arancel General', value: result.arancel }, { label: 'T-MEC / USMCA', value: result.tmec, green: true }].map(r => (
                <div key={r.label} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ color: r.green ? T.green : T.text, fontSize: 15, fontWeight: 700 }}>{r.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Análisis</div>
              <div style={{ color: T.textSub, fontSize: 12, lineHeight: 1.7, background: T.surfaceAlt, borderRadius: 8, padding: 12 }}>{result.analisis}</div>
            </div>
            <div style={{ paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Fundamento Legal</div>
              <div style={{ color: T.textSub, fontSize: 11, lineHeight: 1.6 }}>{result.fundamento}</div>
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
