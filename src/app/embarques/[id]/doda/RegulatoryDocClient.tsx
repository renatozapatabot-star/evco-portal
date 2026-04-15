'use client'

import { useState } from 'react'
import { FallbackLink } from '@/components/aguila'

interface GenerationResult {
  pdf_url: string
  xml_url: string
  generado_en: string
}

interface RegulatoryDocClientProps {
  apiPath: string
  docLabelEs: string
  /** GlobalPC fallback URL for this document type. */
  fallbackHref?: string
  /** Human label for the fallback link (e.g. "DODA", "Carta Porte", "AVC"). */
  fallbackLabel?: string
}

/**
 * Shared client component for Block 16 regulatory doc pages (DODA, Carta
 * Porte, AVC). Single screen: AMBER banner + three buttons.
 */
export function RegulatoryDocClient({
  apiPath,
  docLabelEs,
  fallbackHref,
  fallbackLabel,
}: RegulatoryDocClientProps) {
  const [generating, setGenerating] = useState<false | 'pdf' | 'xml' | 'both'>(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async (kind: 'pdf' | 'xml' | 'both') => {
    setGenerating(kind)
    setError(null)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const body = (await res.json()) as {
        data: GenerationResult | null
        error: { code: string; message: string } | null
      }
      if (!res.ok || body.error) {
        setError(body.error?.message ?? 'Error al generar documento')
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
        backgroundColor: 'rgba(255,255,255,0.045)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        role="status"
        className="mb-6 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: 'rgba(212,149,42,0.10)',
          borderColor: 'rgba(212,149,42,0.35)',
        }}
      >
        <p className="text-sm" style={{ color: '#FBBF24' }}>
          Generación local. Submisión a VUCEM/SAT pendiente para V2.
        </p>
      </div>

      <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
        Estado de validación
      </p>
      <p className="text-sm mb-6" style={{ color: '#22C55E' }}>
        Listo para generar {docLabelEs}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => generate('pdf')}
          disabled={generating !== false}
          className="rounded-xl px-4 py-4 text-sm font-medium text-slate-100 transition-colors disabled:opacity-50"
          style={{
            minHeight: '60px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {generating === 'pdf' ? 'Generando…' : 'Generar PDF'}
        </button>
        <button
          type="button"
          onClick={() => generate('xml')}
          disabled={generating !== false}
          className="rounded-xl px-4 py-4 text-sm font-medium text-slate-100 transition-colors disabled:opacity-50"
          style={{
            minHeight: '60px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {generating === 'xml' ? 'Generando…' : 'Generar XML'}
        </button>
        <button
          type="button"
          onClick={() => generate('both')}
          disabled={generating !== false}
          className="rounded-xl px-4 py-4 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            minHeight: '60px',
            background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
            color: '#0A0A0C',
          }}
        >
          {generating === 'both' ? 'Generando…' : 'Descargar ambos'}
        </button>
      </div>

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
            Archivos generados
          </p>
          <p className="text-xs font-mono text-slate-500 mb-3">{result.generado_en}</p>
          <div className="flex flex-col gap-2">
            <a
              href={result.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
              style={{ color: '#C0C5CE' }}
            >
              Descargar PDF
            </a>
            <a
              href={result.xml_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
              style={{ color: '#C0C5CE' }}
            >
              Descargar XML
            </a>
          </div>
        </section>
      )}

      {fallbackHref && fallbackLabel && (
        <FallbackLink
          href={fallbackHref}
          label={fallbackLabel}
          isIncomplete={Boolean(error)}
          message={error ? `No se pudo generar en AGUILA — usa GlobalPC como respaldo.` : undefined}
          cta={`Abrir ${fallbackLabel} en GlobalPC`}
        />
      )}
    </div>
  )
}
