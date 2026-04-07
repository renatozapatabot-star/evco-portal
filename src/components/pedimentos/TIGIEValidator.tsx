'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Search, CheckCircle, AlertTriangle, Info } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface TariffResult {
  fraccion: string
  descripcion: string | null
  igi_general: number | null
  igi_tmec: number | null
  unidad: string | null
  notas: string | null
}

interface TIGIEValidatorProps {
  /** Pre-filled fraccion from trafico data */
  initialFraccion?: string
  /** Callback when a valid fraccion is confirmed */
  onValidated?: (result: TariffResult) => void
}

/**
 * TIGIEValidator — Real-time fraccion arancelaria validation against tariff_rates table.
 * Validates format (XXXX.XX.XX), checks existence in TIGIE, shows rate details.
 */
export function TIGIEValidator({ initialFraccion, onValidated }: TIGIEValidatorProps) {
  const [fraccion, setFraccion] = useState(initialFraccion || '')
  const [result, setResult] = useState<TariffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async (input: string) => {
    const clean = input.trim()
    if (!clean) { setResult(null); setError(null); return }

    // Format check: XXXX.XX.XX
    const fraccionRegex = /^\d{4}\.\d{2}\.\d{2}$/
    if (!fraccionRegex.test(clean)) {
      setError('Formato inválido. Use XXXX.XX.XX (ej: 3901.20.01)')
      setResult(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryErr } = await supabase
        .from('tariff_rates')
        .select('fraccion, descripcion, igi_general, igi_tmec, unidad, notas')
        .eq('fraccion', clean)
        .limit(1)
        .single()

      if (queryErr || !data) {
        // Try partial match (first 8 chars)
        const partial = clean.replace(/\.\d{2}$/, '')
        const { data: partialData } = await supabase
          .from('tariff_rates')
          .select('fraccion, descripcion, igi_general, igi_tmec, unidad, notas')
          .like('fraccion', `${partial}%`)
          .limit(5)

        if (partialData && partialData.length > 0) {
          setError(`Fracción exacta no encontrada. Sugerencias: ${partialData.map(d => d.fraccion).join(', ')}`)
        } else {
          setError('Fracción no encontrada en TIGIE. Verifique el código.')
        }
        setResult(null)
      } else {
        const tariff: TariffResult = {
          fraccion: data.fraccion,
          descripcion: data.descripcion,
          igi_general: data.igi_general,
          igi_tmec: data.igi_tmec,
          unidad: data.unidad,
          notas: data.notas,
        }
        setResult(tariff)
        setError(null)
        onValidated?.(tariff)
      }
    } catch {
      setError('Error al consultar TIGIE')
      setResult(null)
    }

    setLoading(false)
  }, [onValidated])

  return (
    <div>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }} />
        <input
          value={fraccion}
          onChange={e => {
            setFraccion(e.target.value)
            // Auto-validate after format looks complete
            if (/^\d{4}\.\d{2}\.\d{2}$/.test(e.target.value)) {
              validate(e.target.value)
            }
          }}
          onBlur={() => validate(fraccion)}
          placeholder="XXXX.XX.XX (ej: 3901.20.01)"
          style={{
            width: '100%', padding: '10px 12px 10px 34px',
            border: `1px solid ${error ? 'var(--danger-500)' : result ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', outline: 'none',
            background: 'var(--bg-card)', boxSizing: 'border-box',
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>
            Validando...
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--danger-500)', marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--danger-500)' }}>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 8, background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <CheckCircle size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>Fracción válida</span>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
            {result.descripcion || 'Sin descripción'}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>IGI General</span>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {result.igi_general != null ? `${result.igi_general}%` : 'N/A'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>IGI T-MEC</span>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                {result.igi_tmec != null ? `${result.igi_tmec}%` : 'Exento'}
              </div>
            </div>
            {result.unidad && (
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidad</span>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {result.unidad}
                </div>
              </div>
            )}
          </div>

          {result.notas && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <Info size={12} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.notas}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
