'use client'

import { useEffect, useState } from 'react'
import { EXPORT_FORMAT_LABEL_ES, EXPORT_FORMAT_VERSION } from '@/lib/pedimento-export'
import type { ValidationError } from '@/lib/pedimento-types'

interface ExportarClientProps {
  pedimentoId: string
  traficoId: string
}

interface ValidationState {
  loading: boolean
  errors_count: number
  warnings_count: number
  can_submit: boolean
  errors: ValidationError[]
}

interface ExportResult {
  job_id: string
  file_url: string
  format_version: string
  generated_at: string
}

export function ExportarClient({ pedimentoId }: ExportarClientProps) {
  const [validation, setValidation] = useState<ValidationState>({
    loading: true,
    errors_count: 0,
    warnings_count: 0,
    can_submit: false,
    errors: [],
  })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch(`/api/pedimento/${pedimentoId}/validate`, { cache: 'no-store' })
        const body = await res.json() as {
          errors_count?: number
          warnings_count?: number
          can_submit?: boolean
          errors?: ValidationError[]
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setError(body.error ?? 'No se pudo validar el pedimento')
          setValidation(v => ({ ...v, loading: false }))
          return
        }
        setValidation({
          loading: false,
          errors_count: body.errors_count ?? 0,
          warnings_count: body.warnings_count ?? 0,
          can_submit: body.can_submit ?? false,
          errors: body.errors ?? [],
        })
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error desconocido al validar')
        setValidation(v => ({ ...v, loading: false }))
      }
    }
    run()
    return () => { cancelled = true }
  }, [pedimentoId])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedimento/${pedimentoId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: EXPORT_FORMAT_VERSION }),
      })
      const body = await res.json() as {
        data: ExportResult | null
        error: { code: string; message: string } | null
      }
      if (!res.ok || body.error) {
        setError(body.error?.message ?? 'Error al generar archivo')
        setGenerating(false)
        return
      }
      if (body.data) setResult(body.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        backgroundColor: 'rgba(9,9,11,0.75)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <section className="mb-6">
        <label
          htmlFor="format-select"
          className="block text-xs uppercase tracking-wider text-slate-400 mb-2"
        >
          Formato de exportación
        </label>
        <select
          id="format-select"
          value={EXPORT_FORMAT_VERSION}
          onChange={() => { /* only one format during placeholder phase */ }}
          className="w-full rounded-xl border px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          <option value={EXPORT_FORMAT_VERSION}>{EXPORT_FORMAT_LABEL_ES}</option>
        </select>
      </section>

      <section className="mb-6">
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
          Estado de validación
        </p>
        {validation.loading ? (
          <p className="text-sm text-slate-300">Validando pedimento…</p>
        ) : validation.can_submit ? (
          <p className="text-sm" style={{ color: '#22C55E' }}>
            Sin errores bloqueantes
            {validation.warnings_count > 0
              ? ` · ${validation.warnings_count} advertencia(s)`
              : ''}
          </p>
        ) : (
          <div>
            <p className="text-sm" style={{ color: '#EF4444' }}>
              {validation.errors_count} error(es) bloqueantes — corrige antes de exportar
            </p>
            {validation.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {validation.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-slate-500">[{e.tab}]</span>{' '}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || validation.loading || !validation.can_submit}
        className="w-full rounded-xl px-6 py-4 text-sm font-medium text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{
          minHeight: '60px',
          background: validation.can_submit && !generating
            ? 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)'
            : 'rgba(192,197,206,0.25)',
          color: validation.can_submit && !generating ? '#0A0A0C' : '#7A7E86',
        }}
      >
        {generating ? 'Generando…' : 'Generar archivo'}
      </button>

      {error && (
        <p className="mt-4 text-sm" style={{ color: '#EF4444' }}>
          {error}
        </p>
      )}

      {result && (
        <section
          className="mt-6 rounded-xl border p-4"
          style={{
            backgroundColor: 'rgba(192,197,206,0.08)',
            borderColor: 'rgba(192,197,206,0.25)',
          }}
        >
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Archivo generado
          </p>
          <p className="text-sm text-slate-200">
            Job{' '}
            <span className="font-mono text-xs text-slate-400">{result.job_id}</span>
          </p>
          <a
            href={result.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm underline"
            style={{ color: '#C0C5CE' }}
          >
            Descargar archivo
          </a>
        </section>
      )}
    </div>
  )
}
